import React, { useState, useCallback } from 'react';

function VideoUpload({ onFileSelect }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      onFileSelect(file); // Pass the file object up
    }
  };

  const handleButtonClick = () => {
    // Trigger the hidden file input
    document.getElementById('hiddenFileInput').click();
  };

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      onFileSelect(file); // Pass the file object up
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return (
    <div
      style={{
        border: '2px dashed #ccc',
        padding: '20px',
        textAlign: 'center',
        cursor: 'pointer'
      }}
      onClick={handleButtonClick} // Allow clicking anywhere in the div to open file dialog
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        type="file"
        id="hiddenFileInput"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="video/*"
      />
      {fileName ? (
        <p>Selected: {fileName}</p>
      ) : (
        <p>Drag and drop video files here, or click to select files</p>
      )}
      {/* The button is now part of the clickable area, but you could keep it if preferred */}
      {/* <button type="button" onClick={handleButtonClick}>Select File</button> */}
    </div>
  );
}

export default VideoUpload;
