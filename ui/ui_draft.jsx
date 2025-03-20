import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, Film, File, FileVideo } from 'lucide-react';
import { cn } from '@/lib/utils';

// ===============================
// Mock Service (Simulates backend interaction)
// ===============================

const mockService = {
    processVideos: (files: FileList): Promise<string[]> => {
        return new Promise((resolve, reject) => {
            if (!files || files.length === 0) {
                reject(new Error("No files selected."));
                return;
            }

            // Simulate file processing with unique IDs
            const videoIds = Array.from(files).map((file, index) => `video-${Date.now()}-${index}`);
            setTimeout(() => {
                resolve(videoIds);
            }, 500); // Simulate initial delay
        });
    },

    getVideoProcessingProgress: (videoId: string): Promise<number> => {
        return new Promise((resolve) => {
            // Simulate progress updates (replace with actual logic)
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                if (progress >= 100) {
                    clearInterval(interval);
                    resolve(100);
                } else {
                    resolve(progress);
                }
            }, 200); // Update every 200ms
        });
    },

    getOutputVideos: (videoId: string): Promise<{ original: string; colorized: string; postprocessed: string }> => {
        return new Promise((resolve, reject) => {
            // Simulate different outcomes
            setTimeout(() => {
                // Simulate success for some videos, failure for others
                if (videoId.includes('video-error')) {
                    reject(new Error(`Failed to process video: ${videoId}`));
                } else if (videoId.includes('video-no-output')) {
                    resolve({ original: `original-${videoId}.mp4`, colorized: '', postprocessed: '' }); // Simulate no output
                }
                else {
                    resolve({
                        original: `original-${videoId}.mp4`,
                        colorized: `colorized-${videoId}.mp4`,
                        postprocessed: `postprocessed-${videoId}.mp4`,
                    });
                }
            }, 2000); // Simulate processing time
        });
    },
};

// ===============================
// Types & Interfaces
// ===============================

interface VideoFile {
    id: string;
    name: string;
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

const VideoCard: React.FC<{ video: VideoFile; onRetry: (id: string) => void }> = ({ video, onRetry }) => {
    const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);
    const [isLoadingColorized, setIsLoadingColorized] = useState(false);
    const [isLoadingPostprocessed, setIsLoadingPostprocessed] = useState(false);

    useEffect(() => {
        if (video.original) setIsLoadingOriginal(false);
        if (video.colorized) setIsLoadingColorized(false);
        if (video.postprocessed) setIsLoadingPostprocessed(false);
    }, [video.original, video.colorized, video.postprocessed]);

    const getFileTypeIcon = (filename: string | undefined) => {
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
                        <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden border border-gray-700 flex items-center justify-center">
                            {getFileTypeIcon(video.original)}
                            <video
                                src={video.original}
                                className="absolute inset-0 w-full h-full object-contain"
                                style={{ display: 'none' }} // Hide the video element, show only the icon
                                controls // Keep controls for potential future use
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
                        <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden border border-gray-700 flex items-center justify-center">
                            {getFileTypeIcon(video.colorized)}
                            <video
                                src={video.colorized}
                                className="absolute inset-0 w-full h-full object-contain"
                                style={{ display: 'none' }}
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
                        <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden border border-gray-700 flex items-center justify-center">
                            {getFileTypeIcon(video.postprocessed)}
                            <video
                                src={video.postprocessed}
                                className="absolute inset-0 w-full h-full object-contain"
                                style={{ display: 'none' }}
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
    const [videos, setVideos] = useState<VideoFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    // --- Handlers ---
    const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        try {
            setIsProcessing(true);
            const newVideoIds = await mockService.processVideos(files);

            // Initialize video entries
            const newVideos: VideoFile[] = Array.from(files).map((file, index) => ({
                id: newVideoIds[index],
                name: file.name,
                progress: 0,
                status: 'pending', // Initial status
            }));
            setVideos(prevVideos => [...prevVideos, ...newVideos]);

            // Start processing each video
            newVideos.forEach(video => {
                processVideo(video.id);
            });

        } catch (error: any) {
            console.error("Error processing files:", error);
            // Handle error (e.g., show error message)
            setIsProcessing(false);
            alert(`Error processing files: ${error.message}`);
        }
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            setIsProcessing(true);
            const newVideoIds = await mockService.processVideos(files);

            // Initialize video entries
            const newVideos: VideoFile[] = Array.from(files).map((file, index) => ({
                id: newVideoIds[index],
                name: file.name,
                progress: 0,
                status: 'pending',
            }));
            setVideos(prevVideos => [...prevVideos, ...newVideos]);

            // Start processing each video
            newVideos.forEach(video => {
                processVideo(video.id);
            });

        } catch (error: any) {
            console.error("Error processing files:", error);
            setIsProcessing(false);
            alert(`Error processing files: ${error.message}`);
        }
        // Reset the input so you can select the same files again
        e.target.value = '';
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const processVideo = useCallback(async (videoId: string) => {
        setVideos(prevVideos =>
            prevVideos.map(v =>
                v.id === videoId ? { ...v, status: 'processing', progress: 0 } : v
            )
        );

        try {
            // Get progress updates
            let currentProgress = 0;
            while (currentProgress < 100) {
                const progress = await mockService.getVideoProcessingProgress(videoId);
                currentProgress = progress;
                setVideos(prevVideos =>
                    prevVideos.map(v => (v.id === videoId ? { ...v, progress } : v))
                );
            }

            // Get output videos
            const output = await mockService.getOutputVideos(videoId);
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
        } catch (error: any) {
            setVideos(prevVideos =>
                prevVideos.map(v => (v.id === videoId ? { ...v, error: error.message, status: 'failed' } : v))
            );
            console.error(`Error processing video ${videoId}:`, error);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const handleProcess = () => {
        if (videos.length === 0) return; // Prevent processing if no videos are selected
        setIsProcessing(true);
        videos.forEach(video => {
            processVideo(video.id);
        });
    };

    const handleRetry = (videoId: string) => {
        setVideos(prevVideos =>
            prevVideos.map(v =>
                v.id === videoId ? { ...v, error: undefined, status: 'pending', progress: 0 } : v
            )
        );
        processVideo(videoId);
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
