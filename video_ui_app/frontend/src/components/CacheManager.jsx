import React, { useState, useEffect } from 'react';

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function CacheManager({ refreshTrigger, onCacheCleared }) {
  const [cacheInfo, setCacheInfo] = useState({
    processed_files: { count: 0, size_bytes: 0 },
    uploaded_files: { count: 0, size_bytes: 0 },
    tasks_in_memory: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCacheInfo = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cache/info');
      if (!response.ok) {
        throw new Error(`Failed to fetch cache info: ${response.statusText}`);
      }
      const data = await response.json();
      setCacheInfo(data);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching cache info:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCacheInfo();
  }, [refreshTrigger]); // Refreshes when refreshTrigger changes

  const handleClearAllCache = async () => {
    if (window.confirm('Are you sure you want to clear all cache? This includes all processed videos and uploaded originals. This action cannot be undone.')) {
      setIsLoading(true);
      try {
        const response = await fetch('/api/cache/all', { method: 'DELETE' });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to clear cache');
        }
        alert('All cache cleared successfully!');
        fetchCacheInfo(); // Refresh info
        if (onCacheCleared) onCacheCleared(); // Notify parent to refresh other components like video list
      } catch (err) {
        alert(`Error clearing cache: ${err.message}`);
        console.error("Error clearing cache:", err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (error) {
    return <p style={{ color: 'red' }}>Error loading cache info: {error}</p>;
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: '15px', margin: '20px 0' }}>
      <h4>Cache Information</h4>
      {isLoading && <p>Loading cache info...</p>}
      <p>
        <strong>Processed Videos:</strong> {cacheInfo.processed_files.count} files, {formatBytes(cacheInfo.processed_files.size_bytes)}
      </p>
      <p>
        <strong>Uploaded Originals:</strong> {cacheInfo.uploaded_files.count} files, {formatBytes(cacheInfo.uploaded_files.size_bytes)}
      </p>
      <p>
        <strong>Tasks in Memory:</strong> {cacheInfo.tasks_in_memory}
      </p>
      <button onClick={handleClearAllCache} disabled={isLoading}>
        {isLoading ? 'Clearing...' : 'Clear All Cache'}
      </button>
    </div>
  );
}

export default CacheManager;
