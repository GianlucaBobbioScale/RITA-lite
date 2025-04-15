async function processVideo(
  file,
  id,
  pairId,
  playbackRate,
  invertedPlaybackRate
) {
  const videoChecksum = await getFileChecksum(file);
  // const videoDuration = await getVideoDuration(file);
  return new Promise((resolve) => {
    let videoBlob;
    const pairContainer = document.getElementById(`video-pair-${pairId}`);

    const useCurrentTimeMethod = new URL(window.location.href).searchParams.get(
      'useTimer'
    );
    console.log('useCurrentTimeMethod', useCurrentTimeMethod);

    if (useCurrentTimeMethod) {
      playbackRate = 5;
      invertedPlaybackRate = 1 / playbackRate;
    }

    const videoContainer = document.createElement('div');
    videoContainer.className = 'pair-video';
    videoContainer.id = `processing-video-${pairId}-${id}`;

    // Create visible video element for the pair
    const displayVideo = document.createElement('video');
    displayVideo.className = 'thumbnail';
    displayVideo.src = URL.createObjectURL(file);
    displayVideo.controls = false;

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

    const statusLabel = document.createElement('div');
    statusLabel.className = 'processing-label';
    statusLabel.textContent = `Processing at ${playbackRate}x...`;

    const dimensionsLabel = document.createElement('div');
    dimensionsLabel.className = 'dimensions-label';

    const checksumLabel = document.createElement('div');
    checksumLabel.className = 'checksum-label';
    checksumLabel.textContent = `Checksum: ${videoChecksum}`;

    videoContainer.appendChild(displayVideo);
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
    processingVideo.ontimeupdate = () => {
      const stats = processingVideo.getVideoPlaybackQuality();
      fps = stats.totalVideoFrames / processingVideo.currentTime;
    };

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
        processedVideos.push({
          id,
          blob: videoBlob,
          checksum: videoChecksum,
        });

        // Calculate total size of all processed videos
        biggetVideosBlobSizes =
          processedVideos.reduce((total, video) => total + video.blob.size, 0) /
          (1024 * 1024); // Convert to MB

        const biggestVideoSize = document.getElementById('biggestVideoSize');
        biggestVideoSize.textContent = `${biggetVideosBlobSizes.toFixed(2)} MB`;

        dimensionsLabel.textContent = `${duration.toFixed(2)}s ${
          processingVideo.videoWidth
        }x${processingVideo.videoHeight} @ ${fps.toFixed(2)} FPS`;
        document.body.removeChild(processingVideo);
        statusLabel.textContent = `Processing complete ${playbackRate}x! (${targetDuration.toFixed(
          2
        )} seconds) (${(videoBlob.size / 1024 / 1024).toFixed(2)} MB)`;

        // Replace the display video with the processed video blob
        displayVideo.src = URL.createObjectURL(videoBlob);
        displayVideo.onloadedmetadata = () => {
          const processedDuration = displayVideo.duration;
          const durationDiffInSeconds = Math.abs(
            processedDuration - targetDuration
          );

          if (durationDiffInSeconds > playbackRate * 1.5) {
            // Allow 5 seconds tolerance
            statusLabel.textContent = `Warning: Duration mismatch! Expected ${targetDuration.toFixed(
              2
            )}s, got ${processedDuration.toFixed(2)}s`;
          } else {
            console.log('Duration is good!');
          }
        };
        // displayVideo.playbackRate = invertedPlaybackRate;
        displayVideo.controls = true;
        resolve();
      };

      const useCurrentTimeMethod = new URL(
        window.location.href
      ).searchParams.get('useTimer');
      console.log('useCurrentTimeMethod', useCurrentTimeMethod);

      try {
        if (useCurrentTimeMethod) {
          // Create a canvas element
          const screenshots = [];
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height =
            (canvas.width * processingVideo.videoHeight) /
            processingVideo.videoWidth;
          canvas.style.display = 'none';
          const ctx = canvas.getContext('2d');
          document.body.appendChild(canvas);

          const step = 1;
          let currentTime = 0;

          async function createVideoFromImages(images, fps = 4) {
            const encoder = new Whammy.Video(fps);

            for (let imgSrc of images) {
              const image = new Image();
              image.src = imgSrc;
              await new Promise((res) => (image.onload = res));

              // draw to temp canvas
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = image.width;
              tempCanvas.height = image.height;
              const tempCtx = tempCanvas.getContext('2d');
              tempCtx.drawImage(image, 0, 0);

              // add frame as canvas
              encoder.add(tempCanvas);
            }

            encoder.compile(false, (output) => {
              videoBlob = output;
              onFinishedProcessing();
            });
          }

          async function captureFrames() {
            return new Promise((resolve) => {
              const captureNext = () => {
                if (currentTime >= duration) {
                  createVideoFromImages(screenshots);
                  resolve();
                  return;
                }

                const progress = currentTime / duration;

                progressBar.style.width = `${Math.min(progress * 100, 100)}%`;

                processingVideo.currentTime = currentTime;

                processingVideo.addEventListener('seeked', function onSeeked() {
                  processingVideo.removeEventListener('seeked', onSeeked);

                  ctx.drawImage(
                    processingVideo,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                  );
                  canvas.toBlob((blob) => {
                    screenshots.push(URL.createObjectURL(blob));
                  }, 'image/png');

                  currentTime += step;
                  setTimeout(captureNext, 200); // short delay to avoid overloading
                });
              };

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
            stream = processingVideo.mozCaptureStream();
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

// async function getVideoDuration(file) {
//   return new Promise((resolve) => {
//     const video = document.createElement('video');
//     video.preload = 'metadata';
//     video.onloadedmetadata = () => {
//       resolve(video.duration);
//     };
//     video.src = URL.createObjectURL(file);
//   });
// }

// Get the checksum of a file only over the first MB
async function getFileChecksum(file) {
  const arrayBuffer = await file.slice(0, 1024 * 1024).arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const hashBuffer = await crypto.subtle.digest('SHA-256', uint8Array);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
