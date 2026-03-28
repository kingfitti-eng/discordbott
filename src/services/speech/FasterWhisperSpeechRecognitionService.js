const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

const { safeUnlink } = require('../../utils/filesystem');
const { createWavBuffer } = require('../../utils/wav');
const { BaseSpeechRecognitionService } = require('./BaseSpeechRecognitionService');

class FasterWhisperSpeechRecognitionService extends BaseSpeechRecognitionService {
  constructor(options) {
    super();
    this.beamSize = options.beamSize;
    this.bestOf = options.bestOf;
    this.computeType = options.computeType;
    this.cpuThreads = options.cpuThreads;
    this.device = options.device;
    this.hotwordsEnabled = options.hotwordsEnabled;
    this.hotwordsMax = options.hotwordsMax;
    this.language = options.language;
    this.logger = options.logger;
    this.model = options.model;
    this.numWorkers = options.numWorkers;
    this.patience = options.patience;
    this.pendingJobs = new Map();
    this.pythonBin = options.pythonBin;
    this.tempDir = options.tempDir;
    this.transcriptionTimeoutMs = options.transcriptionTimeoutMs;
    this.vadFilter = options.vadFilter;
    this.vadMinSilenceMs = options.vadMinSilenceMs;
    this.worker = null;
    this.workerPath = options.workerPath;
    this.workerReadyPromise = null;
  }

  isEnabled() {
    return Boolean(this.pythonBin && this.workerPath && this.model);
  }

  getAvailability() {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        provider: 'fasterwhisper',
        reason: 'PYTHON_BIN, FASTER_WHISPER_WORKER_PATH oder FASTER_WHISPER_MODEL fehlt. Sprach-Trigger-Erkennung ist deaktiviert.'
      };
    }

    return {
      enabled: true,
      provider: 'fasterwhisper',
      reason: `faster-whisper aktiv mit Modell ${this.model} auf ${this.device}/${this.computeType}`
    };
  }

  async ensureWorker() {
    if (this.worker && !this.worker.killed && this.worker.exitCode === null) {
      return;
    }

    if (this.workerReadyPromise) {
      return this.workerReadyPromise;
    }

    this.workerReadyPromise = new Promise((resolve, reject) => {
      const args = [
        this.workerPath,
        '--model',
        this.model,
        '--device',
        this.device,
        '--compute-type',
        this.computeType,
        '--beam-size',
        String(this.beamSize),
        '--best-of',
        String(this.bestOf),
        '--patience',
        String(this.patience),
        '--vad-filter',
        this.vadFilter ? 'true' : 'false',
        '--vad-min-silence-ms',
        String(this.vadMinSilenceMs),
        '--cpu-threads',
        String(this.cpuThreads),
        '--num-workers',
        String(this.numWorkers)
      ];

      if (this.language) {
        args.push('--language', this.language);
      }

      this.logger.info('faster-whisper-Worker wird gestartet.', {
        beamSize: this.beamSize,
        bestOf: this.bestOf,
        computeType: this.computeType,
        cpuThreads: this.cpuThreads,
        device: this.device,
        hotwordsEnabled: this.hotwordsEnabled,
        language: this.language || 'auto',
        model: this.model,
        numWorkers: this.numWorkers,
        patience: this.patience,
        pythonBin: this.pythonBin,
        vadMinSilenceMs: this.vadMinSilenceMs,
        workerPath: this.workerPath
      });

      const worker = spawn(this.pythonBin, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      this.worker = worker;

      const stderrLines = [];
      const stderrReader = readline.createInterface({ input: worker.stderr });
      stderrReader.on('line', (line) => {
        stderrLines.push(line);
        if (stderrLines.length > 20) {
          stderrLines.shift();
        }
      });

      const stdoutReader = readline.createInterface({ input: worker.stdout });
      stdoutReader.on('line', (line) => {
        let payload;
        try {
          payload = JSON.parse(line);
        } catch {
          this.logger.warn('faster-whisper-Worker hat ungueltige JSON-Ausgabe geliefert.', {
            line
          });
          return;
        }

        if (payload.type === 'ready') {
          resolve();
          return;
        }

        if (payload.type === 'result' && payload.id) {
          const pendingJob = this.pendingJobs.get(payload.id);
          if (!pendingJob) {
            return;
          }

          this.pendingJobs.delete(payload.id);
          if (pendingJob.timeout) {
            clearTimeout(pendingJob.timeout);
          }

          if (payload.error) {
            pendingJob.reject(new Error(payload.error));
            return;
          }

          pendingJob.resolve({
            provider: 'fasterwhisper',
            text: typeof payload.text === 'string' ? payload.text.trim().toLowerCase() : ''
          });
        }
      });

      worker.once('error', (error) => {
        this.worker = null;
        reject(error);
      });

      worker.once('exit', (code, signal) => {
        this.worker = null;
        const message = `faster-whisper-Worker wurde beendet (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;

        for (const [jobId, pendingJob] of this.pendingJobs) {
          if (pendingJob.timeout) {
            clearTimeout(pendingJob.timeout);
          }
          pendingJob.reject(new Error(message));
          this.pendingJobs.delete(jobId);
        }

        if (this.workerReadyPromise) {
          reject(new Error(`${message}. ${stderrLines.join('\n')}`.trim()));
        }
      });
    }).finally(() => {
      this.workerReadyPromise = null;
    });

    return this.workerReadyPromise;
  }

  async transcribePcm(buffer, metadata) {
    if (!this.isEnabled() || !buffer?.length) {
      return null;
    }

    await fs.mkdir(this.tempDir, { recursive: true });

    const basename = crypto.randomUUID();
    const wavPath = path.join(this.tempDir, `${basename}.wav`);
    const wavBuffer = createWavBuffer(buffer, {
      bitsPerSample: 16,
      channels: metadata.channels,
      sampleRate: metadata.sampleRate
    });

    await fs.writeFile(wavPath, wavBuffer);

    try {
      await this.ensureWorker();

      const payload = await this.sendJob({
        hotwords: this.hotwordsEnabled ? metadata.hotwords || '' : '',
        id: basename,
        language: this.language,
        wavPath
      });

      if (!payload?.text) {
        this.logger.info('faster-whisper lieferte kein Transkript.', {
          model: this.model
        });
        return null;
      }

      return payload;
    } catch (error) {
      this.logger.warn('faster-whisper-Transcription ist fehlgeschlagen.', {
        error: error.message
      });
      return null;
    } finally {
      await safeUnlink(wavPath);
    }
  }

  async sendJob(payload) {
    if (!this.worker?.stdin) {
      throw new Error('faster-whisper-Worker ist nicht verfuegbar.');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingJobs.delete(payload.id);
        reject(new Error(`Transcription-Timeout nach ${this.transcriptionTimeoutMs} ms.`));
      }, this.transcriptionTimeoutMs);

      this.pendingJobs.set(payload.id, {
        reject,
        resolve,
        timeout
      });

      this.worker.stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
        if (!error) {
          return;
        }

        const pendingJob = this.pendingJobs.get(payload.id);
        if (!pendingJob) {
          return;
        }

        clearTimeout(timeout);
        this.pendingJobs.delete(payload.id);
        reject(error);
      });
    });
  }

  async close() {
    if (!this.worker) {
      return;
    }

    try {
      this.worker.stdin?.end();
      this.worker.kill();
    } finally {
      this.worker = null;
    }
  }
}

module.exports = {
  FasterWhisperSpeechRecognitionService
};
