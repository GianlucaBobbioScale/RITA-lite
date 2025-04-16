// Browser detection
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
const browserLanding = document.getElementById('browserLanding');
const mainContent = document.getElementById('mainContent');

if (!isFirefox) {
  browserLanding.style.display = 'flex';
  mainContent.style.display = 'none';
  // Prevent any further script execution
  throw new Error('Browser not supported');
}

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
  const gl =
    canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      webglInfo = `${gl.getParameter(
        debugInfo.UNMASKED_VENDOR_WEBGL
      )} ${gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)}`;
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
const concurrentPairProcessing = 1;

// Queue manager for video processing
class VideoProcessingQueue {
  constructor(maxConcurrent = 1) {
    this.maxConcurrent = maxConcurrent;
    this.queue = [];
    this.processing = new Set();
  }

  async add(pairId, processFn, videos) {
    return new Promise((resolve) => {
      videos.forEach(({ file, id }) => {
        addVideoOnQueue(file, id, pairId);
      });
      this.queue.push({ pairId, processFn, resolve });
      this.processNext();
    });
  }

  async processNext() {
    console.log('processing next', this.processing.size, this.queue.length);
    if (this.processing.size >= this.maxConcurrent || this.queue.length === 0) {
      console.log(
        'not processing next',
        this.processing.size,
        this.queue.length
      );
      return;
    }

    const { pairId, processFn, resolve } = this.queue.shift();
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
playbackRateSlider.addEventListener('input', (e) => {
  playbackRate = parseFloat(e.target.value);
  invertedPlaybackRate = 1 / playbackRate;
  playbackRateValue.textContent = `${playbackRate.toFixed(1)}x`;
});
