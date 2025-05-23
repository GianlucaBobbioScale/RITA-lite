// Browser detection
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
const browserLanding = document.getElementById('browserLanding');
const mainContent = document.getElementById('mainContent');

// if (!isFirefox) {
//   browserLanding.style.display = 'flex';
//   mainContent.style.display = 'none';
//   // Prevent any further script execution
//   throw new Error('Browser not supported');
// }

// function displayVideoProcessingVersionOnURL() {
//   const url = new URL(window.location.href);
//   url.searchParams.set('videoProcessingVersion', videoProcessingVersion);
//   window.history.replaceState({}, '', url);
// }

// Display user specifications
function displayUserSpecs() {
  const userSpecs = document.getElementById('userSpecs');

  // Get OS information
  const osInfo = navigator.platform;
  const osVersion = navigator.userAgent.match(/\(([^)]+)\)/)[1];

  // Get browser information
  const browserInfo = navigator.userAgent;

  // Get screen information
  const screenResolution = `${window.screen.width}x${window.screen.height}`;
  const colorDepth = `${window.screen.colorDepth}-bit color`;
  const pixelRatio = window.devicePixelRatio;

  // Get CPU information
  const cpuCores = navigator.hardwareConcurrency || 'CPU info not available';

  // Get WebGL information
  let webglInfo = 'WebGL not available';
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      webglInfo = `${gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)} ${gl.getParameter(
        debugInfo.UNMASKED_RENDERER_WEBGL,
      )}`;
    }
  }

  // Create specs HTML
  const specsHTML = `
    <p>OS: ${osInfo} ${osVersion}</p>
    <p>Browser: ${browserInfo}</p>
    <p>Screen: ${screenResolution} @ ${pixelRatio}x (${colorDepth})</p>
    <p>CPU: ${cpuCores} cores</p>
    <p>Biggest video size: <span id="biggestVideoSize">${biggetVideosBlobSizes} MB</span></p>
    <p>WebGL: ${webglInfo}</p>
  `;

  userSpecs.innerHTML = specsHTML;
}

// Helper function to update battery info after async fetch
function updateBatteryInfo(info) {
  const userSpecs = document.getElementById('userSpecs');
  const batteryElement = userSpecs.querySelector('p:nth-child(6)');
  if (batteryElement) {
    batteryElement.textContent = `Battery: ${info}`;
  }
}

// Global configuration
let playbackRate = 4;
let invertedPlaybackRate = 1 / playbackRate;
const downsampledWidth = 640;
const ctx = new AudioContext();
const concurrentPairProcessing = 2;
const checkCriterias = {
  fps: 100,
  width: 2944,
  duration: 30, // seconds
};

// Queue manager for video processing
class VideoProcessingQueue {
  constructor(maxConcurrent = 1) {
    this.maxConcurrent = maxConcurrent;
    this.nextQueue = [];
    this.allQueue = [];
    this.processing = new Set();
    window.onRITAVideoUploaded = (pairIdArg, taskId, errorMessage) => {
      logger.info('uploaded pair', pairIdArg);
      const pair = this.allQueue.find(({ pairId }) => pairId === pairIdArg);
      if (pair) {
        pair.videos.forEach(video => {
          video.status = taskId ? 'uploaded' : 'uploaded-error';
          logger.info('video to mark as uploaded', video.id, pairIdArg);
          if (taskId) {
            updateUpdatedVideo(video.id, pairIdArg);
            // we clean the screenshots array to avoid memory leaks
            video.data.screenshots.length = 0;
          }
        });
        const pairContainer = document.getElementById(`pair-card-${pairIdArg}`);
        let taskIdElement = pairContainer.querySelector('.task-id');
        if (!taskIdElement) {
          taskIdElement = document.createElement('div');
          taskIdElement.className = 'task-id';
          pairContainer.appendChild(taskIdElement);
        }
        const duration = Math.min(...pair.videos.map(({ data }) => data.duration));
        if (taskId) {
          taskIdElement.textContent = `Internal ID: ${taskId} - ${duration} seconds`;
        } else {
          taskIdElement.textContent = `Error: ${errorMessage || 'Unknown error'}`;
          let retryButton = pairContainer.querySelector('.retry-button');
          if (!retryButton) {
            retryButton = document.createElement('button');
            retryButton.className = 'retry-button';
            pairContainer.appendChild(retryButton);
          }
          retryButton.textContent = 'Retry Upload';
          retryButton.disabled = false;
          retryButton.onclick = () => {
            taskIdElement.textContent = 'Retrying upload...';
            retryButton.textContent = 'Retrying...';
            retryButton.disabled = true;
            window.onRITAVideoProcessed?.(pair);
          };
        }
      }
    };
  }

  async add(pairId, processFn, videos) {
    return new Promise(resolve => {
      videos.forEach(({ file, id }) => {
        addVideoOnQueue(file, id, pairId);
      });
      this.nextQueue.push({ pairId, processFn, resolve });
      this.allQueue.push({
        pairId,
        videos: videos.map(({ id }) => ({ id, status: 'queued' })),
      });
      this.processNext();
    });
  }

  async videoCompleted(pairIdArg) {
    const pair = this.allQueue.find(({ pairId }) => pairId === pairIdArg);
    if (pair.videos.every(({ status }) => status === 'completed')) {
      window.onRITAVideoProcessed?.(pair);
    }
  }

  async processNext() {
    logger.info('processing next', this.processing.size, this.nextQueue.length);
    if (this.processing.size >= this.maxConcurrent || this.nextQueue.length === 0) {
      logger.info('not processing next', this.processing.size, this.nextQueue.length);
      return;
    }

    const { pairId, processFn, resolve } = this.nextQueue.shift();
    this.processing.add(pairId);

    try {
      await processFn();
    } finally {
      this.processing.delete(pairId);
      resolve();
      this.processNext();
    }
  }
}

// Global state
let videoFiles = [];
let selectedVideos = [];
let processedVideos = [];
let processedAudios = [];
let pairCount = 0;
let biggetVideosBlobSizes = 0;
const videoProcessingQueue = new VideoProcessingQueue(concurrentPairProcessing);

// displayVideoProcessingVersionOnURL();

// Call the function to display specs
displayUserSpecs();

// DOM elements
const videoInput = document.getElementById('videoInput');
const pairVideos = document.getElementById('pairVideos');
const videoContainer = document.getElementById('videoContainer');
const pairSection = document.getElementById('pairSection');
const processSection = document.getElementById('processSection');
const playbackRateSlider = document.getElementById('playbackRate');
const playbackRateValue = document.getElementById('playbackRateValue');

// Update playback rate when slider changes
playbackRateSlider.addEventListener('input', e => {
  playbackRate = parseFloat(e.target.value);
  invertedPlaybackRate = 1 / playbackRate;
  playbackRateValue.textContent = `${playbackRate.toFixed(1)}x`;
});
