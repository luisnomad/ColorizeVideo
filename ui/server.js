const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (for accessing uploaded and output videos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/colorized_videos', express.static(path.join(__dirname, 'colorized_videos')));

// Set up file upload with multer
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'colorized_videos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
});
const upload = multer({ storage });

// Map to store processing status
const processingStatus = new Map();

// Endpoint to upload videos and start processing
app.post('/upload', upload.array('videos'), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded.' });
        }

        const videoIds = files.map((file, index) => `video-${Date.now()}-${index}`);
        const filePaths = files.map(file => file.path);

        // Initialize processing status for each video
        videoIds.forEach((videoId, index) => {
            processingStatus.set(videoId, {
                filePath: filePaths[index],
                progress: 0,
                status: 'pending',
                error: null,
                output: null,
            });
        });

        // Start processing each video
        videoIds.forEach((videoId, index) => {
            processVideo(videoId, filePaths[index]);
        });

        res.json({ videoIds, filePaths });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get processing progress
app.get('/progress/:videoId', (req, res) => {
    const videoId = req.params.videoId;
    const status = processingStatus.get(videoId);
    if (!status) {
        return res.status(404).json({ error: 'Video not found.' });
    }
    res.json({
        progress: status.progress,
        status: status.status,
        error: status.error,
        output: status.output,
    });
});

// Function to process a video
async function processVideo(videoId, filePath) {
    processingStatus.set(videoId, { ...processingStatus.get(videoId), status: 'processing' });

    try {
        const scriptPath = path.resolve(__dirname, 'colorize_deoldify.py');
        const args = [
            '-input',
            filePath,
            '-output_dir',
            outputDir,
        ];

        const process = spawn('python3', [scriptPath, ...args]);

        let progress = 0;
        let errorMessage = null;

        process.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.progress) {
                        progress = parsed.progress.percentage;
                        processingStatus.set(videoId, {
                            ...processingStatus.get(videoId),
                            progress,
                        });
                    }
                } catch (e) {
                    if (line.includes('Failed to process')) {
                        errorMessage = line;
                    }
                }
            }
        });

        process.stderr.on('data', (data) => {
            errorMessage = data.toString();
        });

        process.on('close', (code) => {
            if (code !== 0) {
                processingStatus.set(videoId, {
                    ...processingStatus.get(videoId),
                    status: 'failed',
                    error: errorMessage || `Process exited with code ${code}`,
                });
                return;
            }

            const baseName = path.basename(filePath, path.extname(filePath));
            const colorizedPath = path.join(outputDir, `${baseName}_color.mp4`);
            const postprocessedPath = path.join(outputDir, `${baseName}_final.mp4`);

            const outputExists = (file) => (fs.existsSync(file) ? `/colorized_videos/${path.basename(file)}` : '');

            processingStatus.set(videoId, {
                ...processingStatus.get(videoId),
                progress: 100,
                status: 'completed',
                output: {
                    original: `/uploads/${path.basename(filePath)}`,
                    colorized: outputExists(colorizedPath),
                    postprocessed: outputExists(postprocessedPath),
                },
            });
        });

        process.on('error', (err) => {
            processingStatus.set(videoId, {
                ...processingStatus.get(videoId),
                status: 'failed',
                error: `Failed to spawn process: ${err.message}`,
            });
        });
    } catch (error) {
        processingStatus.set(videoId, {
            ...processingStatus.get(videoId),
            status: 'failed',
            error: error.message,
        });
    }
}

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
