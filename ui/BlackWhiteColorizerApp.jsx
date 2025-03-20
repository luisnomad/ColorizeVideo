import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, Film, File, FileVideo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { spawn } from 'child_process';
import path from 'path';

// ===============================
// Service (Interacts with colorize_deoldify.py)
// ===============================

const service = {
    processVideos: (files, outputDir) => {
        return new Promise((resolve, reject) => {
            if (!files || files.length === 0) {
                reject(new Error("No files selected."));
                return;
            }

            // Map File objects to their paths
            const filePaths = Array.from(files).map(file => file.path);
            const videoIds = filePaths.map((filePath, index) => `video-${Date.now()}-${index}`);

            // Resolve immediately with video IDs and file paths
            resolve({ videoIds, filePaths });
        });
    },

    processVideo: (videoId, filePath, outputDir) => {
        return new Promise((resolve, reject) => {
            const scriptPath = path.resolve(__dirname, 'colorize_deoldify.py');
            const args = [
                scriptPath,
                '-input',
                filePath,
                '-output_dir',
                outputDir,
            ];

            const process = spawn('python3', args);

            let progress = 0;
            let errorMessage = null;

            // Parse stdout for progress updates
            process.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.progress) {
                            progress = parsed.progress.percentage;
                        }
                    } catch (e) {
                        // Not a JSON line, could be a log message
                        if (line.includes('Failed to process')) {
                            errorMessage = line;
                        }
                    }
                }
            });

            // Capture stderr for errors
            process.stderr.on('data', (data) => {
                errorMessage = data.toString();
            });

            // Handle process exit
            process.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(errorMessage || `Process exited with code ${code}`));
                    return;
                }

                const baseName = path.basename(filePath, path.extname(filePath));
                const colorizedPath = path.join(outputDir, `${baseName}_color.mp4`);
                const postprocessedPath = path.join(outputDir, `${baseName}_final.mp4`);

                // Check if output files exist
                const outputExists = (file) => {
                    try {
                        return fs.existsSync(file) ? file : '';
                    } catch {
                        return '';
                    }
                };

                resolve({
                    progress,
                    output: {
                        original: filePath,
                        colorized: outputExists(colorizedPath),
                        postprocessed: outputExists(postprocessedPath),
                    },
                });
            });

            process.on('error', (err) => {
                reject(new Error(`Failed to spawn process: ${err.message}`));
            });
        });
    },

    getVideoProcessingProgress: (videoId, processPromise) => {
        return new Promise((resolve) => {
            processPromise.then(({ progress }) => {
                resolve(progress);
            }).catch(() => {
                resolve(0); // In case of error, return 0 progress
            });
        });
    },

    getOutputVideos: (videoId, processPromise) => {
        return processPromise.then(({ output }) => output);
    },
};

// ===============================
// Types & Interfaces
// ===============================

interface VideoFile {
    id: string;
    name: string;
    path: string;
    progress: number;
    original?: string;
    colorized?: string;
    postprocessed?: string;
    error?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

// ===============================
// Components
// ===============================

const VideoCard = ({ video, onRetry }) => {
    const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);
    const [isLoadingColorized, setIsLoadingColorized] = useState(false);
    const [isLoadingPostprocessed, setIsLoadingPostprocessed] = useState(false);

    useEffect(() => {
        if (video.original) setIsLoadingOriginal(false);
        if (video.colorized) setIsLoadingColorized(false);
        if (video.postprocessed) setIsLoadingPostprocessed(false);
    }, [video.original, video.colorized, video.postprocessed]);

    const getFileTypeIcon = (filename) => {
        if (!filename) return <File className="w-4 h-4" />;
        if (filename.endsWith('.mp4') || filename.endsWith('.mov')) {
            return <FileVideo className="w-4 h-4" />;
        }
        return <File className="w-4 h-4" />;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white/5 backdrop-blur-md rounded-xl p-4 shadow-lg border border-white/10"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{video.name}</h3>
                {video.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
                {video.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {video.status === 'failed' && <XCircle className="w-5 h-5 text-red-500" />}
            </div>

            <Progress value={video.progress} className="mb-4 h-2" />

            {video.error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-md mb-4">
                    {video.error}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRetry(video.id)}
                        className="mt-2 text-red-300 hover:text-red-200 hover:bg-red-500/20 border-red-500/30"
                    >
                        Retry
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Original Video */}
                <div className="flex flex-col items-center">
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Original</h4>
                    {video.original ? (
                        <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden border border-gray-700">
                            <video
                                src={video.original}
                                className="absolute inset-0 w-full h-full object-contain"
                                controls
                            />
                        </div>
                    ) : (
                        <div className="w-full aspect-video bg-gray-800 rounded-md flex items-center justify-center border border-gray-700">
                            {isLoadingOriginal ? (
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            ) : (
                                <Film className="w-6 h-6 text-gray-500" />
                            )}
                        </div>
                    )}
                </div>

                {/* Colorized Video */}
                <div className="flex flex-col items-center">
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Colorized</h4>
                    {video.colorized ? (
                        <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden border border-gray-700">
                            <video
                                src={video.colorized}
                                className="absolute inset-0 w-full h-full object-contain"
                                controls
                            />
                        </div>
                    ) : (
                        <div className="w-full aspect-video bg-gray-800 rounded-md flex items-center justify-center border border-gray-700">
                            {isLoadingColorized ? (
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            ) : (
                                <Film className="w-6 h-6 text-gray-500" />
                            )}
                        </div>
                    )}
                </div>

                {/* Post-processed Video */}
                <div className="flex flex-col items-center">
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Post-processed</h4>
                    {video.postprocessed ? (
                        <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden border border-gray-700">
                            <video
                                src={video.postprocessed}
                                className="absolute inset-0 w-full h-full object-contain"
                                controls
                            />
                        </div>
                    ) : (
                        <div className="w-full aspect-video bg-gray-800 rounded-md flex items-center justify-center border border-gray-700">
                            {isLoadingPostprocessed ? (
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            ) : (
                                <Film className="w-6 h-6 text-gray-500" />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const BlackWhiteColorizerApp = () => {
    const [videos, setVideos] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [outputDir] = useState(path.join(__dirname, 'colorized_videos')); // Define output directory

    // Map of videoId to its processing promise
    const [processingPromises, setProcessingPromises] = useState({});

    // --- Handlers ---
    const handleFileDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        try {
            setIsProcessing(true);
            const { videoIds, filePaths } = await service.processVideos(files, outputDir);

            // Initialize video entries
            const newVideos = filePaths.map((filePath, index) => ({
                id: videoIds[index],
                name: path.basename(filePath),
                path: filePath,
                progress: 0,
                status: 'pending',
            }));
            setVideos(prevVideos => [...prevVideos, ...newVideos]);

            // Start processing each video
            newVideos.forEach(video => {
                processVideo(video.id, video.path);
            });

        } catch (error) {
            console.error("Error processing files:", error);
            setIsProcessing(false);
            alert(`Error processing files: ${error.message}`);
        }
    }, []);

    const handleFileSelect = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            setIsProcessing(true);
            const { videoIds, filePaths } = await service.processVideos(files, outputDir);

            // Initialize video entries
            const newVideos = filePaths.map((filePath, index) => ({
                id: videoIds[index],
                name: path.basename(filePath),
                path: filePath,
                progress: 0,
                status: 'pending',
            }));
            setVideos(prevVideos => [...prevVideos, ...newVideos]);

            // Start processing each video
            newVideos.forEach(video => {
                processVideo(video.id, video.path);
            });

        } catch (error) {
            console.error("Error processing files:", error);
            setIsProcessing(false);
            alert(`Error processing files: ${error.message}`);
        }
        // Reset the input so you can select the same files again
        e.target.value = '';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const processVideo = useCallback(async (videoId, filePath) => {
        setVideos(prevVideos =>
            prevVideos.map(v =>
                v.id === videoId ? { ...v, status: 'processing', progress: 0 } : v
            )
        );

        try {
            // Start the processing and get a promise
            const processPromise = service.processVideo(videoId, filePath, outputDir);
            setProcessingPromises(prev => ({ ...prev, [videoId]: processPromise }));

            // Poll for progress updates
            let currentProgress = 0;
            while (currentProgress < 100) {
                const progress = await service.getVideoProcessingProgress(videoId, processPromise);
                currentProgress = progress;
                setVideos(prevVideos =>
                    prevVideos.map(v => (v.id === videoId ? { ...v, progress } : v))
                );
                if (currentProgress < 100) {
                    await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 100ms
                }
            }

            // Get output videos
            const output = await service.getOutputVideos(videoId, processPromise);
            setVideos(prevVideos =>
                prevVideos.map(v =>
                    v.id === videoId
                        ? {
                            ...v,
                            original: output.original,
                            colorized: output.colorized,
                            postprocessed: output.postprocessed,
                            status: 'completed',
                            progress: 100,
                        }
                        : v
                )
            );
        } catch (error) {
            setVideos(prevVideos =>
                prevVideos.map(v => (v.id === videoId ? { ...v, error: error.message, status: 'failed' } : v))
            );
            console.error(`Error processing video ${videoId}:`, error);
        } finally {
            setIsProcessing(false);
            setProcessingPromises(prev => {
                const newPromises = { ...prev };
                delete newPromises[videoId];
                return newPromises;
            });
        }
    }, []);

    const handleProcess = () => {
        if (videos.length === 0) return;
        setIsProcessing(true);
        videos.forEach(video => {
            if (video.status === 'pending' || video.status === 'failed') {
                processVideo(video.id, video.path);
            }
        });
    };

    const handleRetry = (videoId) => {
        setVideos(prevVideos =>
            prevVideos.map(v =>
                v.id === videoId ? { ...v, error: undefined, status: 'pending', progress: 0 } : v
            )
        );
        const video = videos.find(v => v.id === videoId);
        if (video) {
            processVideo(video.id, video.path);
        }
    };

    return (
        <div
            className={cn(
                "min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-8",
                "flex flex-col items-center"
            )}
        >
            <div className="max-w-4xl w-full">
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-8 text-center">
                    B&W Colorizer
                </h1>

                {/* Drag and Drop Area */}
                <div
                    onDrop={handleFileDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={cn(
                        "w-full rounded-xl p-8 border-2 border-dashed border-gray-700 transition-colors duration-300",
                        dragOver ? "bg-white/10 border-purple-500" : "bg-white/5 hover:bg-white/10 hover:border-gray-600",
                        "backdrop-blur-md flex flex-col items-center justify-center text-center"
                    )}
                >
                    <p className="text-gray-300 text-lg mb-4">
                        Drag and drop video files here, or
                        <label htmlFor="file-input" className="cursor-pointer text-blue-400 hover:text-blue-300 ml-1">
                            select files
                        </label>
                        .
                    </p>
                    <input
                        id="file-input"
                        type="file"
                        multiple
                        accept="video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <p className="text-gray-400 text-sm">Supports .mp4, .mov, and other common video formats.</p>
                </div>

                {/* Process Button */}
                <div className="mt-8 flex justify-center">
                    <Button
                        onClick={handleProcess}
                        disabled={isProcessing || videos.length === 0}
                        className={cn(
                            "px-8 py-3 rounded-full text-white font-semibold transition-all duration-300",
                            "bg-gradient-to-r from-purple-500 to-blue-500",
                            "hover:from-purple-600 hover:to-blue-600 hover:scale-105",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "shadow-lg hover:shadow-xl"
                        )}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            "Process Videos"
                        )}
                    </Button>
                </div>

                {/* Video Cards */}
                <div className="mt-8 space-y-4">
                    <AnimatePresence>
                        {videos.map(video => (
                            <VideoCard key={video.id} video={video} onRetry={handleRetry} />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default BlackWhiteColorizerApp;
