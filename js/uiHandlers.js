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

// Handle pair videos button click
pairVideos.addEventListener('click', async () => {
  const usedPlaybackRate = playbackRate;
  const usedInvertedPlaybackRate = 1 / usedPlaybackRate;
  const pairId = crypto.randomUUID();
  console.log('Pair button clicked');
  // console.log('Current selectedVideos:', selectedVideos);

  // // Filter out any selected videos that are already hidden
  // selectedVideos = selectedVideos.filter(({ id }) => {
  //   const videoItem = document.getElementById(`video-item-${id}`);
  //   return videoItem && videoItem.style.display !== 'none';
  // });

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

  const alignmentResults = document.createElement('div');
  alignmentResults.className = 'alignment-results';
  alignmentResults.id = `alignment-results-${pairId}`;

  newPairCard.appendChild(pairVideosContainer);
  newPairCard.appendChild(alignmentResults);
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

  const currentPairAudios = processedAudios.filter(({ id }) =>
    pairedVideos.some(({ id: selectedId }) => selectedId === id)
  );

  // Get the last two audio blobs for this pair
  // const currentPairAudios = processedAudios.slice(-2);
  const alignmentResult = await audioAlign(
    currentPairAudios[0].blob,
    currentPairAudios[1].blob,
    usedPlaybackRate
  );

  // Update alignment results
  alignmentResults.innerHTML = `
    <strong>Audio Alignment Results:</strong><br>
    <span>Estimated offset: ${(
      alignmentResult.offset * usedPlaybackRate
    ).toFixed(3)} seconds</span><br>
    <span>Estimated overlap: ${(
      (alignmentResult.minDuration - Math.abs(alignmentResult.offset)) *
      usedPlaybackRate
    ).toFixed(3)} seconds</span><br>
    <span>Audio similarity confidence: ${alignmentResult.confidence.toFixed(
      1
    )}%</span>
  `;
});
