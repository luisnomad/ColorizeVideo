import argparse
import os
import torch
import shutil
import glob
import cv2
import numpy as np
import tempfile
from deoldify import device
from deoldify.device_id import DeviceId
from deoldify.visualize import get_video_colorizer
import warnings  # Import the warnings module

# --- Constants ---

# Default render factor for DeOldify.  Higher values = more vibrant colors,
# but can also introduce artifacts.  Range: 10-40 (typically).
DEFAULT_RENDER_FACTOR = 21

# Default saturation scale.  Reduces the saturation of the colorized frames
# to prevent over-saturation.  Range: 0.0 (grayscale) to 1.0 (full saturation).
DEFAULT_SATURATION_SCALE = 0.8

# Default CLAHE (Contrast Limited Adaptive Histogram Equalization) clip limit.
# Controls the contrast enhancement applied during histogram matching.
# Lower values reduce noise amplification but also reduce contrast enhancement.
# Range: 0.1 to 4.0 (typically).  Values below 1.0 are generally recommended
# to avoid excessive noise.
DEFAULT_CLAHE_CLIP_LIMIT = 0.5

# Default blend factor for post-processing.  Controls the blending between
# the original DeOldify frame and the histogram-matched frame.
# Range: 0.0 (original frame only) to 1.0 (histogram-matched frame only).
# Values around 0.5 provide a good balance between temporal consistency
# and preserving the original DeOldify colorization.
DEFAULT_BLEND_FACTOR = 0.6

# Default output directory for colorized videos.
DEFAULT_OUTPUT_DIR = "colorized_videos"

# Video codec for output. 'avc1' is generally well-supported (H.264).
# 'mp4v' is another option, but 'avc1' is often preferred for better quality.
VIDEO_CODEC = "avc1"

# Tile grid size for CLAHE. (8,8) is a common and generally good choice.
# Larger tiles mean larger regions for contrast adjustment.
CLAHE_TILE_GRID_SIZE = (8, 8)

# Suppress specific warnings
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

def match_histograms(source, template, saturation_scale=DEFAULT_SATURATION_SCALE, clahe_clip_limit=DEFAULT_CLAHE_CLIP_LIMIT):
    """
    Matches histograms and controls saturation and contrast.
    """
    source_lab = cv2.cvtColor(source, cv2.COLOR_BGR2LAB)
    template_lab = cv2.cvtColor(template, cv2.COLOR_BGR2LAB)

    matched_lab = np.zeros_like(source_lab)
    for i in range(3):
        clahe = cv2.createCLAHE(clipLimit=clahe_clip_limit, tileGridSize=CLAHE_TILE_GRID_SIZE)
        matched_lab[:, :, i] = clahe.apply(source_lab[:, :, i])

    matched_bgr = cv2.cvtColor(matched_lab, cv2.COLOR_LAB2BGR)
    hsv = cv2.cvtColor(matched_bgr, cv2.COLOR_BGR2HSV)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * saturation_scale, 0, 255)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

def post_process_video(input_path, output_path, saturation_scale=DEFAULT_SATURATION_SCALE, clahe_clip_limit=DEFAULT_CLAHE_CLIP_LIMIT, blend_factor=DEFAULT_BLEND_FACTOR):
    cap = cv2.VideoCapture(input_path)
    ret, prev_frame = cap.read()
    if not ret:
        raise RuntimeError(f"Failed to read video: {input_path}")

    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fourcc = cv2.VideoWriter_fourcc(*VIDEO_CODEC)

    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        matched_frame = match_histograms(frame, prev_frame, saturation_scale, clahe_clip_limit)
        blended_frame = cv2.addWeighted(frame, (1 - blend_factor), matched_frame, blend_factor, 0)
        out.write(blended_frame)
        prev_frame = frame

    cap.release()
    out.release()

def post_process_video(input_path, output_path, saturation_scale=DEFAULT_SATURATION_SCALE, clahe_clip_limit=DEFAULT_CLAHE_CLIP_LIMIT, blend_factor=DEFAULT_BLEND_FACTOR, progress_callback=None):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        # This check is more specific than just ret, prev_frame = cap.read() failing
        if progress_callback:
            progress_callback({"status": "error", "stage": "Post-processing File Read", "message": f"Cannot open video file for post-processing: {input_path}"})
        raise RuntimeError(f"Cannot open video file for post-processing: {input_path}")

    ret, prev_frame = cap.read()
    if not ret:
        if progress_callback:
            progress_callback({"status": "error", "stage": "Post-processing Frame Read", "message": f"Failed to read first frame from: {input_path}"})
        raise RuntimeError(f"Failed to read first frame from video for post-processing: {input_path}")

    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    if progress_callback:
        progress_callback({
            "status": "processing",
            "stage": "Post-processing Start",
            "message": f"Starting post-processing. Total frames: {total_frames}",
            "total_frames": total_frames,
            "current_frame": 0
        })

    fourcc = cv2.VideoWriter_fourcc(*VIDEO_CODEC)
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    current_frame_num = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        current_frame_num += 1
        matched_frame = match_histograms(frame, prev_frame, saturation_scale, clahe_clip_limit)
        blended_frame = cv2.addWeighted(frame, (1 - blend_factor), matched_frame, blend_factor, 0)
        out.write(blended_frame)
        prev_frame = frame

        if progress_callback and current_frame_num % 10 == 0: # Report every 10 frames or adjust as needed
            progress_callback({
                "status": "processing",
                "stage": "Post-processing",
                "message": f"Processed frame {current_frame_num}/{total_frames}",
                "current_frame": current_frame_num,
                "total_frames": total_frames
            })

    cap.release()
    out.release()
    if progress_callback:
        progress_callback({
            "status": "processing",
            "stage": "Post-processing Finish",
            "message": f"Finished post-processing {current_frame_num} frames.",
            "current_frame": current_frame_num, # final count
            "total_frames": total_frames
        })


def colorize_video(input_path, output_path, render_factor=DEFAULT_RENDER_FACTOR, saturation_scale=DEFAULT_SATURATION_SCALE, clahe_clip_limit=DEFAULT_CLAHE_CLIP_LIMIT, blend_factor=DEFAULT_BLEND_FACTOR, progress_callback=None):
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)
    if progress_callback:
        progress_callback({"status": "processing", "stage": "Initializing", "message": f"Input: {input_path}, Output: {output_path}", "current_frame": 0, "total_frames": 0})
    else:
        print(f"Input path: {input_path}")
        print(f"Output path: {output_path}")

    if torch.backends.mps.is_available():
        device.set(device=DeviceId.GPU0)
        if progress_callback:
            progress_callback({"status": "processing", "stage": "Device Check", "message": "Using MPS (Metal) acceleration.", "current_frame": 0, "total_frames": 0})
        else:
            print("Using MPS (Metal) acceleration.")
    else:
        device.set(device=DeviceId.CPU)
        if progress_callback:
            progress_callback({"status": "processing", "stage": "Device Check", "message": "MPS not available, using CPU (slower).", "current_frame": 0, "total_frames": 0})
        else:
            print("MPS not available, using CPU (slower).")

    original_load = torch.load
    def patched_load(*args, **kwargs):
        kwargs['weights_only'] = False
        return original_load(*args, **kwargs)
    torch.load = patched_load

    if progress_callback:
        progress_callback({"status": "processing", "stage": "Loading Model", "message": "Loading video colorizer...", "current_frame": 0, "total_frames": 0})
    else:
        print("Loading video colorizer...")
    colorizer = get_video_colorizer()
    torch.load = original_load

    if not os.path.exists(input_path):
        if progress_callback:
            progress_callback({"status": "error", "stage": "File Check", "message": f"Input file not found: {input_path}", "current_frame": 0, "total_frames": 0})
        raise FileNotFoundError(f"Input file not found: {input_path}") # Ensure f-string for clarity

    base_name = os.path.splitext(os.path.basename(input_path))[0]
    working_dir = tempfile.mkdtemp(prefix="deoldify_")
    if progress_callback:
        progress_callback({"status": "processing", "stage": "Setup", "message": f"Working directory: {working_dir}", "current_frame": 0, "total_frames": 0})
    else:
        print(f"Working directory: {working_dir}")

    original_cwd = os.getcwd()
    os.chdir(working_dir)

    try:
        if progress_callback:
            # Note: DeOldify's internal progress is not exposed here without major changes.
            # This stage covers the entire colorization process.
            progress_callback({"status": "processing", "stage": "Colorization (DeOldify)", "message": f"Starting DeOldify colorization for {input_path} with render_factor={render_factor}...", "current_frame": 0, "total_frames": 0}) # total_frames unknown for this part
        else:
            print(f"Colorizing {input_path} with render_factor={render_factor}...")

        result_path = colorizer.colorize_from_file_name(
            input_path,
            render_factor=render_factor,
            watermarked=False
        )
        if progress_callback:
            progress_callback({"status": "processing", "stage": "Colorization (DeOldify) Complete", "message": f"DeOldify colorization complete. Intermediate file at: {result_path}", "current_frame": 0, "total_frames": 0})
        else:
            print(f"Colorization complete, result path: {result_path}")

        output_dir = os.path.dirname(output_path)
        if output_dir:
            if progress_callback:
                progress_callback({"status": "processing", "stage": "Setup Output Dir", "message": f"Creating output directory if needed: {output_dir}", "current_frame": 0, "total_frames": 0})
            else:
                print(f"Creating output directory if needed: {output_dir}")
            os.makedirs(output_dir, exist_ok=True)

        if progress_callback:
            progress_callback({"status": "processing", "stage": "Moving File", "message": f"Moving {result_path} to {output_path}...", "current_frame": 0, "total_frames": 0})
        else:
            print(f"Moving {result_path} to {output_path}...")
        os.rename(result_path, output_path)
        if progress_callback:
            progress_callback({"status": "processing", "stage": "File Moved", "message": f"Colorized video (intermediate) saved at: {output_path}", "current_frame": 0, "total_frames": 0})
        else:
            print(f"Colorized video saved at: {output_path}")

        final_output_path = os.path.join(output_dir, f"{base_name}_final.mp4")
        # Initial message for post-processing before calling it.
        # The post_process_video function will then provide more granular updates.
        if progress_callback:
            progress_callback({"status": "processing", "stage": "Post-processing Init", "message": f"Preparing for post-processing {output_path} to {final_output_path}...", "current_frame": 0, "total_frames": 0})
        else:
            print(f"Post-processing {output_path} to {final_output_path}...")

        # Pass the callback to post_process_video
        post_process_video(output_path, final_output_path, saturation_scale, clahe_clip_limit, blend_factor, progress_callback=progress_callback)

        if progress_callback:
            progress_callback({"status": "processing", "stage": "Post-processing Complete", "message": f"Final video saved at: {final_output_path}", "current_frame": 0, "total_frames": 0}) # Final message, frame counts from post_process_video are intermediate
        else:
            print(f"Final video saved at: {final_output_path}")
        return final_output_path
    finally:
        os.chdir(original_cwd)
        if progress_callback:
            progress_callback({"status": "processing", "stage": "Cleanup", "message": f"Cleaning up working directory: {working_dir}", "current_frame": 0, "total_frames": 0})
        else:
            print(f"Cleaning up working directory: {working_dir}")
        shutil.rmtree(working_dir, ignore_errors=True)
        if progress_callback:
            progress_callback({"status": "processing", "stage": "Cleanup Complete", "message": "Cleanup complete.", "current_frame": 0, "total_frames": 0})
        else:
            print("Cleanup complete.")

def batch_colorize(input_dir, output_dir=DEFAULT_OUTPUT_DIR, render_factor=DEFAULT_RENDER_FACTOR, saturation_scale=DEFAULT_SATURATION_SCALE, clahe_clip_limit=DEFAULT_CLAHE_CLIP_LIMIT, blend_factor=DEFAULT_BLEND_FACTOR, progress_callback=None):
    os.makedirs(output_dir, exist_ok=True)

    input_files = glob.glob(os.path.join(input_dir, "**", "*.mp4"), recursive=True)
    if not input_files:
        if progress_callback:
            progress_callback({"status": "info", "stage": "Batch Scan", "message": f"No .mp4 files found in {input_dir}", "current_frame": 0, "total_frames": 0})
        else:
            print(f"No .mp4 files found in {input_dir}")
        return

    if progress_callback:
        progress_callback({"status": "info", "stage": "Batch Scan", "message": f"Found {len(input_files)} video(s) to process.", "current_frame": 0, "total_frames": len(input_files)})
    else:
        print(f"Found {len(input_files)} video(s) to process.")

    for i, input_file in enumerate(input_files):
        base_name = os.path.splitext(os.path.basename(input_file))[0]
        output_file = os.path.join(output_dir, f"{base_name}_color.mp4")
        final_output_file = os.path.join(output_dir, f"{base_name}_final.mp4")

        if progress_callback:
            progress_callback({"status": "processing", "stage": "Batch Item Start", "message": f"Processing video {i+1}/{len(input_files)}: {input_file}", "current_file_in_batch": i+1, "total_files_in_batch": len(input_files)})

        if os.path.exists(final_output_file):
            if progress_callback:
                progress_callback({"status": "skipped", "stage": "Batch Item Skip", "message": f"Skipping {input_file} -> {final_output_file} already exists."})
            else:
                print(f"Skipping {input_file} -> {final_output_file} already exists.")
            continue

        # No specific print here if progress_callback is active, it's handled by "Batch Item Start"
        elif not progress_callback:
            print(f"\nProcessing {input_file} -> {output_file}")

        try:
            colorize_video(input_file, output_file, render_factor, saturation_scale, clahe_clip_limit, blend_factor, progress_callback=progress_callback)
        except Exception as e:
            if progress_callback:
                progress_callback({"status": "error", "stage": "Batch Item Error", "message": f"Failed to process {input_file}: {e}"})
            else:
                print(f"Failed to process {input_file}: {e}")

if __name__ == "__main__":
    # Basic progress callback for command-line usage
    def cli_progress_callback(update):
        status = update.get("status", "info")
        stage = update.get("stage", "")
        message = update.get("message", "")
        print(f"[{status.upper()}] [{stage}] {message}")

    parser = argparse.ArgumentParser(description="Colorize B/W videos with DeOldify.")
    parser.add_argument("-input_dir", required=True, help="Directory containing input B/W video(s)")
    parser.add_argument("-output_dir", default=DEFAULT_OUTPUT_DIR, help="Directory to save colorized videos")
    # Add progress_callback to batch_colorize if needed for CLI, or handle prints directly
    parser.add_argument("-render_factor", type=int, default=DEFAULT_RENDER_FACTOR, help="Color intensity (10-40)")
    parser.add_argument("-saturation_scale", type=float, default=DEFAULT_SATURATION_SCALE, help="Saturation scaling factor (0.0-1.0)")
    parser.add_argument("-clahe_clip_limit", type=float, default=DEFAULT_CLAHE_CLIP_LIMIT, help="CLAHE clip limit (0.1-4.0)")
    parser.add_argument("-blend_factor", type=float, default=DEFAULT_BLEND_FACTOR, help="Blend factor for post-processing (0.0-1.0)")
    args = parser.parse_args()

    batch_colorize(args.input_dir, args.output_dir, args.render_factor, args.saturation_scale, args.clahe_clip_limit, args.blend_factor, progress_callback=cli_progress_callback)
