import React, { useState, useEffect } from 'react';

function VideoList({ refreshTrigger, onVideoAction }) {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchVideos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/videos');
      if (!response.ok) {
        throw new Error(`Failed to fetch videos: ${response.statusText}`);
      }
      const data = await response.json();
      // Sort videos: by status (completed first), then by original_filename or task_id
      data.sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return -1;
        if (a.status !== 'completed' && b.status === 'completed') return 1;
        const nameA = a.original_filename || a.task_id;
        const nameB = b.original_filename || b.task_id;
        return nameA.localeCompare(nameB);
      });
      setVideos(data);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching videos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [refreshTrigger]); // Refreshes when refreshTrigger changes

  const handleClearVideoSpace = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this video and its original uploaded file? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/cache/video/${taskId}`, { method: 'DELETE' });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to delete video cache');
        }
        alert('Video cache cleared successfully!');
        fetchVideos(); // Refresh video list
        if (onVideoAction) onVideoAction(); // Notify parent to refresh other components like cache info
      } catch (err) {
        alert(`Error clearing video cache: ${err.message}`);
        console.error("Error clearing video cache:", err);
      }
    }
  };

  if (isLoading) return <p>Loading video list...</p>;
  if (error) return <p style={{ color: 'red' }}>Error loading videos: {error}</p>;

  return (
    <div style={{ marginTop: '20px' }}>
      <h4>Video Processing History & Files</h4>
      {videos.length === 0 && <p>No videos processed or processing yet.</p>}
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {videos.map((video) => (
          <li key={video.task_id} style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px' }}>
            <p><strong>Task ID:</strong> {video.task_id}</p>
            <p><strong>Original Filename:</strong> {video.original_filename || 'N/A'}</p>
            <p><strong>Status:</strong> {video.status || 'Unknown'}</p>
            {video.message && <p><em>Message:</em> {video.message}</p>}
            {video.status === 'completed' && video.output_filename && (
              <>
                <p><strong>Processed Filename:</strong> {video.output_filename}</p>
                <a
                  href={`/api/videos/download/${video.task_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginRight: '10px' }}
                >
                  <button>Download</button>
                </a>
                <button onClick={() => handleClearVideoSpace(video.task_id)}>
                  Clear Space
                </button>
              </>
            )}
            {video.status !== 'completed' && video.status !== 'failed' && (
                 <p><em>(Processing in progress or queued...)</em></p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default VideoList;
