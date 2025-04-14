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
    const pairContainer = document.getElementById(`video-pair-${pairId}`);

    const videoContainer = document.createElement('div');
    videoContainer.className = 'pair-video';
    videoContainer.id = `processing-video-${pairId}-${id}`;

    // Create visible video element for the pair
    const displayVideo = document.createElement('video');
    displayVideo.className = 'thumbnail';
    displayVideo.src = URL.createObjectURL(file);
    displayVideo.controls = false;

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

    const audioPlayer = document.createElement('audio');
    audioPlayer.className = 'audio-player';
    audioPlayer.controls = true;
    audioPlayer.style.width = '100%';
    audioPlayer.style.marginTop = '10px';
    audioPlayer.style.display = 'none';

    videoContainer.appendChild(displayVideo);
    videoContainer.appendChild(progressContainer);
    videoContainer.appendChild(statusLabel);
    videoContainer.appendChild(dimensionsLabel);
    videoContainer.appendChild(checksumLabel);
    videoContainer.appendChild(audioPlayer);
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
      let audioRecorder;
      let stream;

      const canvas = document.createElement('canvas');
      canvas.width = downsampledWidth;
      canvas.height =
        processingVideo.videoHeight *
        (downsampledWidth / processingVideo.videoWidth);

      const ctx = canvas.getContext('2d');
      stream = processingVideo.mozCaptureStream();

      const drawFrame = () => {
        ctx.drawImage(processingVideo, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };
      drawFrame();

      // Try different codec configurations
      const codecConfigs = [
        { mimeType: 'video/webm' },
        { mimeType: 'video/webm;codecs=vp8' },
        { mimeType: 'video/webm;codecs=vp8,opus' },
        { mimeType: 'video/mp4' },
      ];

      const audioConfig = { mimeType: 'audio/webm' };

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

      try {
        mediaRecorder = new MediaRecorder(stream, selectedConfig);

        // Create audio-only stream
        const audioStream = new MediaStream();
        stream.getAudioTracks().forEach((track) => {
          audioStream.addTrack(track);
        });

        audioRecorder = new MediaRecorder(audioStream, audioConfig);
      } catch (e) {
        statusLabel.textContent = 'Error: Failed to create MediaRecorder';
        console.error('MediaRecorder error:', e);
        resolve();
        return;
      }

      const videoChunks = [];
      const audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        videoChunks.push(e.data);
      };

      audioRecorder.ondataavailable = (e) => {
        audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(videoChunks, {
          type: selectedConfig.mimeType,
        });
        processedVideos.push({
          id,
          blob: videoBlob,
          checksum: videoChecksum,
        });
        dimensionsLabel.textContent = `${processingVideo.videoWidth}x${
          processingVideo.videoHeight
        } @ ${fps.toFixed(2)} FPS`;
        document.body.removeChild(processingVideo);
        statusLabel.textContent = `Processing complete! (${targetDuration.toFixed(
          2
        )} seconds) (${(videoBlob.size / 1024 / 1024).toFixed(2)} MB)`;

        // Replace the display video with the processed video blob
        displayVideo.src = URL.createObjectURL(videoBlob);
        displayVideo.playbackRate = invertedPlaybackRate;
        displayVideo.controls = true;
      };

      audioRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        processedAudios.push({
          blob: audioBlob,
          id,
        });
        audioPlayer.src = URL.createObjectURL(audioBlob);
        audioPlayer.playbackRate = invertedPlaybackRate;
        resolve();
      };

      const duration = processingVideo.duration;
      const targetDuration = duration / playbackRate;
      let currentTime = 0;

      processingVideo.playbackRate = playbackRate;
      mediaRecorder.start();
      audioRecorder.start();
      processingVideo.play();

      const progressInterval = setInterval(() => {
        currentTime += 0.1;
        const progress = (currentTime / targetDuration) * 100;
        progressBar.style.width = `${Math.min(progress, 100)}%`;

        if (currentTime >= targetDuration) {
          clearInterval(progressInterval);
          mediaRecorder.stop();
          audioRecorder.stop();
        }
      }, 100);
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
