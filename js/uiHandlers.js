// Handle video file input
videoInput.addEventListener('change', (e) => {
  // videoFiles = Array.from(e.target.files);
  // videoContainer.innerHTML = '';
  Array.from(e.target.files).forEach((file, index) => {
    const id = crypto.randomUUID();
    videoFiles.push({ id, file });
    const videoItem = document.createElement('div');
    videoItem.className = 'video-item';
    videoItem.id = `video-item-${id}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'video-checkbox';
    checkbox.id = `checkbox-${id}`;
    checkbox.onchange = () => toggleVideoSelection(id);

    const video = document.createElement('video');
    video.className = 'thumbnail';
    video.src = URL.createObjectURL(file);
    video.controls = true;

    const fileName = document.createElement('div');
    fileName.className = 'processing-label';
    fileName.textContent = file.name;

    videoItem.appendChild(checkbox);
    videoItem.appendChild(video);
    videoItem.appendChild(fileName);
    videoContainer.appendChild(videoItem);
  });
  pairSection.style.display = 'block';
});

// Handle video selection
function toggleVideoSelection(id) {
  const videoItem = document.getElementById(`video-item-${id}`);
  const checkbox = document.getElementById(`checkbox-${id}`);
  const isSelected = checkbox.checked;

  console.log(`Toggling selection for video ${id}, isSelected: ${isSelected}`);
  console.log(`Current selectedVideos:`, selectedVideos);

  if (isSelected) {
    videoItem.classList.add('selected');
    if (!selectedVideos.some((v) => v.id === id)) {
      const videoFile = videoFiles.find((v) => v.id === id);
      selectedVideos.push({ id, file: videoFile.file });
    }
  } else {
    videoItem.classList.remove('selected');
    selectedVideos = selectedVideos.filter((v) => v.id !== id);
  }
  console.log(`Updated selectedVideos:`, selectedVideos);
}

function drawWaveform(canvas, signal, offset, color = '#4caf50') {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear the canvas
  ctx.clearRect(0, 0, width, height);

  // Set the drawing style
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // Calculate the number of samples to display
  const samplesPerPixel = Math.ceil(signal.length / width);
  const centerY = height / 2;

  // Preprocess the signal
  const preprocessedSignal = preprocessSignal(signal);

  // Enhance the signal
  let maxSample = 0;
  for (let i = 0; i < preprocessedSignal.length; i++) {
    const absValue = Math.abs(preprocessedSignal[i]);
    if (absValue > maxSample) {
      maxSample = absValue;
    }
  }

  // Apply signal enhancement
  const enhancedSignal = preprocessedSignal.map((sample) => {
    // Normalize to [-1, 1]
    const normalized = sample / maxSample;
    // Apply cubic transformation to enhance peaks
    return Math.sign(normalized) * Math.pow(Math.abs(normalized), 0.7);
  });

  // Find new max after enhancement
  let newMaxSample = 0;
  for (let i = 0; i < enhancedSignal.length; i++) {
    const absValue = Math.abs(enhancedSignal[i]);
    if (absValue > newMaxSample) {
      newMaxSample = absValue;
    }
  }

  const normalizedSignal = enhancedSignal.map(
    (sample) => (sample / newMaxSample) * 0.8
  );

  // Start drawing the waveform
  ctx.beginPath();

  for (let x = 0; x < width; x++) {
    // Calculate the sample index, taking into account the offset
    const sampleIndex = Math.floor(x * samplesPerPixel) + offset;

    if (sampleIndex >= 0 && sampleIndex < normalizedSignal.length) {
      // Get the normalized sample value and scale it to the canvas height
      const sample = normalizedSignal[sampleIndex];
      const y = centerY + sample * centerY;

      // Move to the first point or draw a line to the next point
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  }

  // Draw the waveform
  ctx.stroke();

  // Analyze pitch and find highest pitch timestamp
  const sampleRate = 44100; // Assuming 44.1kHz sample rate
  const windowSize = 1024; // Analysis window size
  const hopSize = 512; // Hop size between windows

  let maxPitch = 0;
  let maxPitchTime = 0;

  for (let i = 0; i < signal.length - windowSize; i += hopSize) {
    const window = signal.slice(i, i + windowSize);
    const pitch = estimatePitch(window, sampleRate);

    if (pitch > maxPitch) {
      maxPitch = pitch;
      maxPitchTime = i / sampleRate; // Convert sample index to seconds
    }
  }

  return maxPitchTime;
}

// Helper function to estimate pitch using zero-crossing rate
function estimatePitch(samples, sampleRate) {
  let zeroCrossings = 0;
  let prevSample = samples[0];

  for (let i = 1; i < samples.length; i++) {
    if (
      (prevSample < 0 && samples[i] >= 0) ||
      (prevSample >= 0 && samples[i] < 0)
    ) {
      zeroCrossings++;
    }
    prevSample = samples[i];
  }

  // Convert zero-crossing rate to frequency (Hz)
  const frequency = (zeroCrossings * sampleRate) / (2 * samples.length);
  return frequency;
}

// Function to analyze signal and find high pitch points
function analyzeSignalPitch(signal, sampleRate = 44100) {
  const windowSize = 1024; // Analysis window size
  const hopSize = 512; // Hop size between windows
  const pitchThreshold = 200; // Minimum frequency to consider as high pitch (Hz)

  const pitchPoints = [];

  for (let i = 0; i < signal.length - windowSize; i += hopSize) {
    const window = signal.slice(i, i + windowSize);
    const pitch = estimatePitch(window, sampleRate);
    const time = i / sampleRate; // Convert sample index to seconds

    if (pitch > pitchThreshold) {
      pitchPoints.push({
        time,
        pitch,
        amplitude: Math.max(...window.map(Math.abs)), // Store amplitude for correlation
      });
    }
  }

  return pitchPoints;
}

// Function to find best correlation between two sets of pitch points
function findBestCorrelation(points1, points2, maxOffset = 5) {
  let bestCorrelation = -Infinity;
  let bestOffset = 0;

  // Try different offsets within the maxOffset range
  for (let offset = -maxOffset; offset <= maxOffset; offset += 0.1) {
    let correlation = 0;
    let count = 0;

    // For each point in the first audio
    for (const point1 of points1) {
      // Find points in the second audio that are close in time (considering the offset)
      const matchingPoints = points2.filter(
        (point2) => Math.abs(point2.time + offset - point1.time) < 0.1 // 100ms window
      );

      if (matchingPoints.length > 0) {
        // Calculate correlation based on pitch similarity and amplitude
        const bestMatch = matchingPoints.reduce(
          (best, point2) => {
            const pitchDiff = Math.abs(point2.pitch - point1.pitch);
            const amplitudeDiff = Math.abs(point2.amplitude - point1.amplitude);
            const score = 1 / (1 + pitchDiff + amplitudeDiff);
            return score > best.score ? { score, point: point2 } : best;
          },
          { score: 0, point: null }
        );

        correlation += bestMatch.score;
        count++;
      }
    }

    // Normalize correlation by the number of matches
    if (count > 0) {
      correlation /= count;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }
  }

  return {
    offset: bestOffset,
    confidence: bestCorrelation,
  };
}

// Signal preprocessing function
function preprocessSignal(signal) {
  // Apply moving average for noise reduction
  const windowSize = 3; // Reduced from 5 to 3 for less smoothing
  const smoothedSignal = new Array(signal.length).fill(0);

  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -windowSize; j <= windowSize; j++) {
      const index = i + j;
      if (index >= 0 && index < signal.length) {
        sum += signal[index];
        count++;
      }
    }
    smoothedSignal[i] = sum / count;
  }

  // Apply a simple high-pass filter to remove DC offset and low-frequency noise
  const alpha = 0.98; // Increased from 0.95 to preserve more low frequencies
  const filteredSignal = new Array(smoothedSignal.length).fill(0);
  filteredSignal[0] = smoothedSignal[0];

  for (let i = 1; i < smoothedSignal.length; i++) {
    filteredSignal[i] =
      alpha *
      (filteredSignal[i - 1] + smoothedSignal[i] - smoothedSignal[i - 1]);
  }

  // Apply a simple threshold to remove very quiet parts
  const threshold = 0.05; // Reduced from 0.1 to preserve more of the signal
  const thresholdedSignal = filteredSignal.map((sample) => {
    return Math.abs(sample) < threshold ? 0 : sample;
  });

  return thresholdedSignal;
}

// Handle pair videos button click
pairVideos.addEventListener('click', async () => {
  const usedPlaybackRate = playbackRate;
  const usedInvertedPlaybackRate = 1 / usedPlaybackRate;
  const pairId = crypto.randomUUID();
  console.log('Pair button clicked');

  console.log('Filtered selectedVideos:', selectedVideos);

  if (selectedVideos.length !== 2) {
    alert('Please select exactly 2 videos to pair');
    return;
  }

  const pairedVideos = selectedVideos.map(({ file, id }) => ({ file, id }));
  selectedVideos = [];

  // Create a new pair card
  const newPairCard = document.createElement('div');
  newPairCard.className = 'pair-card';
  newPairCard.id = `pair-card-${pairId}`;

  const pairVideosContainer = document.createElement('div');
  pairVideosContainer.className = 'pair-videos';
  pairVideosContainer.id = `video-pair-${pairId}`;

  newPairCard.appendChild(pairVideosContainer);
  document.getElementById('pairSection').appendChild(newPairCard);

  // Hide selected videos from upload section
  pairedVideos.forEach(({ id }) => {
    const videoItem = document.getElementById(`video-item-${id}`);
    videoItem.style.display = 'none';
    // Also uncheck the checkbox and remove selected class
    const checkbox = document.getElementById(`checkbox-${id}`);
    if (checkbox) {
      checkbox.checked = false;
    }
    videoItem.classList.remove('selected');
  });

  const processingPromises = pairedVideos.map(({ file, id }) =>
    processVideo(file, id, pairId, usedPlaybackRate, usedInvertedPlaybackRate)
  );
  await Promise.all(processingPromises);
});
