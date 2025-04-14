async function audioAlign(audioBlob1, audioBlob2, playbackRate) {
  async function decode(file) {
    const buffer = await file.arrayBuffer();
    return ctx.decodeAudioData(buffer);
  }

  // Helper function to apply Hamming window
  function applyHammingWindow(signal) {
    const window = new Float32Array(signal.length);
    for (let i = 0; i < signal.length; i++) {
      window[i] =
        signal[i] *
        (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (signal.length - 1)));
    }
    return window;
  }

  // Helper function to compute FFT
  function fft(signal) {
    const n = signal.length;
    if (n === 1) return signal;

    const even = new Float32Array(n / 2);
    const odd = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      even[i] = signal[2 * i];
      odd[i] = signal[2 * i + 1];
    }

    const evenFFT = fft(even);
    const oddFFT = fft(odd);

    const result = new Float32Array(n);
    for (let k = 0; k < n / 2; k++) {
      const t = oddFFT[k] * Math.exp((-2 * Math.PI * k) / n);
      result[k] = evenFFT[k] + t;
      result[k + n / 2] = evenFFT[k] - t;
    }
    return result;
  }

  // Helper function to compute power spectrum
  function computePowerSpectrum(signal) {
    const windowed = applyHammingWindow(signal);
    const spectrum = fft(windowed);
    const powerSpectrum = new Float32Array(spectrum.length / 2);
    for (let i = 0; i < powerSpectrum.length; i++) {
      powerSpectrum[i] = Math.pow(Math.abs(spectrum[i]), 2);
    }
    return powerSpectrum;
  }

  // Helper function to create mel filterbank
  function createMelFilterbank(numFilters, fftSize, sampleRate) {
    const melMin = 0;
    const melMax = 2595 * Math.log10(1 + sampleRate / 2 / 700);
    const melPoints = new Float32Array(numFilters + 2);
    const hzPoints = new Float32Array(numFilters + 2);
    const filterbank = new Float32Array(numFilters * (fftSize / 2 + 1));

    for (let i = 0; i < numFilters + 2; i++) {
      melPoints[i] = melMin + ((melMax - melMin) * i) / (numFilters + 1);
      hzPoints[i] = 700 * (Math.pow(10, melPoints[i] / 2595) - 1);
    }

    for (let i = 0; i < numFilters; i++) {
      for (let j = 0; j < fftSize / 2 + 1; j++) {
        const freq = (j * sampleRate) / fftSize;
        if (freq >= hzPoints[i] && freq <= hzPoints[i + 1]) {
          filterbank[i * (fftSize / 2 + 1) + j] =
            (freq - hzPoints[i]) / (hzPoints[i + 1] - hzPoints[i]);
        } else if (freq >= hzPoints[i + 1] && freq <= hzPoints[i + 2]) {
          filterbank[i * (fftSize / 2 + 1) + j] =
            (hzPoints[i + 2] - freq) / (hzPoints[i + 2] - hzPoints[i + 1]);
        }
      }
    }
    return filterbank;
  }

  // Helper function to compute MFCCs
  function computeMFCC(signal, sampleRate) {
    const fftSize = 1024;
    const hopSize = 512;
    const numFilters = 26;
    const numCoefficients = 13;

    const filterbank = createMelFilterbank(numFilters, fftSize, sampleRate);
    const mfccs = [];

    for (let i = 0; i < signal.length - fftSize; i += hopSize) {
      const frame = signal.slice(i, i + fftSize);
      const powerSpectrum = computePowerSpectrum(frame);

      // Apply mel filterbank
      const melSpectrum = new Float32Array(numFilters);
      for (let j = 0; j < numFilters; j++) {
        let sum = 0;
        for (let k = 0; k < fftSize / 2 + 1; k++) {
          sum += powerSpectrum[k] * filterbank[j * (fftSize / 2 + 1) + k];
        }
        melSpectrum[j] = Math.log(sum + 1e-10);
      }

      // Apply DCT to get MFCCs
      const mfcc = new Float32Array(numCoefficients);
      for (let j = 0; j < numCoefficients; j++) {
        let sum = 0;
        for (let k = 0; k < numFilters; k++) {
          sum +=
            melSpectrum[k] * Math.cos((Math.PI * j * (k + 0.5)) / numFilters);
        }
        mfcc[j] = sum;
      }
      mfccs.push(mfcc);
    }
    return mfccs;
  }

  function calculateSimilarityConfidence(signal1, signal2) {
    const mfcc1 = computeMFCC(signal1, ctx.sampleRate);
    const mfcc2 = computeMFCC(signal2, ctx.sampleRate);

    // Calculate cosine similarity between MFCCs
    let similarity = 0;
    const minLength = Math.min(mfcc1.length, mfcc2.length);
    for (let i = 0; i < minLength; i++) {
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;
      for (let j = 0; j < mfcc1[i].length; j++) {
        dotProduct += mfcc1[i][j] * mfcc2[i][j];
        norm1 += mfcc1[i][j] * mfcc1[i][j];
        norm2 += mfcc2[i][j] * mfcc2[i][j];
      }
      similarity += dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
    similarity /= minLength;

    return Math.min(100, Math.max(0, similarity * 100));
  }

  function findOffset(signal1, signal2) {
    console.log('Finding offset using MFCC cross-correlation...');
    console.log(`Signal 1 length: ${signal1.length} samples`);
    console.log(`Signal 2 length: ${signal2.length} samples`);

    const mfcc1 = computeMFCC(signal1, ctx.sampleRate);
    const mfcc2 = computeMFCC(signal2, ctx.sampleRate);

    // Focus on first minute (adjusted by playback rate)
    const targetWindowSeconds = 60 / playbackRate;
    const maxOffset = Math.floor((targetWindowSeconds * ctx.sampleRate) / 512); // Convert to MFCC frames
    console.log(
      `Searching in first ${targetWindowSeconds.toFixed(
        2
      )} seconds (${maxOffset} frames)`
    );

    let bestOffset = 0;
    let bestCorrelation = -Infinity;
    const correlations = [];

    // Perform cross-correlation on MFCCs
    for (let offset = 0; offset <= maxOffset; offset++) {
      let correlation = 0;
      let count = 0;

      for (let i = 0; i < mfcc2.length; i++) {
        if (i + offset < mfcc1.length) {
          let dotProduct = 0;
          let norm1 = 0;
          let norm2 = 0;
          for (let j = 0; j < mfcc1[i].length; j++) {
            dotProduct += mfcc1[i + offset][j] * mfcc2[i][j];
            norm1 += mfcc1[i + offset][j] * mfcc1[i + offset][j];
            norm2 += mfcc2[i][j] * mfcc2[i][j];
          }
          correlation += dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
          count++;
        }
      }

      correlation = count > 0 ? correlation / count : 0;
      correlations.push({ offset, correlation });

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
        console.log(
          `New best offset: ${offset} frames (${(
            (offset * 512) /
            ctx.sampleRate
          ).toFixed(3)}s), correlation: ${correlation.toFixed(4)}`
        );
      }
    }

    // Log top 10 correlations
    correlations.sort((a, b) => b.correlation - a.correlation);
    console.log('\nTop 10 correlations:');
    correlations.slice(0, 10).forEach((c, i) => {
      console.log(
        `${i + 1}. Offset: ${c.offset} frames (${(
          (c.offset * 512) /
          ctx.sampleRate
        ).toFixed(3)}s), Correlation: ${c.correlation.toFixed(4)}`
      );
    });

    // Convert MFCC frame offset back to samples
    return bestOffset * 512;
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

  // Find the offset using MFCC cross-correlation
  const offsetSamples = findOffset(signal1, signal2);
  const offsetSeconds = offsetSamples / fs;

  // Calculate similarity confidence using MFCCs
  const confidence = calculateSimilarityConfidence(signal1, signal2);

  return {
    offset: offsetSeconds,
    confidence,
    minDuration,
    signals: [signal1, signal2],
  };
}

// Helper function to create and append canvas element
function createCanvas(container) {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100px';
  canvas.style.display = 'block';
  container?.appendChild(canvas);
  return canvas;
}
