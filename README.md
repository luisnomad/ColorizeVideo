# Overview

This is a fork of DeOldify, a legacy project to colorize B/W videos. This fork contains a colorize_filter.py script, see [Instructions](INSTRUCTIONS.md) to see how to use it.

`colorize_deoldify.py` is a Python script that automates the colorization of black-and-white (B/W) videos using the DeOldify library, with additional post-processing to enhance visual quality and temporal consistency. Designed for batch processing, it processes multiple videos in a specified input directory, applies advanced colorization and post-processing techniques, and saves the results to a designated output directory. The script includes features to skip already-processed videos, suppress watermarks, and clean up temporary files, making it efficient for large-scale video remastering projects.

# Core Functionality

* **DeOldify Integration:** Leverages DeOldify’s `VideoColorizer` to colorize B/W videos frame-by-frame, utilizing pre-trained deep learning models to infer realistic colors. Supports GPU acceleration (MPS on Apple Silicon) for faster processing.
* **Batch Processing:** Processes all `.mp4` files in a specified input directory (and its subdirectories) recursively, making it ideal for handling multiple videos in one run.
* **Skip Check:** Skips videos that have already been processed (based on the existence of a `_final.mp4` file in the output directory), allowing the process to resume without reprocessing completed videos if interrupted.
* **Watermark Suppression:** Disables DeOldify’s default watermarking to produce clean output videos.
* **Temporary File Cleanup:** Removes DeOldify’s temporary working directories (`deoldify_[input_name]`) after processing each video, keeping the project folder organized.
* **Customizable Output:** Saves two files per video in the specified `output_dir`:
    * `[base_name]_color.mp4`: The raw DeOldify colorized output.
    * `[base_name]_final.mp4`: The post-processed video with enhanced quality.

# Enhancements Over DeOldify

While DeOldify provides robust colorization, it can suffer from issues like temporal inconsistency (flickering between frames), oversaturation, and lack of contrast control. This script builds on DeOldify by adding the following post-processing and workflow improvements:

* **Post-Processing with Histogram Matching:**
    * **Purpose:** Reduces flickering and improves temporal consistency by matching the histogram of each frame to the previous frame.
    * **Implementation:** Converts frames to LAB color space, applies histogram matching per channel, and converts back to BGR. This ensures smoother color transitions across frames, which is particularly beneficial for night scenes with dynamic elements like UFOs.
* **Saturation Control:**
    * **Purpose:** Prevents oversaturation, a common issue with DeOldify’s vibrant colorization, especially in low-light scenes.
    * **Implementation:** Converts the frame to HSV color space and scales the saturation channel by a configurable factor (`saturation_scale`, default 0.8). This allows fine-tuning of color intensity, ensuring natural-looking results (e.g., for UFO glows and night skies).
* **Contrast Adjustment Using CLAHE:**
    * **Purpose:** Enhances contrast while avoiding noise amplification, improving the visibility of details in dark or low-contrast scenes.
    * **Implementation:** Applies Contrast Limited Adaptive Histogram Equalization (CLAHE) to each channel in LAB color space, with a configurable clip limit (`clahe_clip_limit`, default 0.5) and tile grid size (8x8). This ensures balanced contrast enhancement, making elements like desert landscapes and starry skies more defined.
* **Blending for Balanced Output:**
    * **Purpose:** Balances the original DeOldify colorization with the post-processed frame to preserve DeOldify’s color predictions while benefiting from temporal consistency and contrast adjustments.
    * **Implementation:** Uses `cv2.addWeighted` to blend the original frame with the post-processed frame, controlled by a `blend_factor` (default 0.6). A value of 0.6 leans slightly toward the post-processed frame, ensuring smoother transitions while retaining DeOldify’s colorization.

# Additional Features

* **Configurable Parameters:** Allows customization of `render_factor` (color intensity), `saturation_scale`, `clahe_clip_limit`, and `blend_factor` via command-line arguments, enabling fine-tuning for different scenes.
* **Warning Suppression:** Suppresses FastAI and torchvision warnings for a cleaner output log.
* **Efficient Workflow:** Designed for batch processing with minimal user intervention, ideal for remastering projects with many short clips (e.g., 5-second B/W videos).

# Use Case

This script is particularly suited for remastering B/W videos with challenging lighting conditions, such as night scenes with dynamic elements (e.g., UFOs, starry skies, and desert landscapes). The post-processing steps address DeOldify’s limitations by reducing flickering, controlling saturation, and enhancing contrast, resulting in more natural and visually appealing colorized videos.

# Example Usage

To colorize all `.mp4` files in a directory:

```bash
python3 colorize_deoldify.py -input_dir /path/to/bw_clips -output_dir /path/to/colorized_videos -render_factor 21 -saturation_scale 0.8 -clahe_clip_limit 0.5 -blend_factor 0.6
```

* Outputs: For each `clip1.mp4`, produces `clip1_color.mp4` (raw DeOldify output) and `clip1_final.mp4` (post-processed) in the `output_dir`.

## Roadmap

I am planning to add the following features:
- Dockerized app for easy installations
- Web interface to allow processing multiple videos, with progress indicator and side by side compare tool.
