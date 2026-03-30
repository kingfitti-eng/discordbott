const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const { safeUnlink } = require('../../utils/filesystem');
const { createWavBuffer } = require('../../utils/wav');
const { BaseSpeechRecognitionService } = require('./BaseSpeechRecognitionService');

const execFileAsync = promisify(execFile);

class WhisperCppSpeechRecognitionService extends BaseSpeechRecognitionService {
  constructor(options) {
    super();
    this.binaryPath = options.binaryPath;
    this.language = options.language;
    this.logger = options.logger;
    this.modelPath = options.modelPath;
    this.tempDir = options.tempDir;
  }

  isEnabled() {
    return Boolean(this.binaryPath && this.modelPath);
  }

  getAvailability() {
    if (!this.binaryPath || !this.modelPath) {
      return {
        enabled: false,
        provider: 'whispercpp',
        reason: 'WHISPER_CPP_PATH oder WHISPER_MODEL_PATH fehlt. Sprach-Trigger-Erkennung ist deaktiviert.'
      };
    }

    return {
      enabled: true,
      provider: 'whispercpp',
      reason: `whisper.cpp aktiv mit Modell ${this.modelPath}`
    };
  }

  async transcribePcm(buffer, metadata) {
    if (!this.isEnabled() || !buffer?.length) {
      return null;
    }

    await fs.mkdir(this.tempDir, { recursive: true });

    const basename = crypto.randomUUID();
    const wavPath = path.join(this.tempDir, `${basename}.wav`);
    const outputBase = path.join(this.tempDir, `${basename}-transcript`);
    const outputTextPath = `${outputBase}.txt`;

    const wavBuffer = createWavBuffer(buffer, {
      bitsPerSample: 16,
      channels: metadata.channels,
      sampleRate: metadata.sampleRate
    });

    await fs.writeFile(wavPath, wavBuffer);

    try {
      const args = [
        '-m',
        this.modelPath,
        '-f',
        wavPath,
        '-of',
        outputBase,
        '-otxt',
        '-np'
      ];

      if (this.language) {
        args.push('-l', this.language);
      }

      this.logger.info('whisper.cpp wird gestartet.', {
        binaryPath: this.binaryPath,
        language: this.language || 'auto',
        modelPath: this.modelPath
      });

      await execFileAsync(this.binaryPath, args, {
        timeout: 120_000,
        windowsHide: true
      });

      const text = (await fs.readFile(outputTextPath, 'utf8')).trim().toLowerCase();
      if (!text) {
        this.logger.info('whisper.cpp lieferte kein Transkript.', {
          modelPath: this.modelPath
        });
        return null;
      }

      return {
        provider: 'whispercpp',
        text
      };
    } catch (error) {
      this.logger.warn('whisper.cpp-Transcription ist fehlgeschlagen.', {
        error: error.message
      });
      return null;
    } finally {
      await Promise.allSettled([
        safeUnlink(wavPath),
        safeUnlink(outputTextPath)
      ]);
    }
  }
}

module.exports = {
  WhisperCppSpeechRecognitionService
};
