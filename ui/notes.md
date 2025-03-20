# Project Setup and Workflow

This document outlines the steps to set up the B&W Colorizer project and explains how it works.

## Step 1: Project Description

- The B&W Colorizer project allows users to upload video files, which are then processed to add color.
- The processing involves a backend server (Node.js) that manages file uploads, spawns a Python script for colorization, and tracks the progress.
- The frontend (React) provides a user interface for uploading files, monitoring progress, and displaying the colorized videos.

## Step 2: Project Structure
The project has the following directory structure:

project/
├── ui/
│   
├── ui_draft.jsx│   
└── ... (other React files)
├── server.js
├── colorize_deoldify.py
├── uploads/           (created by server)
└── colorized_videos/  (created by server)

## Step 3: Set Up the Project

### Directory Structure

project/
├── ui/│   
├── ui_draft.jsx
│   └── ... (other React files)├── server.js
├── colorize_deoldify.py
├── uploads/           (created by server)
└── colorized_videos/  (created by server)

### Install Dependencies

#### Backend:

```bash
npm init -y
npm install express multer cors axios
```

#### Frontend:

```bash
npm install axios
```

*Run the Backend*

```bash
node server.js
```

The server runs on http://localhost:3001.

*Run the Frontend*

Assuming your React app is set up with a development server:

```bash
npm start
```

The React app typically runs on http://localhost:3000.

#### How It Works

1. File Upload:
  - The user drags and drops videos or selects them via the file input.
  - The frontend sends the files to the backend via a POST /upload request using FormData.
2. Processing:
  - The backend saves the uploaded files to the uploads/ directory.
  - For each file, it spawns a colorize_deoldify.py process with the -input argument, passing the file path and output_dir.
  - The backend tracks progress by parsing the script’s JSON output and stores the status in processingStatus.
3. Progress Polling:
  - The frontend polls the backend (GET /progress/:videoId) every 500ms to get the latest progress, status, and output.
  - Updates the UI’s progress bar and video card status accordingly.Output Display:Once processing is complete, the backend returns the URLs to the original (/uploads/...), colorized (/colorized_videos/..._color.mp4), and post-processed (/colorized_videos/..._final.mp4) videos.
  - The frontend displays these videos with playable controls.
  
#### Notes

- CORS: The backend includes cors middleware to allow requests from the frontend (e.g., http://localhost:3000).
- File Access: The backend serves the uploads/ and colorized_videos/ directories statically, so the frontend can access the video files via URLs.
- Error Handling: The frontend displays errors from the backend or script, and the retry button allows reprocessing a failed video.
- Security: In a production environment, add authentication, input validation, and rate limiting to the backend.
