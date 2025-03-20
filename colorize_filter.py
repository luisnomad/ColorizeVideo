import argparse
import os
import torch
import shutil
import glob
import cv2
import numpy as np
import json
import sys
import re
from deoldify import device
from deoldify.device_id import DeviceId
from deoldify.visualize import get_video_colorizer
import warnings
from tqdm import tqdm

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

def colorize_video(input_path, output_path, render_factor=DEFAULT_RENDER_FACTOR, saturation_scale=DEFAULT_SATURATION_SCALE, clahe_clip_limit=DEFAULT_CLAHE_CLIP_LIMIT, blend_factor=DEFAULT_BLEND_FACTOR):
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)
    print(f"Input path: {input_path}")
    print(f"Output path: {output_path}")

    if torch.backends.mps.is_available():
        device.set(device=DeviceId.GPU0)
        print("Using MPS (Metal) acceleration.")
    else:
        device.set(device=DeviceId.CPU)
        print("MPS not available, using CPU (slower).")

    original_load = torch.load
    def patched_load(*args, **kwargs):
        kwargs['weights_only'] = False
        return original_load(*args, **kwargs)
    torch.load = patched_load

    print("Loading video colorizer...")
    colorizer = get_video_colorizer()
    torch.load = original_load

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    base_name = os.path.splitext(os.path.basename(input_path))[0]
    working_dir = os.path.join(os.path.dirname(input_path), f"deoldify_{base_name}")
    os.makedirs(working_dir, exist_ok=True)
    print(f"Working directory: {working_dir}")

    original_cwd = os.getcwd()
    os.chdir(working_dir)

    try:
        print(f"Colorizing {input_path} with render_factor={render_factor}...")

        # Custom progress callback to output JSON
        def progress_callback(current, total):
            percentage = (current / total) * 100
            progress_data = {
                "progress": {
                    "current": current,
                    "total": total,
                    "percentage": percentage
                }
            }
            print(json.dumps(progress_data), flush=True)

        # Monkey-patch tqdm in DeOldify to use our callback
        original_tqdm = tqdm
        class CustomTqdm(original_tqdm):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._current = 0
                self._total = self.total

            def update(self, n=1):
                self._current += n
                progress_callback(self._current, self._total)
                super().update(n)

        tqdm.tqdm = CustomTqdm

        try:
            result_path = colorizer.colorize_from_file_name(
                input_path,
                render_factor=render_factor,
                watermarked=False
            )
        finally:
            tqdm.tqdm = original_tqdm  # Restore original tqdm

        print(f"Colorization complete, result path: {result_path}")

        expected_result = os.path.join("video", "result", f"{base_name}.mp4")
        if not os.path.exists(expected_result):
            raise RuntimeError(f"Colorization failed, expected result not found: {expected_result}")

        output_dir = os.path.dirname(output_path)
        if output_dir:
            print(f"Creating output directory if needed: {output_dir}")
            os.makedirs(output_dir, exist_ok=True)
        print(f"Moving {expected_result} to {output_path}...")
        os.rename(expected_result, output_path)
        print(f"Colorized video saved at: {output_path}")

        final_output_path = os.path.join(output_dir, f"{base_name}_final.mp4")
        print(f"Post-processing {output_path} to {final_output_path}...")
        post_process_video(output_path, final_output_path, saturation_scale, clahe_clip_limit, blend_factor)
        print(f"Final video saved at: {final_output_path}")

    finally:
        os.chdir(original_cwd)
        print(f"Cleaning up working directory: {working_dir}")
        shutil.rmtree(working_dir, ignore_errors=True)
        print("Cleanup complete.")

def batch_colorize(input_files=None, input_dir=None, output_dir=DEFAULT_OUTPUT_DIR, render_factor=DEFAULT_RENDER_FACTOR, saturation_scale=DEFAULT_SATURATION_SCALE, clahe_clip_limit=DEFAULT_CLAHE_CLIP_LIMIT, blend_factor=DEFAULT_BLEND_FACTOR, recursive=False):
    os.makedirs(output_dir, exist_ok=True)

    # Determine the list of files to process
    if input_files:
        files_to_process = input_files
    elif input_dir:
        files_to_process = glob.glob(os.path.join(input_dir, "*.mp4"), recursive=recursive)
    else:
        print("Either input_files or input_dir must be provided.")
        return

    if not files_to_process:
        print("No input files provided or found.")
        return

    print(f"Found {len(files_to_process)} video(s) to process.")
    for input_file in files_to_process:
        # Check if the input file is already a colorized output
        if re.search(r'_(color|final)\.mp4$', input_file):
            print(f"Skipping {input_file} -> appears to be a colorized output.")
            continue

        base_name = os.path.splitext(os.path.basename(input_file))[0]
        output_file = os.path.join(output_dir, f"{base_name}_color.mp4")
        final_output_file = os.path.join(output_dir, f"{base_name}_final.mp4")
        
        # Skip if both output files already exist
        if os.path.exists(output_file) and os.path.exists(final_output_file):
            print(f"Skipping {input_file} -> {output_file} and {final_output_file} already exist.")
            continue

        print(f"\nProcessing {input_file} -> {output_file}")
        try:
            colorize_video(input_file, output_file, render_factor, saturation_scale, clahe_clip_limit, blend_factor)
        except Exception as e:
            print(f"Failed to process {input_file}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Colorize B/W videos with DeOldify.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("-input", nargs='+', help="List of input B/W video file paths")
    group.add_argument("-input_dir", help="Directory containing input B/W video(s)")
    parser.add_argument("-output_dir", default=DEFAULT_OUTPUT_DIR, help="Directory to save colorized videos")
    parser.add_argument("-render_factor", type=int, default=DEFAULT_RENDER_FACTOR, help="Color intensity (10-40)")
    parser.add_argument("-saturation_scale", type=float, default=DEFAULT_SATURATION_SCALE, help="Saturation scaling factor (0.0-1.0)")
    parser.add_argument("-clahe_clip_limit", type=float, default=DEFAULT_CLAHE_CLIP_LIMIT, help="CLAHE clip limit (0.1-4.0)")
    parser.add_argument("-blend_factor", type=float, default=DEFAULT_BLEND_FACTOR, help="Blend factor for post-processing (0.0-1.0)")
    parser.add_argument("-recursive", action="store_true", help="Recursively scan input_dir for .mp4 files")
    args = parser.parse_args()

    batch_colorize(
        input_files=args.input,
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        render_factor=args.render_factor,
        saturation_scale=args.saturation_scale,
        clahe_clip_limit=args.clahe_clip_limit,
        blend_factor=args.blend_factor,
        recursive=args.recursive
    )
