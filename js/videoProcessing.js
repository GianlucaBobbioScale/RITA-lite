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
  const statusLabel = document.querySelector(
    `#processing-video-${pairId}-${id} .processing-label`
  );
  statusLabel.style.color = 'green';
  statusLabel.textContent = `Uploaded!`;
  const dimensionsLabel = document.querySelector(
    `#processing-video-${pairId}-${id} .dimensions-label`
  );
  dimensionsLabel.style.display = 'none';
}

async function processVideo(
  file,
  id,
  pairId,
  playbackRate,
  invertedPlaybackRate
) {
  const video = videoProcessingQueue.allQueue
    .find(({ pairIdArg }) => pairIdArg === pairId)
    .videos.find(({ id: videoId }) => videoId === id);
  video.data = video.data || {};
  video.data.checksum = await getFileChecksum(file);
  video.data.screenshots = video.data.screenshots || [];
  return new Promise((resolve) => {
    let screenshotsSize = 0;
    const pairContainer = document.getElementById(`video-pair-${pairId}`);

    const useCurrentTimeMethod = true;

    if (useCurrentTimeMethod) {
      playbackRate = 5;
      invertedPlaybackRate = 1 / playbackRate;
    }

    const videoContainer = document.getElementById(
      `processing-video-${pairId}-${id}`
    );

    // Create visible video element for the pair
    const displayVideo = pairContainer.querySelector(
      `#processing-video-${pairId}-${id} video`
    );

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
    carrouselSlider.addEventListener('input', (e) => {
      carrousel.src = URL.createObjectURL(
        video.data.screenshots[e.target.value]
      );
    });

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressContainer.appendChild(progressBar);

    const statusLabel = pairContainer.querySelector(
      `#processing-video-${pairId}-${id} .processing-label`
    );
    statusLabel.textContent = `Processing...`;

    const dimensionsLabel = document.createElement('div');
    dimensionsLabel.className = 'dimensions-label';

    const checksumLabel = document.createElement('div');
    checksumLabel.className = 'checksum-label';
    checksumLabel.textContent = `Checksum: ${video.data.checksum}`;

    videoContainer.removeChild(statusLabel);
    videoContainer.appendChild(carrousel);
    videoContainer.appendChild(carrouselSlider);
    videoContainer.appendChild(progressContainer);
    videoContainer.appendChild(statusLabel);
    videoContainer.appendChild(dimensionsLabel);
    videoContainer.appendChild(checksumLabel);
    pairContainer.appendChild(videoContainer);

    // Create hidden video element for processing
    const processingVideo = document.createElement('video');
    processingVideo.src = URL.createObjectURL(file);
    processingVideo.style.display = 'none';
    document.body.appendChild(processingVideo);

    let fps = 0;
    getVideoFPS(file).then((returnedFPS) => {
      fps = returnedFPS;
    });
    let processingTime = 0;
    const step = 1;

    processingVideo.onloadedmetadata = () => {
      let mediaRecorder;
      let stream;
      const duration = processingVideo.duration;
      video.data.duration = duration;
      const targetDuration = duration / playbackRate;

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
        video.status = 'completed';
        video.data.fps = fps;
        video.data.processingTime = processingTime;
        const biggestVideoSize = document.getElementById('biggestVideoSize');
        biggestVideoSize.textContent = `${biggetVideosBlobSizes.toFixed(2)} MB`;

        dimensionsLabel.textContent = `${duration.toFixed(2)}s ${
          processingVideo.videoWidth
        }x${processingVideo.videoHeight} @ ${fps.toFixed(2)} FPS`;
        document.body.removeChild(processingVideo);
        statusLabel.textContent = `Uploading! (${processingTime.toFixed(
          2
        )} seconds) (Screenshots: ${video.data.screenshots.length} ${(
          screenshotsSize /
          1024 /
          1024
        ).toFixed(2)} MB)`;

        // displayVideo.style.display = 'none';
        // carrousel.src = URL.createObjectURL(video.data.screenshots[0]);
        // carrousel.style.display = 'block';

        // carrouselSlider.src = URL.createObjectURL(video.data.screenshots[0]);
        // carrouselSlider.max = video.data.screenshots.length / step - 1;
        // carrouselSlider.style.display = 'block';
        videoProcessingQueue.videoCompleted(pairId);
        resolve();
      };

      try {
        // Create a canvas element
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height =
          (canvas.width * processingVideo.videoHeight) /
          processingVideo.videoWidth;
        canvas.style.display = 'none';
        const ctx = canvas.getContext('2d');
        document.body.appendChild(canvas);

        let currentTime = 0;

        async function carrousel() {
          displayVideo.src = URL.createObjectURL(video.data.screenshots[0]);
        }

        async function captureFrames() {
          const startTime = Date.now();
          return new Promise((resolve) => {
            const captureNext = () => {
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
                (blob) => {
                  video.data.screenshots.push(blob);
                  screenshotsSize += blob.size;
                },
                'image/webp',
                0.6
              );
              const seekedEndTime = Date.now();
              const seekedTime = seekedEndTime - seekedStartTime;

              currentTime += step;
              setTimeout(captureNext, 100); // short delay to avoid overloading
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
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getVideoFPS(file) {
  return new Promise(async (resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    await video.play();
    // play for 5 seconds
    setTimeout(() => {
      video.pause();
      const fps =
        video.getVideoPlaybackQuality().totalVideoFrames / video.currentTime;

      resolve(fps);
    }, 5000);
  });
}
