const fs = require('node:fs');

const { BaseSpeechRecognitionService } = require('./BaseSpeechRecognitionService');

function clampSample(sample) {
  return Math.max(-1, Math.min(1, sample));
}

function parseRecognizerResult(result) {
  if (!result) {
    return {};
  }

  if (typeof result === 'string') {
    try {
      return JSON.parse(result);
    } catch {
      return {};
    }
  }

  return result;
}

function convertPcmToMonoFloatSamples(buffer, channelCount) {
  const sampleCount = Math.floor(buffer.length / 2 / channelCount);
  const monoSamples = new Float32Array(sampleCount);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    let sum = 0;

    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const byteOffset = (sampleIndex * channelCount + channelIndex) * 2;
      sum += buffer.readInt16LE(byteOffset);
    }

    monoSamples[sampleIndex] = sum / channelCount / 32768;
  }

  return monoSamples;
}

function resampleFloat32(samples, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) {
    return samples;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const interpolation = sourceIndex - leftIndex;

    output[index] = samples[leftIndex] * (1 - interpolation) + samples[rightIndex] * interpolation;
  }

  return output;
}

function float32ToPcm16Buffer(samples) {
  const outputBuffer = Buffer.alloc(samples.length * 2);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = clampSample(samples[index]);
    const scaled = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
    outputBuffer.writeInt16LE(scaled, index * 2);
  }

  return outputBuffer;
}

function resampleDiscordPcmToVosk(buffer, inputSampleRate, channelCount) {
  const monoSamples = convertPcmToMonoFloatSamples(buffer, channelCount);
  const resampled = resampleFloat32(monoSamples, inputSampleRate, 16_000);
  return float32ToPcm16Buffer(resampled);
}

class VoskSpeechRecognitionService extends BaseSpeechRecognitionService {
  constructor(options) {
    super();
    this.logger = options.logger;
    this.modelPath = options.modelPath;
    this.model = null;
    this.vosk = null;
  }

  async initialize() {
    if (!this.modelPath) {
      throw new Error('VOSK_MODEL_PATH ist nicht gesetzt.');
    }

    if (!fs.existsSync(this.modelPath)) {
      throw new Error(`Vosk-Modell wurde nicht gefunden: ${this.modelPath}`);
    }

    this.vosk = require('vosk');
    this.vosk.setLogLevel(-1);
    this.model = new this.vosk.Model(this.modelPath);
    return this;
  }

  isEnabled() {
    return Boolean(this.model);
  }

  getAvailability() {
    if (this.isEnabled()) {
      return {
        enabled: true,
        provider: 'vosk',
        reason: `Vosk-Modell aktiv: ${this.modelPath}`
      };
    }

    return {
      enabled: false,
      provider: 'vosk',
      reason: 'Vosk wurde angefordert, aber konnte nicht initialisiert werden.'
    };
  }

  async transcribePcm(buffer, metadata) {
    if (!this.isEnabled() || !buffer?.length) {
      return null;
    }

    const pcm16k = resampleDiscordPcmToVosk(buffer, metadata.sampleRate, metadata.channels);
    const recognizer = new this.vosk.Recognizer({
      model: this.model,
      sampleRate: 16_000
    });

    try {
      recognizer.acceptWaveform(pcm16k);
      const result = parseRecognizerResult(recognizer.finalResult());
      const text = typeof result.text === 'string' ? result.text.trim().toLowerCase() : '';

      if (!text) {
        return null;
      }

      return {
        provider: 'vosk',
        text
      };
    } catch (error) {
      this.logger.warn('Spracherkennung mit Vosk ist fehlgeschlagen.', {
        error: error.message
      });
      return null;
    } finally {
      recognizer.free();
    }
  }

  async close() {
    if (this.model) {
      this.model.free();
      this.model = null;
    }
  }
}

module.exports = {
  VoskSpeechRecognitionService
};
