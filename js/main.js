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

// Global configuration
const playbackRate = 6;
const invertedPlaybackRate = 1 / playbackRate;
const downsampledWidth = 640;
const ctx = new AudioContext();

// Global state
let videoFiles = [];
let selectedVideos = [];
let processedVideos = [];
let processedAudios = [];
let pairCount = 0;

// DOM elements
const videoInput = document.getElementById('videoInput');
const pairVideos = document.getElementById('pairVideos');
const videoContainer = document.getElementById('videoContainer');
const pairSection = document.getElementById('pairSection');
const processSection = document.getElementById('processSection');
