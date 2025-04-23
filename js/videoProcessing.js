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
  video.data.checksum = 'test';
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
    // lazy load the video
    processingVideo.preload = 'metadata';
    processingVideo.loading = 'lazy';
    processingVideo.src = URL.createObjectURL(file);
    processingVideo.style.display = 'none';
    document.body.appendChild(processingVideo);

    let fps = 0;
    // extractor.extractFPS(file).then(returnedFPS => {
    //   console.log('returnedFPS', returnedFPS);
    //   fps = returnedFPS;
    //   if (fps < checkCriterias.fps * 0.9) {
    //     abortProcessing(`Didn't meet 100 FPS criteria (Found ${Math.round(fps)}).`);
    //     return;
    //   }
    // });
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
            `Less screenshots than expected (${video.data.screenshots.length} < ${Math.round(
              processingTime * 0.99,
            )})`,
          );
          return;
        }
        video.status = 'completed';
        video.data.fps = fps;
        video.data.processingTime = processingTime;
        const biggestVideoSize = document.getElementById('biggestVideoSize');
        biggestVideoSize.textContent = `${biggetVideosBlobSizes.toFixed(2)} MB`;

        dimensionsLabel.textContent = `${duration.toFixed(2)}s ${processingVideo.videoWidth}x${
          processingVideo.videoHeight
        } @ ${fps} FPS`;
        document.body.removeChild(processingVideo);
        statusLabel.textContent = `${
          window.onRITAVideoProcessed ? 'Uploading!' : 'Completed!'
        } (${processingTime.toFixed(2)} seconds) (Screenshots: ${video.data.screenshots.length} ${(
          screenshotsSize /
          1024 /
          1024
        ).toFixed(2)} MB)`;

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

class INSVFPSExtractor {
  CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  ATOM_HEADER_SIZE = 8; // 4 bytes size + 4 bytes type
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.maxReadSize = options.maxReadSize || 10 * this.CHUNK_SIZE; // Default 10MB max
    this.chunkSize = options.chunkSize || this.CHUNK_SIZE;
    this.logCallback = options.logCallback || console.log;
    this.tempData = null; // Store references to large data objects for cleanup
  }

  /**
   * Extract FPS from a file
   * @param {File} file - The File object to process
   * @param {Function} callback - Callback function(fps, logMessages)
   * @returns {Promise} - Promise that resolves with the FPS value
   */
  async extractFPS(file, callback) {
    const logs = [];
    let fps = null;

    const log = message => {
      logs.push(message);
      if (this.debug && this.logCallback) {
        this.logCallback(message);
      }
    };

    try {
      log(`Processing ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

      // Find moov atom
      const moovInfo = await this.findMoovAtom(file, log);
      if (!moovInfo) {
        log("Couldn't find 'moov' atom in the file. This might not be a valid INSV file.");
        if (callback) callback(null, logs);
        this.cleanup();
        return null;
      }

      const { offset: moovOffset, size: moovSize, data: moovData } = moovInfo;
      // Store reference to large data for cleanup
      this.tempData = moovData;

      // Extract FPS from moov data
      fps = this.extractFPSInfo(moovData, moovOffset, log);

      if (callback) callback(fps, logs);
      this.cleanup();
      return fps;
    } catch (error) {
      log(`Error: ${error.message}`);
      if (callback) callback(null, logs);
      this.cleanup();
      return null;
    }
  }

  /**
   * Find the moov atom in the file by reading chunks
   * @private
   */
  async findMoovAtom(file, log) {
    const fileSize = file.size;
    let tempChunk = null;

    // Start from the end of the file and work backwards
    for (
      let offset = Math.max(0, fileSize - this.chunkSize);
      offset >= 0;
      offset -= this.chunkSize
    ) {
      const chunkSize = Math.min(this.chunkSize, offset + this.chunkSize);
      const chunk = await this.readChunk(file, offset, chunkSize);
      log(`Reading chunk at offset ${offset}...`);

      // Search for 'moov' atom in this chunk
      const moovIndex = this.findAtom(chunk, 'moov');

      if (moovIndex !== -1) {
        const absoluteOffset = offset + moovIndex;
        log(`Found 'moov' atom at offset ${absoluteOffset}`);

        // Get the size of the moov atom (first 4 bytes)
        const moovSize =
          (chunk[moovIndex] << 24) |
          (chunk[moovIndex + 1] << 16) |
          (chunk[moovIndex + 2] << 8) |
          chunk[moovIndex + 3];

        log(`MOOV atom size: ${moovSize} bytes`);

        // We don't need the search chunk anymore
        tempChunk = null;

        // Read the entire moov atom with its actual size
        const readSize = Math.min(moovSize, this.maxReadSize);
        const moovData = await this.readChunk(file, absoluteOffset, readSize);

        log(`Read ${readSize} bytes of MOOV data`);

        return {
          offset: absoluteOffset,
          size: moovSize,
          data: moovData,
        };
      }

      // Free the previous chunk from memory
      tempChunk = null;
      tempChunk = chunk;
    }

    return null;
  }

  /**
   * Read a specific chunk of a file
   * @private
   */
  readChunk(file, start, length) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = new Uint8Array(reader.result);
        // Clear the reference to the result to help garbage collection
        reader.onload = null;
        reader.onerror = null;
        resolve(data);
      };
      reader.onerror = error => {
        if (this.debug) {
          this.logCallback(`Error reading file chunk: ${error}`);
        }
        reader.onload = null;
        reader.onerror = null;
        resolve(new Uint8Array(0)); // Return empty array on error
      };
      reader.readAsArrayBuffer(file.slice(start, start + length));
    });
  }

  /**
   * Clean up any large objects to free memory
   */
  cleanup() {
    if (this.debug) {
      this.logCallback('Cleaning up memory...');
    }
    this.tempData = null;
  }

  /**
   * Find a specific atom in a chunk of data
   * @private
   */
  findAtom(data, atomName) {
    const targetBytes = [
      atomName.charCodeAt(0),
      atomName.charCodeAt(1),
      atomName.charCodeAt(2),
      atomName.charCodeAt(3),
    ];

    for (let i = 0; i < data.length - 4; i++) {
      if (
        data[i] === targetBytes[0] &&
        data[i + 1] === targetBytes[1] &&
        data[i + 2] === targetBytes[2] &&
        data[i + 3] === targetBytes[3]
      ) {
        // Go back 4 bytes to include the size field (if possible)
        return Math.max(0, i - 4);
      }
    }

    return -1;
  }

  /**
   * Extract FPS information from moov data
   * @private
   */
  extractFPSInfo(moovData, moovOffset, log) {
    log(`Extracting FPS information from moov atom...`);
    log(`MOOV data size: ${moovData.length} bytes`);

    // First, find mvhd atom inside moov
    let offset = 8; // Skip moov atom header
    let fps = null;
    let tempData = null; // For temporary slices

    // Log all top-level atoms for debugging
    log(`Top-level atoms in MOOV:`);
    let debugOffset = 8;
    while (debugOffset < Math.min(moovData.length - 8, 1000)) {
      if (debugOffset + 8 >= moovData.length) break;

      const atomSize =
        (moovData[debugOffset] << 24) |
        (moovData[debugOffset + 1] << 16) |
        (moovData[debugOffset + 2] << 8) |
        moovData[debugOffset + 3];

      if (atomSize <= 0 || atomSize > moovData.length) break;

      const atomType = String.fromCharCode(
        moovData[debugOffset + 4],
        moovData[debugOffset + 5],
        moovData[debugOffset + 6],
        moovData[debugOffset + 7],
      );

      log(` - ${atomType} (size: ${atomSize} bytes)`);
      debugOffset += atomSize;

      if (atomSize < 8) break; // Prevent infinite loop
    }

    while (offset < moovData.length - 8) {
      if (offset + 8 >= moovData.length) {
        log(`Reached end of data while parsing`);
        break;
      }

      const size =
        (moovData[offset] << 24) |
        (moovData[offset + 1] << 16) |
        (moovData[offset + 2] << 8) |
        moovData[offset + 3];

      if (size <= 0 || size > moovData.length) {
        log(`Invalid atom size: ${size} at offset ${offset}`);
        break;
      }

      const type = String.fromCharCode(
        moovData[offset + 4],
        moovData[offset + 5],
        moovData[offset + 6],
        moovData[offset + 7],
      );

      log(`Processing ${type} atom (size: ${size})`);

      if (type === 'mvhd') {
        log(`Found mvhd atom at offset ${moovOffset + offset}`);

        // Check version
        const version = moovData[offset + 8];
        log(`mvhd version: ${version}`);
        let timescale, duration;

        if (version === 0) {
          // 32-bit values
          timescale =
            (moovData[offset + 20] << 24) |
            (moovData[offset + 21] << 16) |
            (moovData[offset + 22] << 8) |
            moovData[offset + 23];

          duration =
            (moovData[offset + 24] << 24) |
            (moovData[offset + 25] << 16) |
            (moovData[offset + 26] << 8) |
            moovData[offset + 27];
        } else {
          // 64-bit values
          timescale =
            (moovData[offset + 28] << 24) |
            (moovData[offset + 29] << 16) |
            (moovData[offset + 30] << 8) |
            moovData[offset + 31];

          // We'll only use the lower 32 bits of duration for simplicity
          duration =
            (moovData[offset + 36] << 24) |
            (moovData[offset + 37] << 16) |
            (moovData[offset + 38] << 8) |
            moovData[offset + 39];
        }

        log(`mvhd timescale: ${timescale}`);
        log(`mvhd duration: ${duration}`);

        // Try to estimate FPS from mvhd
        if (timescale > 0) {
          const estimatedFps = timescale / (duration / 60);
          log(`Estimated FPS from mvhd: ${estimatedFps.toFixed(3)}`);
        }
      }

      if (type === 'trak') {
        log(`Processing trak atom at offset ${moovOffset + offset}`);

        // Process trak data directly without slicing
        const trakStart = offset;
        const trakEnd = offset + size;

        // Look for mdia atom inside trak
        let mdiaOffset = -1;
        for (let i = trakStart + 8; i < trakEnd - 8; i++) {
          if (
            moovData[i] === 'm'.charCodeAt(0) &&
            moovData[i + 1] === 'd'.charCodeAt(0) &&
            moovData[i + 2] === 'i'.charCodeAt(0) &&
            moovData[i + 3] === 'a'.charCodeAt(0)
          ) {
            mdiaOffset = i - 4;
            break;
          }
        }

        if (mdiaOffset !== -1) {
          log(`Found mdia atom`);

          // Process mdia data directly
          const mdiaSize =
            (moovData[mdiaOffset] << 24) |
            (moovData[mdiaOffset + 1] << 16) |
            (moovData[mdiaOffset + 2] << 8) |
            moovData[mdiaOffset + 3];
          const mdiaEnd = mdiaOffset + mdiaSize;

          // Instead of remaining slice operations, continue with direct offset calculations
          // and process the data in-place

          // Check for hdlr to see track type
          const hdlrOffset = this.findAtom(moovData.slice(mdiaOffset, mdiaEnd), 'hdlr');
          if (hdlrOffset !== -1) {
            // Get handler type (12 bytes after hdlr start + 8 for header)
            if (hdlrOffset + 20 < mdiaEnd) {
              const handlerType = String.fromCharCode(
                moovData[mdiaOffset + hdlrOffset + 16],
                moovData[mdiaOffset + hdlrOffset + 17],
                moovData[mdiaOffset + hdlrOffset + 18],
                moovData[mdiaOffset + hdlrOffset + 19],
              );
              log(`Track type: ${handlerType}`);

              // Only process video tracks
              if (handlerType !== 'vide') {
                log(`Skipping non-video track`);
                offset += size;
                continue;
              }
            }
          }

          const mdhdOffset = this.findAtom(moovData.slice(mdiaOffset, mdiaEnd), 'mdhd');

          if (mdhdOffset !== -1) {
            log(`Found mdhd atom`);

            // Parse mdhd atom for media timescale
            const mdhdVersion = moovData[mdiaOffset + mdhdOffset + 8];
            log(`mdhd version: ${mdhdVersion}`);
            let mediaTimescale;

            if (mdhdVersion === 0) {
              mediaTimescale =
                (moovData[mdiaOffset + mdhdOffset + 20] << 24) |
                (moovData[mdiaOffset + mdhdOffset + 21] << 16) |
                (moovData[mdiaOffset + mdhdOffset + 22] << 8) |
                moovData[mdiaOffset + mdhdOffset + 23];
            } else {
              mediaTimescale =
                (moovData[mdiaOffset + mdhdOffset + 28] << 24) |
                (moovData[mdiaOffset + mdhdOffset + 29] << 16) |
                (moovData[mdiaOffset + mdhdOffset + 30] << 8) |
                moovData[mdiaOffset + mdhdOffset + 31];
            }

            log(`mdhd timescale: ${mediaTimescale}`);

            // Now look for stbl atom to find sample information
            const minfOffset = this.findAtom(moovData.slice(mdiaOffset, mdiaEnd), 'minf');
            if (minfOffset !== -1) {
              log(`Found minf atom`);
              const stblOffset = this.findAtom(moovData.slice(mdiaOffset, mdiaEnd), 'stbl');

              if (stblOffset !== -1) {
                log(`Found stbl atom`);
                const stblData = moovData.slice(mdiaOffset, mdiaEnd);

                // Find stsz for sample size info
                const stszOffset = this.findAtom(stblData, 'stsz');
                if (stszOffset !== -1) {
                  const sampleCount =
                    (stblData[stszOffset + 12] << 24) |
                    (stblData[stszOffset + 13] << 16) |
                    (stblData[stszOffset + 14] << 8) |
                    stblData[stszOffset + 15];
                  log(`Total video samples: ${sampleCount}`);
                }

                const sttsOffset = this.findAtom(stblData, 'stts');

                if (sttsOffset !== -1) {
                  log(`Found stts atom`);

                  // Jump past version/flags (4 bytes) and entry count (4 bytes)
                  const entryCount =
                    (stblData[sttsOffset + 12] << 24) |
                    (stblData[sttsOffset + 13] << 16) |
                    (stblData[sttsOffset + 14] << 8) |
                    stblData[sttsOffset + 15];

                  log(`stts entry count: ${entryCount}`);

                  if (entryCount > 0) {
                    // Dump first few entries for debugging
                    log('stts entries:');
                    let entryOffset = sttsOffset + 16;
                    for (let i = 0; i < Math.min(entryCount, 5); i++) {
                      if (entryOffset + 8 <= stblData.length) {
                        const sampleCount =
                          (stblData[entryOffset] << 24) |
                          (stblData[entryOffset + 1] << 16) |
                          (stblData[entryOffset + 2] << 8) |
                          stblData[entryOffset + 3];

                        const sampleDelta =
                          (stblData[entryOffset + 4] << 24) |
                          (stblData[entryOffset + 5] << 16) |
                          (stblData[entryOffset + 6] << 8) |
                          stblData[entryOffset + 7];

                        log(` - Count: ${sampleCount}, Delta: ${sampleDelta}`);

                        if (i === 0 && sampleDelta > 0 && mediaTimescale > 0) {
                          fps = mediaTimescale / sampleDelta;
                          log(`   -> FPS: ${fps.toFixed(3)}`);
                        }

                        entryOffset += 8;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      offset += size;

      // Safety check
      if (offset <= 0 || size <= 0) {
        log('Invalid atom structure detected, stopping parsing');
        break;
      }
    }

    // Clear any temporary data references
    tempData = null;

    if (fps !== null) {
      log(`==========================================`);
      log(`Final calculated FPS: ${fps.toFixed(3)}`);
      log(`==========================================`);
    } else {
      log(`Couldn't calculate FPS. Couldn't find required atoms or valid data.`);
    }

    return fps;
  }
}

// const extractor = new INSVFPSExtractor({
//   debug: true,
//   logCallback: message => {
//     console.log(message);
//   },
// });
