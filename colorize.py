import argparse
import os
import torch
import shutil
import glob
from deoldify import device
from deoldify.device_id import DeviceId
from deoldify.visualize import get_video_colorizer

def colorize_video(input_path, output_path, render_factor=15):
    # Convert paths to absolute
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)
    print(f"Input path: {input_path}")
    print(f"Output path: {output_path}")

    # Set device to MPS (Metal) for M1/M2, fallback to CPU
    if torch.backends.mps.is_available():
        device.set(device=DeviceId.GPU0)
        print("Using MPS (Metal) acceleration.")
    else:
        device.set(device=DeviceId.CPU)
        print("MPS not available, using CPU (slower).")

    # Patch torch.load to use weights_only=False
    original_load = torch.load
    def patched_load(*args, **kwargs):
        kwargs['weights_only'] = False
        return original_load(*args, **kwargs)
    torch.load = patched_load

    # Load the video colorizer
    print("Loading video colorizer...")
    colorizer = get_video_colorizer()
    torch.load = original_load  # Restore original

    # Ensure input file exists
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Create a unique working directory for this video to avoid conflicts
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    working_dir = os.path.join(os.path.dirname(input_path), f"deoldify_{base_name}")
    os.makedirs(working_dir, exist_ok=True)
    print(f"Working directory: {working_dir}")

    # Temporarily change working directory to control output location
    original_cwd = os.getcwd()
    os.chdir(working_dir)

    try:
        # Colorize the video without watermark
        print(f"Colorizing {input_path} with render_factor={render_factor}...")
        result_path = colorizer.colorize_from_file_name(
            input_path,
            render_factor=render_factor,
            watermarked=False
        )
        print(f"Colorization complete, result path: {result_path}")

        # Expected output is in video/result/[base_name].mp4
        expected_result = os.path.join("video", "result", f"{base_name}.mp4")
        if not os.path.exists(expected_result):
            raise RuntimeError(f"Colorization failed, expected result not found: {expected_result}")

        # Move the result to the desired output path
        output_dir = os.path.dirname(output_path)
        if output_dir:
            print(f"Creating output directory if needed: {output_dir}")
            os.makedirs(output_dir, exist_ok=True)
        print(f"Moving {expected_result} to {output_path}...")
        os.rename(expected_result, output_path)
        print(f"Colorized video saved at: {output_path}")

    finally:
        # Restore original working directory
        os.chdir(original_cwd)
        # Clean up the working directory
        print(f"Cleaning up working directory: {working_dir}")
        shutil.rmtree(working_dir, ignore_errors=True)
        print("Cleanup complete.")

def batch_colorize(input_dir, output_dir, render_factor=15):
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Find all .mp4 files in input_dir (recursively)
    input_files = glob.glob(os.path.join(input_dir, "**", "*.mp4"), recursive=True)
    if not input_files:
        print(f"No .mp4 files found in {input_dir}")
        return

    print(f"Found {len(input_files)} video(s) to process.")
    for input_file in input_files:
        # Generate output filename
        base_name = os.path.splitext(os.path.basename(input_file))[0]
        output_file = os.path.join(output_dir, f"{base_name}_color.mp4")
        print(f"\nProcessing {input_file} -> {output_file}")
        try:
            colorize_video(input_file, output_file, render_factor)
        except Exception as e:
            print(f"Failed to process {input_file}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Colorize B/W videos with DeOldify.")
    parser.add_argument("-input_dir", required=True, help="Directory containing input B/W video(s)")
    parser.add_argument("-output_dir", default="colorized_videos", help="Directory to save colorized videos")
    parser.add_argument("-render_factor", type=int, default=25, help="Color intensity (10-40, default 15)")
    args = parser.parse_args()

    batch_colorize(args.input_dir, args.output_dir, args.render_factor)