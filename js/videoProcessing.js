const videoProcessingVersion = '1.0.1';
async function addVideoOnQueue(file, id, pairId) {
  const pairContainer = document.getElementById(`video-pair-${pairId}`);
  const videoContainer = document.createElement('div');
  videoContainer.className = 'pair-video';
  videoContainer.id = `processing-video-${pairId}-${id}`;

  // Create visible video element for the pair
  const displayVideo = document.createElement('video');
  displayVideo.className = 'thumbnail';
  displayVideo.loading = 'lazy';
  displayVideo.preload = 'metadata';
  displayVideo.src = URL.createObjectURL(file);
  displayVideo.controls = false;

  const statusLabel = document.createElement('div');
  statusLabel.className = 'processing-label';
  statusLabel.textContent = `Video on queue`;

  videoContainer.appendChild(displayVideo);
  videoContainer.appendChild(statusLabel);
  pairContainer.appendChild(videoContainer);
}

async function updateUpdatedVideo(id, pairId) {
  console.log('updating video', id, pairId);
  const statusLabel = document.querySelector(`#processing-video-${pairId}-${id} .processing-label`);
  statusLabel.style.color = 'green';
  statusLabel.textContent = `Uploaded!`;
  const dimensionsLabel = document.querySelector(
    `#processing-video-${pairId}-${id} .dimensions-label`,
  );
  const cancelButton = document.querySelector(`#video-pair-${pairId} .pair-cancel-button`);
  cancelButton.style.display = 'none';
  dimensionsLabel.style.display = 'none';
}

async function processVideo(file, id, pairId, playbackRate, invertedPlaybackRate) {
  try {
    navigator.wakeLock?.request('screen').then(lock => (wakeLock = lock));
  } catch (err) {
    console.log('Wake Lock not available');
  }
  const video = videoProcessingQueue.allQueue
    .find(({ pairId: pairIdArg }) => pairIdArg === pairId)
    .videos.find(({ id: videoId }) => videoId === id);
  video.data = video.data || {};
  video.data.checksum = await getFileChecksum(file);
  video.data.screenshots = video.data.screenshots || [];
  return new Promise(resolve => {
    let screenshotsSize = 0;
    const pairContainer = document.getElementById(`video-pair-${pairId}`);

    const useCurrentTimeMethod = true;

    if (useCurrentTimeMethod) {
      playbackRate = 5;
      invertedPlaybackRate = 1 / playbackRate;
    }

    const videoContainer = document.getElementById(`processing-video-${pairId}-${id}`);

    // Create visible video element for the pair
    const displayVideo = pairContainer.querySelector(`#processing-video-${pairId}-${id} video`);

    const carrousel = document.createElement('img');
    carrousel.className = 'carrousel';
    carrousel.style.display = 'none';

    const carrouselSlider = document.createElement('input');
    carrouselSlider.className = 'carrousel-slider';
    carrouselSlider.type = 'range';
    carrouselSlider.min = '0';
    carrouselSlider.max = '100';
    carrouselSlider.value = '0';
    carrouselSlider.style.display = 'none';
    carrouselSlider.addEventListener('input', e => {
      carrousel.src = URL.createObjectURL(video.data.screenshots[e.target.value]);
    });

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressContainer.appendChild(progressBar);

    const statusLabel = pairContainer.querySelector(
      `#processing-video-${pairId}-${id} .processing-label`,
    );
    statusLabel.textContent = `Processing...`;

    const dimensionsLabel = document.createElement('div');
    dimensionsLabel.className = 'dimensions-label';

    const checksumLabel = document.createElement('div');
    checksumLabel.className = 'checksum-label';
    checksumLabel.textContent = `Checksum: ${video.data.checksum}`;

    // Remove the cancel button from individual video
    videoContainer.removeChild(statusLabel);
    videoContainer.appendChild(carrousel);
    videoContainer.appendChild(carrouselSlider);
    videoContainer.appendChild(progressContainer);
    videoContainer.appendChild(statusLabel);
    videoContainer.appendChild(dimensionsLabel);
    videoContainer.appendChild(checksumLabel);
    pairContainer.appendChild(videoContainer);

    let cancelButton = pairContainer.querySelector('.pair-cancel-button');

    // Add cancel button to pair container if it doesn't exist
    if (!cancelButton) {
      cancelButton = document.createElement('div');
      cancelButton.className = 'pair-cancel-button';
      cancelButton.textContent = '🚫';
      cancelButton.title = 'Cancel processing for both videos';

      pairContainer.appendChild(cancelButton);
    }

    cancelButton.addEventListener('click', () => {
      abortProcessing('cancelled by user');
    });

    const abortProcessing = reason => {
      statusLabel.textContent = `Processing aborted: ${reason}`;
      statusLabel.style.color = 'var(--error-color)';
      video.status = 'aborted';
      console.error(`Processing aborted: ${reason}`);
      video.data.screenshots = [];
      resolve();
      return;
    };

    // Create hidden video element for processing
    const processingVideo = document.createElement('video');
    processingVideo.src = URL.createObjectURL(file);
    processingVideo.style.display = 'none';
    document.body.appendChild(processingVideo);

    let fps = 0;
    getVideoFPS(file).then(returnedFPS => {
      fps = returnedFPS;
      if (fps < checkCriterias.fps * 0.9) {
        abortProcessing(`Didn't meet 100 FPS criteria (Found ${Math.round(fps)}).`);
        return;
      }
    });
    let processingTime = 0;
    const step = 1;

    processingVideo.onloadedmetadata = () => {
      let mediaRecorder;
      let stream;
      const duration = processingVideo.duration;
      video.data.duration = duration;
      const targetDuration = duration / playbackRate;

      if (processingVideo.videoWidth < checkCriterias.width * 0.9) {
        abortProcessing(`Didn't meet 3k criteria (Found ${processingVideo.videoWidth}px).`);
        return;
      }

      // Try different codec configurations
      const codecConfigs = [
        { mimeType: 'video/webm;codecs=vp9' },
        { mimeType: 'video/webm' },
        { mimeType: 'video/webm;codecs=vp8' },
        { mimeType: 'video/webm;codecs=vp8,opus' },
        { mimeType: 'video/mp4' },
      ];

      let selectedConfig = null;
      for (const config of codecConfigs) {
        if (MediaRecorder.isTypeSupported(config.mimeType)) {
          selectedConfig = config;
          break;
        }
      }

      if (!selectedConfig) {
        statusLabel.textContent = 'Error: No supported codec found';
        resolve();
        return;
      }

      const onFinishedProcessing = () => {
        if (video.status === 'aborted') {
          resolve();
          return;
        }
        if (video.data.screenshots.length === 0) {
          abortProcessing('No screenshots found');
          return;
        }
        if (video.data.screenshots.length < Math.round(duration * 0.99)) {
          abortProcessing(
            `Less screenshots than expected (${
              video.data.screenshots.length
            } < ${Math.round(processingTime * 0.99)})`,
          );
          return;
        }
        video.status = 'completed';
        video.data.fps = fps;
        video.data.processingTime = processingTime;
        const biggestVideoSize = document.getElementById('biggestVideoSize');
        biggestVideoSize.textContent = `${biggetVideosBlobSizes.toFixed(2)} MB`;

        dimensionsLabel.textContent = `${duration.toFixed(2)}s ${
          processingVideo.videoWidth
        }x${processingVideo.videoHeight} @ ${fps} FPS`;
        document.body.removeChild(processingVideo);
        statusLabel.textContent = `${
          window.onRITAVideoProcessed ? 'Uploading!' : 'Completed!'
        } (${processingTime.toFixed(2)} seconds) (Screenshots: ${
          video.data.screenshots.length
        } ${(screenshotsSize / 1024 / 1024).toFixed(2)} MB)`;

        videoProcessingQueue.videoCompleted(pairId);
        resolve();
      };

      try {
        // Create a canvas element
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = (canvas.width * processingVideo.videoHeight) / processingVideo.videoWidth;
        canvas.style.display = 'none';
        const ctx = canvas.getContext('2d');
        document.body.appendChild(canvas);

        let currentTime = 0;

        async function carrousel() {
          displayVideo.src = URL.createObjectURL(video.data.screenshots[0]);
        }

        async function captureFrames() {
          const startTime = Date.now();
          return new Promise(resolve => {
            const captureNext = () => {
              if (video.status === 'aborted') {
                resolve();
                return;
              }
              if (currentTime >= duration) {
                const endTime = Date.now();
                processingTime = (endTime - startTime) / 1000; // in seconds
                onFinishedProcessing();
                resolve();
                return;
              }

              const progress = currentTime / duration;

              progressBar.style.width = `${Math.min(progress * 100, 100)}%`;

              processingVideo.currentTime = currentTime;
            };

            processingVideo.addEventListener('seeked', function onSeeked() {
              const seekedStartTime = Date.now();

              ctx.drawImage(processingVideo, 0, 0, canvas.width, canvas.height);
              canvas.toBlob(
                blob => {
                  video.data.screenshots.push(blob);
                  screenshotsSize += blob.size;
                  const seekedEndTime = Date.now();
                  const seekedTime = seekedEndTime - seekedStartTime;

                  currentTime += step;
                  setTimeout(captureNext, 100); // short delay to avoid overloading
                },
                'image/webp',
                0.6,
              );
            });

            captureNext();
          });
        }
        captureFrames();
      } catch (e) {
        statusLabel.textContent = 'Error: Failed to create MediaRecorder';
        console.error('MediaRecorder error:', e);
        resolve();
        return;
      }
    };
  });
}

// Get the checksum of a file only over the first MB
async function getFileChecksum(file) {
  const arrayBuffer = await file.slice(0, 1024 * 1024).arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const hashBuffer = await crypto.subtle.digest('SHA-256', uint8Array);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getVideoFPS(file) {
  return new Promise(async resolve => {
    const readChunk = async (chunkSize, offset) => {
      return new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer());
    };
    MediaInfo.mediaInfoFactory({ format: 'object' }, mediainfo => {
      mediainfo.analyzeData(file.size, readChunk).then(result => {
        resolve(result.media.track[0].FrameRate);
      });
    });
  });
}
