import React from 'react';

function ProcessButton({ onClick }) {
  return (
    <button 
      onClick={onClick}
      style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
    >
      Process Video
    </button>
  );
}

export default ProcessButton;
