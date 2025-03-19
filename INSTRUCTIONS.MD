# ColorizeVideo Video Colorizer with Temporal Consistency

This script colorizes black and white videos using the DeOldify library and applies post-processing (histogram matching and blending) with OpenCV to improve temporal consistency and reduce flickering.

## Installation Instructions

1.  **Clone the ColorizeVideo Repository:**

    ```bash
    git clone [https://github.com/luisnomad/ColorizeVideo.git](https://github.com/luisnomad/ColorizeVideo.git)
    cd ColorizeVideo
    ```

2.  **Create a Virtual Environment (Recommended):**

    Using a virtual environment isolates the project's dependencies and prevents conflicts with other Python projects.  You can use `venv` (recommended) or `conda`.

    *   **Using `venv` (Python 3's built-in virtual environment):**
        ```bash
        python3 -m venv deoldify_env  # Create the environment
        source deoldify_env/bin/activate  # Activate the environment (macOS/Linux)
        # deoldify_env\Scripts\activate  # Activate on Windows (CMD)
        # deoldify_env\Scripts\Activate.ps1 # Activate on Windows (PowerShell)
        ```

    *   **Using `conda`:**
        ```bash
        conda create -n deoldify_env python=3.9  # Create the environment
        conda activate deoldify_env       # Activate the environment
        ```
        (Replace `3.9` with your desired Python version if necessary. 3.8, 3.9, 3.10 are good choices.)

3.  **Install Dependencies:**

    With the virtual environment activated, install the required packages:

    ```bash
    pip install torch torchvision torchaudio --index-url [https://download.pytorch.org/whl/cpu](https://download.pytorch.org/whl/cpu)  # For CPU
    # OR, for MPS (Apple Silicon M1/M2/M3):
    # pip install torch torchvision torchaudio
    pip install deoldify opencv-python
    ```
    *If you have a compatible NVIDIA GPU, you can install a GPU-enabled version of PyTorch for significantly faster processing.  Refer to the official PyTorch installation guide for instructions:* [https://pytorch.org/get-started/locally/](https://pytorch.org/get-started/locally/)

4. **Download Pre-trained Weights**
    * You need to download and place the pre-trained weights:
        ```bash
        mkdir models
        wget [https://data.deepai.org/deoldify/ColorizeVideo_gen.pth](https://www.google.com/search?q=https://data.deepai.org/deoldify/ColorizeVideo_gen.pth) -O ./models/ColorizeVideo_gen.pth
        ```

5.  **Place the Script:**

    Copy the `colorize_filter.py` script (the Python code from the previous responses) into the `DeOldify` directory (the same directory where you have the `models` folder).

## Environment Activation

Before running the script, *always* activate your virtual environment:

*   **Using `venv`:**
    ```bash
    source deoldify_env/bin/activate  # macOS/Linux
    # deoldify_env\Scripts\activate  # Windows (CMD)
    # deoldify_env\Scripts\Activate.ps1 # Windows (PowerShell)
    ```

*   **Using `conda`:**
    ```bash
    conda activate deoldify_env
    ```

You should see `(deoldify_env)` at the beginning of your terminal prompt when the environment is active.

## Script Usage

```bash
python colorize_filter.py -input_dir <input_directory> [options]
```

## Arguments:

- input_dir (required): The directory containing the black and white MP4 video files you want to colorize. The script searches recursively within this directory.
- output_dir (optional): The directory where the colorized videos will be saved. Defaults to colorized_videos in the current working directory.
- render_factor (optional): Controls the color intensity. Higher values produce more vibrant colors, but can also introduce artifacts. Values between 10 and 40 are reasonable. Default: 21.
- saturation_scale (optional): Scales the saturation of the colorized frames. Values less than 1.0 reduce saturation, which can help prevent over-saturated colors. Default: 0.8.
- clahe_clip_limit (optional): Controls the contrast enhancement applied during histogram matching. Lower values reduce noise amplification. Default: 0.5.
- blend_factor (optional): Controls the blending between the original DeOldify frame and the histogram-matched frame. Values around 0.5 provide a good balance. Default: 0.6.

### Example

```bash
python colorize_filter.py -input_dir "/path/to/my/bw_videos" -output_dir "my_colorized_videos" -render_factor 25 -saturation_scale 0.7 -clahe_clip_limit 0.3 -blend_factor 0.7
```

### Explanation of Parameters and How to Tweak Them

- render_factor: This is a core DeOldify parameter.  Experiment to find a balance between color vibrancy and artifact reduction.  Start with the default and increase/decrease in small increments.
- saturation_scale:  DeOldify can sometimes produce overly saturated colors. Reduce this value (e.g., to 0.7 or 0.6) if the colors look too intense.  Increase it (up to 1.0) if the colors are too dull.
- clahe_clip_limit: This is crucial for controlling noise.  If the output video looks noisy, reduce this value.  Start with the default (0.5) and decrease it further (e.g., 0.3, 0.1) if necessary.  Higher values will increase contrast but also amplify noise.
- blend_factor:  This controls how much the histogram matching affects the final result.  A value of 0.0 would use only the original DeOldify frames (no post-processing).  A value of 1.0 would use only the histogram-matched frames.  Values between 0.3 and 0.7 often work well.  Higher values give more temporal consistency but might slightly reduce the "vibrancy" of the DeOldify colorization.

## Workflow

1. Initial Run: Start with the default parameter values.
2. Evaluate: Carefully examine the output video. Look for:
    * Flickering: Is there noticeable flickering between frames?
    * Noise: Is there excessive graininess or noise, especially in areas of smooth color?
    * Color Saturation: Are the colors too intense or too dull?
    * Artifacts: Are there any strange visual distortions or unnatural-looking patterns?
3. Adjust Parameters: Based on your evaluation, adjust the parameters:
    * Reduce Flickering: Increase blend_factor.
    * Reduce Noise: Decrease clahe_clip_limit.
    * Adjust Saturation: Modify saturation_scale.
    * Adjust Color Vibrancy (DeOldify): Modify render_factor.
4. Repeat: Iterate through steps 2 and 3 until you achieve a satisfactory result. It often takes some experimentation to find the optimal settings for a particular video.

### Important Notes:

* Processing Time: Video colorization can be computationally intensive. Processing time will depend on the video length, resolution, your hardware (CPU/GPU), and the chosen parameters.
* Output Format: The script outputs MP4 videos using the H.264 codec (avc1). This is a widely compatible format.
* Scene Cuts: The post-processing is not aware of scene cuts. If the frames have a big difference, the post-processing step may produce bad results.
* Virtual Environment: Always activate your virtual environment before running the scrip