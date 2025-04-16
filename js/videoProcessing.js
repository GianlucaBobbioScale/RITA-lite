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
async function processVideo(
  file,
  id,
  pairId,
  playbackRate,
  invertedPlaybackRate
) {
  const videoChecksum = await getFileChecksum(file);

  return new Promise((resolve) => {
    let videoBlob;
    let screenshots = [];
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
      carrousel.src = URL.createObjectURL(screenshots[e.target.value]);
    });

    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Download video';
    downloadButton.className = 'download-button';
    downloadButton.style.display = 'none';
    downloadButton.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = displayVideo.src;
      a.download = 'output.webm';
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
    checksumLabel.textContent = `Checksum: ${videoChecksum}`;

    videoContainer.removeChild(statusLabel);
    videoContainer.appendChild(carrousel);
    videoContainer.appendChild(carrouselSlider);
    videoContainer.appendChild(progressContainer);
    videoContainer.appendChild(statusLabel);
    videoContainer.appendChild(dimensionsLabel);
    videoContainer.appendChild(checksumLabel);
    videoContainer.appendChild(downloadButton);
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
        const processedVideo = {
          id,
          blob: videoBlob,
          screenshots,
          checksum: videoChecksum,
        };
        processedVideos.push(processedVideo);

        const biggestVideoSize = document.getElementById('biggestVideoSize');
        biggestVideoSize.textContent = `${biggetVideosBlobSizes.toFixed(2)} MB`;

        dimensionsLabel.textContent = `${duration.toFixed(2)}s ${
          processingVideo.videoWidth
        }x${processingVideo.videoHeight} @ ${fps.toFixed(2)} FPS`;
        document.body.removeChild(processingVideo);
        statusLabel.textContent = `Processing complete! (${processingTime.toFixed(
          2
        )} seconds) (Screenshots: ${screenshots.length} ${(
          screenshotsSize /
          1024 /
          1024
        ).toFixed(2)} MB)`;

        // Replace the display video with a carrousel of screenshots
        // change displayVideo from video to img
        displayVideo.style.display = 'none';
        carrousel.src = URL.createObjectURL(screenshots[0]);
        carrousel.style.display = 'block';

        carrouselSlider.src = URL.createObjectURL(screenshots[0]);
        carrouselSlider.max = screenshots.length / step - 1;
        carrouselSlider.style.display = 'block';
        window.onRITAVideoProcessed(processedVideo);
        resolve();
      };

      try {
        if (useCurrentTimeMethod) {
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

          async function carrousel(screenshots) {
            displayVideo.src = URL.createObjectURL(screenshots[0]);
          }

          async function screenshotsToJsonBinary(screenshots) {
            function blobToBase64(blob) {
              return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
            }
            const json = await Promise.all(
              screenshots.map(async (blob) => {
                const base64 = await blobToBase64(blob);
                return { base64, size: blob.size, type: blob.type };
              })
            );

            const a = document.createElement('a');
            a.href = URL.createObjectURL(
              new Blob([JSON.stringify(json)], { type: 'application/json' })
            );
            a.download = 'screenshots.json';
            a.click();

            return json;
          }

          async function captureFrames() {
            const startTime = Date.now();
            let seekedAskedTime;
            return new Promise((resolve) => {
              const captureNext = () => {
                if (currentTime >= duration) {
                  screenshotsToJsonBinary(screenshots);
                  const endTime = Date.now();
                  processingTime = (endTime - startTime) / 1000; // in seconds
                  onFinishedProcessing();
                  resolve();
                  return;
                }

                const progress = currentTime / duration;

                progressBar.style.width = `${Math.min(progress * 100, 100)}%`;

                seekedAskedTime = Date.now();
                processingVideo.currentTime = currentTime;
              };

              processingVideo.addEventListener('seeked', function onSeeked() {
                const seekedStartTime = Date.now();

                ctx.drawImage(
                  processingVideo,
                  0,
                  0,
                  canvas.width,
                  canvas.height
                );
                canvas.toBlob(
                  (blob) => {
                    screenshots.push(blob);
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
        } else {
          // else use the normal media recorder method
          const useCanvas = new URL(window.location.href).searchParams.get(
            'useCanvas'
          );
          console.log('useCanvas', useCanvas);
          const highVideoBitsPerSecond = new URL(
            window.location.href
          ).searchParams.get('highVideoBitsPerSecond');
          console.log('highVideoBitsPerSecond', highVideoBitsPerSecond);
          const config = {
            mimeType: selectedConfig.mimeType,
            frameRate: 100,
            ...(highVideoBitsPerSecond
              ? {
                  videoBitsPerSecond: 10_000_000,
                }
              : {}),
          };
          if (useCanvas) {
            // Create a canvas element
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height =
              (640 / processingVideo.videoWidth) * processingVideo.videoHeight;
            canvas.style.display = 'none';
            const ctx = canvas.getContext('2d');
            document.body.appendChild(canvas);

            // Capture the canvas stream
            const canvasStream = canvas.captureStream(100);

            // Set up MediaRecorder with the canvas stream
            mediaRecorder = new MediaRecorder(canvasStream, config);

            // Draw video frames on the canvas
            function drawFrame() {
              ctx.drawImage(processingVideo, 0, 0, canvas.width, canvas.height);
              requestAnimationFrame(drawFrame);
            }

            // Start drawing frames
            drawFrame();
          } else {
            // if firefox
            if (navigator.userAgent.includes('Firefox')) {
              stream = processingVideo.mozCaptureStream();
            } else {
              stream = processingVideo.captureStream();
            }
            mediaRecorder = new MediaRecorder(stream, config);
          }
          const videoChunks = [];

          mediaRecorder.ondataavailable = (e) => {
            videoChunks.push(e.data);
          };

          mediaRecorder.onstop = () => {
            videoBlob = new Blob(videoChunks, {
              type: selectedConfig.mimeType,
            });
            onFinishedProcessing();
          };

          let currentTime = 0;

          processingVideo.playbackRate = playbackRate;
          mediaRecorder.start();
          processingVideo.muted = true;
          processingVideo.play();

          const progressInterval = setInterval(() => {
            currentTime += 0.1;
            const progress = (currentTime / targetDuration) * 100;
            progressBar.style.width = `${Math.min(progress, 100)}%`;

            if (currentTime >= targetDuration) {
              clearInterval(progressInterval);
              mediaRecorder.stop();
            }
          }, 100);
        }
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
