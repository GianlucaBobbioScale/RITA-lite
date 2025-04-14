async function audioAlign(audioBlob1, audioBlob2, playbackRate) {
  async function decode(file) {
    const buffer = await file.arrayBuffer();
    return ctx.decodeAudioData(buffer);
  }

  function calculateSimilarityConfidence(signal1, signal2) {
    // Only analyze first minute (adjusted by playback rate)
    const targetWindowSeconds = 60 / playbackRate;
    const maxSamples = Math.floor(targetWindowSeconds * ctx.sampleRate);

    // Take first minute of both signals
    const s1 = signal1.slice(0, maxSamples);
    const s2 = signal2.slice(0, maxSamples);

    // Calculate energy of both signals
    const energy1 = s1.reduce((sum, x) => sum + x * x, 0) / s1.length;
    const energy2 = s2.reduce((sum, x) => sum + x * x, 0) / s2.length;

    // Calculate energy ratio (how similar are the overall volumes)
    const energyRatio = Math.min(energy1, energy2) / Math.max(energy1, energy2);

    // Calculate cross-correlation at zero offset for overall similarity
    let correlation = 0;
    const minLength = Math.min(s1.length, s2.length);
    for (let i = 0; i < minLength; i += 64) {
      correlation += s1[i] * s2[i];
    }
    correlation = correlation / (minLength / 64);

    // Normalize correlation to 0-1 range
    const normalizedCorrelation = (correlation + 1) / 2;

    // Combine energy ratio and correlation for final confidence
    const confidence = (energyRatio * 0.4 + normalizedCorrelation * 0.6) * 100;

    return Math.min(100, Math.max(0, confidence));
  }

  function findOffset(signal1, signal2) {
    console.log('Finding offset using cross-correlation...');
    console.log(`Signal 1 length: ${signal1.length} samples`);
    console.log(`Signal 2 length: ${signal2.length} samples`);

    // Normalize signals
    const normalizeSignal = (signal) => {
      let max = 0;
      for (let i = 0; i < signal.length; i++) {
        max = Math.max(max, Math.abs(signal[i]));
      }
      return signal.map((x) => x / max);
    };

    const norm1 = normalizeSignal(signal1);
    const norm2 = normalizeSignal(signal2);

    // Use the shorter signal as the reference
    const reference = norm2;
    const search = norm1;

    // Focus on first minute (adjusted by playback rate)
    const targetWindowSeconds = 60 / playbackRate;
    const maxOffset = Math.floor(targetWindowSeconds * ctx.sampleRate);
    console.log(
      `Searching in first ${targetWindowSeconds.toFixed(
        2
      )} seconds (${maxOffset} samples)`
    );

    let bestOffset = 0;
    let bestCorrelation = -Infinity;
    const correlations = [];

    // Perform cross-correlation with finer granularity
    for (let offset = 0; offset <= maxOffset; offset += 64) {
      // Reduced step size for more granularity
      let correlation = 0;
      let count = 0;

      // Compare overlapping parts
      for (let i = 0; i < reference.length; i += 64) {
        // Reduced step size for more granularity
        if (i + offset < search.length) {
          correlation += search[i + offset] * reference[i];
          count++;
        }
      }

      correlation = count > 0 ? correlation / count : 0;
      correlations.push({ offset, correlation });

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
        console.log(
          `New best offset: ${offset} samples (${(
            offset / ctx.sampleRate
          ).toFixed(3)}s), correlation: ${correlation.toFixed(4)}`
        );
      }
    }

    // Log top 10 correlations
    correlations.sort((a, b) => b.correlation - a.correlation);
    console.log('\nTop 10 correlations:');
    correlations.slice(0, 10).forEach((c, i) => {
      console.log(
        `${i + 1}. Offset: ${c.offset} samples (${(
          c.offset / ctx.sampleRate
        ).toFixed(3)}s), Correlation: ${c.correlation.toFixed(4)}`
      );
    });

    return bestOffset;
  }

  const f1 = audioBlob1;
  const f2 = audioBlob2;
  console.log('f1 and f2:');
  console.log(f1, f2);
  if (!f1 || !f2) return alert('Select both files!');

  console.log('Starting audio comparison...');
  console.log(`File 1: ${f1.name}, size: ${f1.size} bytes`);
  console.log(`File 2: ${f2.name}, size: ${f2.size} bytes`);

  const [b1, b2] = await Promise.all([decode(f1), decode(f2)]);
  const fs = ctx.sampleRate;
  const minDuration = Math.min(b1.duration, b2.duration);

  console.log(`Audio context sample rate: ${fs} Hz`);
  console.log(`File 1 duration: ${b1.duration.toFixed(3)} seconds`);
  console.log(`File 2 duration: ${b2.duration.toFixed(3)} seconds`);

  // Get the raw audio data
  const signal1 = b1.getChannelData(0);
  const signal2 = b2.getChannelData(0);

  // Find the offset using cross-correlation
  const offsetSamples = findOffset(signal1, signal2);
  const offsetSeconds = offsetSamples / fs;

  // Calculate similarity confidence
  const confidence = calculateSimilarityConfidence(signal1, signal2);

  // Draw waveforms
  // const videoItems = document.querySelectorAll('.video-item');
  // const canvas1 = videoItems[0].querySelector('canvas');
  // const canvas2 = videoItems[1].querySelector('canvas');

  // drawWaveform(canvas1, signal1, 0, '#4caf50');
  // drawWaveform(canvas2, signal2, offsetSamples, '#2196f3');
  return { offset: offsetSeconds, confidence, minDuration };
}
