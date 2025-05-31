import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import VideoUpload from './components/VideoUpload';
import ProcessButton from './components/ProcessButton';
import VideoList from './components/VideoList';
import ParameterControls, { PARAM_DEFAULTS } from './components/ParameterControls';
import CacheManager from './components/CacheManager'; // Import CacheManager

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [params, setParams] = useState(PARAM_DEFAULTS);

  const [isProcessing, setIsProcessing] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [detailedMessage, setDetailedMessage] = useState('');
  const [processedFileUrl, setProcessedFileUrl] = useState('');

  const eventSourceRef = useRef(null);
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger refreshes in child components

  const triggerRefresh = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setProcessedFileUrl('');
    setProcessingStatus('');
    setDetailedMessage('');
    setTaskId(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsProcessing(false);
  };

  const handleParamChange = (paramName, value) => {
    setParams(prevParams => ({
      ...prevParams,
      [paramName]: value,
    }));
  };

  const setupEventSource = (currentTaskId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newEventSource = new EventSource(`/api/stream_progress/${currentTaskId}`);
    eventSourceRef.current = newEventSource;

    newEventSource.onopen = () => {
      console.log(`SSE connection opened for task: ${currentTaskId}`);
      setProcessingStatus('Connected to progress stream...');
      setDetailedMessage('Waiting for updates...');
    };

    newEventSource.onmessage = (event) => {
      try {
        const result = JSON.parse(event.data);

        setProcessingStatus(result.status || 'Receiving updates...');
        setDetailedMessage(result.message || '');

        if (result.stage) {
             setDetailedMessage(`Stage: ${result.stage} - ${result.message}`);
        }

        if (result.status === 'completed') {
          setIsProcessing(false);
          setDetailedMessage(`Processing complete! Output: ${result.output_filename}`);
          setProcessedFileUrl(`/processed_videos/${result.output_filename}`);
          console.log('Final video path (from backend):', result.final_path);
          newEventSource.close();
          eventSourceRef.current = null;
          setTaskId(null);
          triggerRefresh(); // Refresh video list and cache info
        } else if (result.status === 'failed') {
          setIsProcessing(false);
          setDetailedMessage(`Processing failed: ${result.message}`);
          newEventSource.close();
          eventSourceRef.current = null;
          setTaskId(null);
          triggerRefresh(); // Refresh video list and cache info
        }
      } catch (e) {
        console.error("Failed to parse SSE message data:", event.data, e);
        setDetailedMessage("Error processing an update from server.");
      }
    };

    newEventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      if (newEventSource.readyState === EventSource.CLOSED) {
        setProcessingStatus('Stream closed by server.');
        setDetailedMessage('The progress stream was closed. This usually means the task finished or failed.');
      } else {
        setProcessingStatus('Error with progress stream');
        setDetailedMessage('Connection to progress stream lost or an error occurred.');
      }
      setIsProcessing(false);
      newEventSource.close();
      eventSourceRef.current = null;
      // Task ID might still be relevant if it failed and needs cleanup
      // setTaskId(null);
      triggerRefresh(); // Refresh lists even on error/closure
    };
  };

  const handleProcessVideo = async () => {
    if (!selectedFile) {
      setProcessingStatus('Please select a video file first.');
      setDetailedMessage('');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Initializing...');
    setDetailedMessage('Uploading video and starting process...');
    setProcessedFileUrl('');
    setTaskId(null);

    const formData = new FormData();
    formData.append('video_file', selectedFile);
    formData.append('render_factor', params.render_factor);
    formData.append('saturation_scale', params.saturation_scale);
    formData.append('clahe_clip_limit', params.clahe_clip_limit);
    formData.append('blend_factor', params.blend_factor);

    try {
      const response = await fetch('/api/process_video', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.task_id) {
        setTaskId(result.task_id);
        setProcessingStatus('Processing started...');
        setDetailedMessage(`Task ID: ${result.task_id}. Connecting to progress stream...`);
        setupEventSource(result.task_id);
        triggerRefresh(); // Refresh list to show queued task
      } else {
        setProcessingStatus('Error starting process');
        setDetailedMessage(result.detail || 'Unknown error occurred while starting.');
        setIsProcessing(false);
      }
    } catch (error) {
      setProcessingStatus('Network Error');
      setDetailedMessage(`Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // Initial data load can be triggered here if needed,
    // but child components load their own data based on refreshKey
    return () => {
      if (eventSourceRef.current) {
        console.log("Closing EventSource on component unmount.");
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Video Colorization Web UI</h1>
      </header>
      <main>
        <VideoUpload onFileSelect={handleFileSelect} />
        <ParameterControls params={params} onParamChange={handleParamChange} />
        <div style={{ margin: '20px 0', textAlign: 'center' }}>
          <ProcessButton onClick={handleProcessVideo} disabled={isProcessing} />
        </div>

        {taskId && <p style={{ textAlign: 'center', marginTop: '10px', fontWeight: 'bold' }}>Task ID: {taskId}</p>}

        <div style={{ textAlign: 'center', marginTop: '20px', padding: '10px', border: '1px solid #eee',  marginBottom: '20px' }}>
          <h3>Processing Status</h3>
          <p><strong>Status:</strong> {processingStatus || "Idle"}</p>
          <p><strong>Details:</strong> {detailedMessage || "No details yet."}</p>
          {processedFileUrl && ( // This is just a placeholder from SSE, download is via VideoList
            <div>
              <p><strong>Last Processed Output:</strong> {processedFileUrl.split('/').pop()}</p>
            </div>
          )}
        </div>

        <CacheManager refreshTrigger={refreshKey} onCacheCleared={triggerRefresh} />
        <VideoList refreshTrigger={refreshKey} onVideoAction={triggerRefresh} />

      </main>
    </div>
  );
}

export default App;
