import React from 'react';

// Default values (can be imported or defined here if backend defaults are hard to access)
const DEFAULTS = {
  render_factor: 21,
  saturation_scale: 0.8,
  clahe_clip_limit: 0.5,
  blend_factor: 0.6,
};

const HELP_TEXTS = {
  render_factor: "Controls color vibrancy. Higher values (up to 40) mean more vibrant colors but can introduce artifacts. Default: 21.",
  saturation_scale: "Adjusts color saturation. 0.0 is grayscale, 1.0 is full saturation. Helps prevent over-saturation. Default: 0.8.",
  clahe_clip_limit: "Contrast enhancement. Lower values (e.g., <1.0) reduce noise but also contrast. Range: 0.1-4.0. Default: 0.5.",
  blend_factor: "Blends original colorization with a histogram-matched version for consistency. 0.0 = original only, 1.0 = matched only. Default: 0.6."
};

function ParameterControls({ params, onParamChange }) {
  const handleInputChange = (event) => {
    const { name, value, type } = event.target;
    onParamChange(name, type === 'number' ? parseFloat(value) : value);
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: '15px', margin: '10px 0' }}>
      <h4>Processing Parameters</h4>
      <div title={HELP_TEXTS.render_factor} style={{ marginBottom: '10px', padding: '5px', border: '1px dashed transparent', borderRadius: '4px', cursor: 'help' }}>
        <label htmlFor="render_factor">Render Factor: ({params.render_factor})</label>
        <input
          type="range"
          id="render_factor"
          name="render_factor"
          min="10"
          max="40"
          step="1"
          value={params.render_factor}
          onChange={handleInputChange}
          style={{ width: '100%' }}
        />
      </div>
      <div title={HELP_TEXTS.saturation_scale} style={{ marginBottom: '10px', padding: '5px', border: '1px dashed transparent', borderRadius: '4px', cursor: 'help' }}>
        <label htmlFor="saturation_scale">Saturation Scale: ({params.saturation_scale})</label>
        <input
          type="range"
          id="saturation_scale"
          name="saturation_scale"
          min="0.0"
          max="1.0"
          step="0.01"
          value={params.saturation_scale}
          onChange={handleInputChange}
          style={{ width: '100%' }}
        />
      </div>
      <div title={HELP_TEXTS.clahe_clip_limit} style={{ marginBottom: '10px', padding: '5px', border: '1px dashed transparent', borderRadius: '4px', cursor: 'help' }}>
        <label htmlFor="clahe_clip_limit">CLAHE Clip Limit: ({params.clahe_clip_limit})</label>
        <input
          type="range"
          id="clahe_clip_limit"
          name="clahe_clip_limit"
          min="0.1"
          max="4.0"
          step="0.1"
          value={params.clahe_clip_limit}
          onChange={handleInputChange}
          style={{ width: '100%' }}
        />
      </div>
      <div title={HELP_TEXTS.blend_factor} style={{ marginBottom: '10px', padding: '5px', border: '1px dashed transparent', borderRadius: '4px', cursor: 'help' }}>
        <label htmlFor="blend_factor">Blend Factor: ({params.blend_factor})</label>
        <input
          type="range"
          id="blend_factor"
          name="blend_factor"
          min="0.0"
          max="1.0"
          step="0.01"
          value={params.blend_factor}
          onChange={handleInputChange}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}

// Export DEFAULTS to be used in App.jsx for initial state
export { DEFAULTS as PARAM_DEFAULTS };
export default ParameterControls;
