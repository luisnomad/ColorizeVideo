# Overview

This is a fork of DeOldify, a legacy project to colorize B/W videos. This fork contains a colorize_filter.py script, see [Instructions](INSTRUCTIONS.md) to see how to use it.

`colorize_filter.py` is a Python script that automates the colorization of black-and-white (B/W) videos using the DeOldify library, with additional post-processing to enhance visual quality and temporal consistency. Designed for batch processing, it processes multiple videos in a specified input directory, applies advanced colorization and post-processing techniques, and saves the results to a designated output directory. The script includes features to skip already-processed videos, suppress watermarks, and clean up temporary files, making it efficient for large-scale video remastering projects.

# Core Functionality

* **DeOldify Integration:** Leverages DeOldify’s `VideoColorizer` to colorize B/W videos frame-by-frame, utilizing pre-trained deep learning models to infer realistic colors. Supports GPU acceleration (MPS on Apple Silicon) for faster processing.
* **Batch Processing:** Processes all `.mp4` files in a specified input directory (and its subdirectories) recursively, making it ideal for handling multiple videos in one run.
* **Skip Check:** Skips videos that have already been processed (based on the existence of a `_final.mp4` file in the output directory), allowing the process to resume without reprocessing completed videos if interrupted.
* **Watermark Suppression:** Disables DeOldify’s default watermarking to produce clean output videos.
* **Temporary File Cleanup:** Cleans up temporary working files and directories created during the colorization process after each video is processed.
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

### Model Caching
To improve efficiency and reduce redundant downloads, the script implements a model caching mechanism:
*   **Automatic Caching:** The first time you run the script, the required DeOldify model files (e.g., `ColorizeVideo_gen.pth`) are downloaded from their official source.
*   **Local Storage:** These models are stored in a local cache directory, typically located at `~/.cache/deoldify/models/` (the exact path might vary slightly based on your operating system's conventions for user cache directories).
*   **Reduced Downloads:** On subsequent runs, the script will use the cached models, significantly speeding up initialization and avoiding repeated downloads.
*   **Internet Access:** Internet access is only required for the initial download of each model.

# Use Case

This script is particularly suited for remastering B/W videos with challenging lighting conditions, such as night scenes with dynamic elements (e.g., UFOs, starry skies, and desert landscapes). The post-processing steps address DeOldify’s limitations by reducing flickering, controlling saturation, and enhancing contrast, resulting in more natural and visually appealing colorized videos.

# Example Usage

To colorize all `.mp4` files in a directory:

```bash
python3 colorize_filter.py -input_dir /path/to/bw_clips -output_dir /path/to/colorized_videos -render_factor 21 -saturation_scale 0.8 -clahe_clip_limit 0.5 -blend_factor 0.6
```

* Outputs: For each `clip1.mp4`, produces `clip1_color.mp4` (raw DeOldify output) and `clip1_final.mp4` (post-processed) in the `output_dir`.

## Video Colorization UI Application

This project now includes a user-friendly web interface for colorizing videos, providing an alternative to the command-line script. It's built with a React frontend and a FastAPI backend, utilizing the same core `colorize_filter.py` engine.

### Installation & Setup

**Prerequisites:**
*   **Python:** Version 3.8-3.10 is recommended.
*   **Node.js:** LTS version recommended (e.g., 18.x or 20.x) along with npm (which comes with Node.js).

**1. Clone the Repository:**
If you haven't already, clone this repository to your local machine.
```bash
git clone <repository_url>
cd <repository_directory>
```

**2. Backend Setup:**
The backend server powers the video processing.
*   **Location:** `video_ui_app/backend/`
*   **Virtual Environment (Recommended):**
    Navigate to the backend directory and create/activate a Python virtual environment:
    ```bash
    cd video_ui_app/backend
    python -m venv venv_ui  # Or any name you prefer
    source venv_ui/bin/activate  # On Windows: venv_ui\Scripts\activate
    ```
*   **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
*   **Crucial Note on Dependencies:** The local `deoldify` library (which includes components from `fastai`) has a significant number of dependencies, including `torch`, `opencv-python`, and various other data science and utility packages. All these necessary packages, with their specific versions, are listed in the `video_ui_app/backend/requirements.txt` file. Ensure you install them using `pip install -r video_ui_app/backend/requirements.txt` in your activated virtual environment.
        The installation, particularly for `torch`, can be lengthy and require several gigabytes of disk space and a stable internet connection. Please be patient during this process. If you encounter issues, verify your Python version, internet connection, and available disk space.

**3. Frontend Setup:**
The frontend provides the web interface.
*   **Location:** `video_ui_app/frontend/`
*   **Install Dependencies:**
    Navigate to the frontend directory and install npm packages:
    ```bash
    cd video_ui_app/frontend
    npm install
    ```
    (If you were previously in the backend directory, you might use `cd ../frontend` or `cd /path/to/repository/video_ui_app/frontend`)

### Running the Application

**Step 1: Start the Backend Server**
*   Open a terminal.
*   Navigate to the **project root directory** (e.g., `/path/to/repository/`, the directory that contains `video_ui_app/` and `deoldify/`).
*   Activate your Python virtual environment (which was created inside `video_ui_app/backend/`):
    ```bash
    source video_ui_app/backend/venv_ui/bin/activate
    # On Windows: video_ui_app\backend\venv_ui\Scripts\activate
    ```
    *You should see `(venv_ui)` at the beginning of your terminal prompt. The path to activate is relative to your current directory (the project root).*
*   Start the Uvicorn server:
    ```bash
    python -m uvicorn video_ui_app.backend.main:app --host 0.0.0.0 --port 8000
    ```
    *   Running from the project root and specifying the module path like `video_ui_app.backend.main:app` helps Python correctly recognize the backend as a package, resolving relative import issues and ensuring the local `deoldify` library is correctly imported.
    *   `--host 0.0.0.0`: Makes the server accessible from other devices on your network. Use `127.0.0.1` to restrict to local machine only.
    *   `--port 8000`: Specifies the port. Change if 8000 is in use.

**Step 2: Start the Frontend Development Server**
*   Open a **new** terminal (leave the backend server running in its own terminal).
*   Navigate to the frontend directory: `cd /path/to/repository/video_ui_app/frontend`
*   Start the Vite development server:
    ```bash
    npm run dev
    ```
    *   The terminal will typically display the local address where the frontend is being served (e.g., `http://localhost:5173`).

**Step 3: Access the UI**
*   Open your web browser.
*   Navigate to the address shown by the frontend development server (e.g., `http://localhost:5173`).

### Features

*   **Video Upload:** Easily upload videos using a drag-and-drop area or a traditional file selection dialog.
*   **Parameter Configuration:**
    *   Adjust colorization parameters like `Render Factor`, `Saturation Scale`, `CLAHE Clip Limit`, and `Blend Factor` using intuitive sliders.
    *   Hover over parameter labels to see tooltips explaining their effects.
    *   Default values are pre-filled based on the `colorize_filter.py` script.
*   **Real-Time Processing Progress:**
    *   Monitor the video colorization process in real-time.
    *   The UI displays the current status, stage of processing (e.g., "Loading Model", "Colorization (DeOldify)", "Post-processing"), and detailed messages from the backend.
    *   For the post-processing stage, frame-by-frame progress (`current_frame`/`total_frames`) is shown.
*   **Results & Download:**
    *   Once processing is complete, the UI indicates the final status.
    *   A list of processed videos is available, with "Download" links for successfully colorized videos.
*   **Cache Management:**
    *   View current disk space usage for processed videos and uploaded original files.
    *   "Clear Space" option for individual videos to delete both the processed output and the uploaded original.
    *   "Clear All Cache" option to remove all processed videos, all uploaded originals, and clear the task history from the server's memory.
    *   Confirmation dialogs are provided for deletion actions.

### Troubleshooting

*   **`ModuleNotFoundError` (e.g., `No module named 'fastapi'`, `'torch'`, `'pandas'`, etc.):**
    *   **Is the Python virtual environment active?** When you run `pip install ...` and `python -m uvicorn ...`, your terminal prompt should indicate the active environment (e.g., `(venv_ui)`). If not, activate it:
        ```bash
        # Assuming you are in the project root directory
        source video_ui_app/backend/venv_ui/bin/activate
        # On Windows: video_ui_app\backend\venv_ui\Scripts\activate
        ```
    *   **Were all dependencies installed from `requirements.txt`?** The `video_ui_app/backend/requirements.txt` file lists all necessary Python packages. Ensure you have installed them correctly within the active virtual environment:
        ```bash
        # Assuming you are in the project root and venv is active
        pip install -r video_ui_app/backend/requirements.txt
        ```
        Watch for any errors during this installation. If it was interrupted, run it again.
*   **Backend server fails to start (after checking dependency issues):**
    *   Ensure your Python virtual environment is active (see above).
    *   Verify all dependencies were installed correctly from `video_ui_app/backend/requirements.txt` (see above).
    *   Check if the port (e.g., 8000) is already in use by another application. Try a different port if necessary.
*   **Frontend server fails to start (`npm run dev`):**
    *   Ensure you have run `npm install` in the `video_ui_app/frontend` directory.
    *   Check for any error messages in the terminal; they often indicate missing dependencies or configuration issues.
*   **UI cannot connect to the backend / Videos don't process:**
    *   Confirm the backend server is running and accessible.
    *   Check browser's developer console (Network tab) for failed API requests (e.g., to `/api/process_video`). This can indicate issues with backend routing, CORS (though FastAPI is usually configured for this in dev), or incorrect port assumptions.
*   **Video processing fails partway through:**
    *   Check the backend server's console output for error messages from `colorize_filter.py` or Uvicorn.
    *   Ensure the uploaded video is in a common format (e.g., `.mp4`) and is not corrupted.
    *   Very large or high-resolution videos might exhaust system resources (RAM, VRAM if using GPU).
*   **Slow performance:**
    *   Video colorization, especially the DeOldify model processing, is computationally intensive. Performance will be significantly slower without a compatible GPU.
    *   The post-processing step also adds to the overall time.
*   **Python Dependency Issues (especially for `torch` and its related packages):**
    *   These are large libraries. Installation issues are common due to:
        *   **Internet connection:** Interrupted downloads can corrupt packages.
        *   **Disk space:** Insufficient disk space.
        *   **Python version:** Ensure compatibility (3.8-3.10 recommended).
        *   **Operating System / Build tools:** Some packages might have system-level dependencies.
    *   Try reinstalling problematic packages in the activated virtual environment. Consider using a wired internet connection for large downloads.
