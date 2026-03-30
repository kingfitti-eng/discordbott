const os = require('node:os');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

function requireEnv(name, required) {
  const value = process.env[name];
  if (required && (!value || !value.trim())) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value ? value.trim() : '';
}

function readInteger(name, fallback) {
  const rawValue = process.env[name];
  if (!rawValue || !rawValue.trim()) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function readFloat(name, fallback) {
  const rawValue = process.env[name];
  if (!rawValue || !rawValue.trim()) {
    return fallback;
  }

  const parsedValue = Number.parseFloat(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function readPositiveInteger(name, fallback) {
  const parsedValue = readInteger(name, fallback);
  return parsedValue > 0 ? parsedValue : fallback;
}

function readBoolean(name, fallback) {
  const rawValue = process.env[name];
  if (!rawValue || !rawValue.trim()) {
    return fallback;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return fallback;
}

function resolvePath(rootDir, rawPath, fallbackPath) {
  return path.resolve(rootDir, rawPath && rawPath.trim() ? rawPath.trim() : fallbackPath);
}

function loadConfig(options = {}) {
  const rootDir = process.cwd();
  const requireToken = options.requireToken ?? true;
  const requireApplicationId = options.requireApplicationId ?? false;
  const availableCpuThreads = Math.max(os.availableParallelism?.() || os.cpus().length || 1, 1);

  const dataDir = resolvePath(rootDir, process.env.DATA_DIR, 'data');
  const uploadsDir = resolvePath(rootDir, process.env.UPLOADS_DIR, 'uploads');
  const triggersFile = resolvePath(rootDir, process.env.TRIGGERS_FILE, path.join('data', 'triggers.json'));

  const hasFasterWhisper = Boolean(process.env.PYTHON_BIN || process.env.FASTER_WHISPER_MODEL);
  const hasWhisperCpp = Boolean(process.env.WHISPER_CPP_PATH && process.env.WHISPER_MODEL_PATH);
  const defaultSpeechProvider = hasFasterWhisper ? 'fasterwhisper' : hasWhisperCpp ? 'whispercpp' : 'none';
  const speechProvider = (process.env.SPEECH_PROVIDER || defaultSpeechProvider).trim().toLowerCase();
  const speechBufferSeconds = Math.max(readInteger('SPEECH_MAX_BUFFER_SECONDS', 12), 3);

  return {
    rootDir,
    app: {
      env: process.env.NODE_ENV || 'development',
      logLevel: (process.env.LOG_LEVEL || 'info').trim().toLowerCase()
    },
    http: {
      enabled: readBoolean('HTTP_ENABLED', true),
      host: process.env.HOST?.trim() || '0.0.0.0',
      port: Math.max(readInteger('PORT', 3000), 1)
    },
    discord: {
      token: requireEnv('DISCORD_TOKEN', requireToken),
      applicationId: requireEnv('APPLICATION_ID', requireApplicationId),
      guildId: requireEnv('GUILD_ID', false),
      soundChannelId: requireEnv('SOUND_CHANNEL_ID', false),
      prefix: process.env.PREFIX?.trim() || '!'
    },
    integrations: {
      supabase: {
        url: requireEnv('SUPABASE_URL', false),
        key: requireEnv('SUPABASE_KEY', false)
      }
    },
    storage: {
      dataDir,
      uploadsDir,
      triggersFile,
      maxUploadSizeBytes: Math.max(readInteger('MAX_UPLOAD_SIZE_MB', 10), 1) * 1024 * 1024
    },
    audio: {
      maxQueueSize: Math.max(readInteger('MAX_AUDIO_QUEUE_SIZE', 20), 1),
      triggerCooldownMs: Math.max(readInteger('TRIGGER_COOLDOWN_MS', 3000), 0)
    },
    speech: {
      provider: speechProvider,
      captureSilenceMs: Math.max(readInteger('SPEECH_CAPTURE_SILENCE_MS', 1200), 300),
      fasterWhisperBeamSize: Math.max(readInteger('FASTER_WHISPER_BEAM_SIZE', 1), 1),
      fasterWhisperBestOf: Math.max(readInteger('FASTER_WHISPER_BEST_OF', 5), 1),
      fasterWhisperComputeType: process.env.FASTER_WHISPER_COMPUTE_TYPE?.trim() || 'int8',
      fasterWhisperCpuThreads: readPositiveInteger('FASTER_WHISPER_CPU_THREADS', availableCpuThreads),
      fasterWhisperDevice: process.env.FASTER_WHISPER_DEVICE?.trim() || 'cpu',
      fasterWhisperHotwordsEnabled: readBoolean('FASTER_WHISPER_HOTWORDS_ENABLED', true),
      fasterWhisperHotwordsMax: Math.max(readInteger('FASTER_WHISPER_HOTWORDS_MAX', 25), 1),
      fasterWhisperLanguage: process.env.FASTER_WHISPER_LANGUAGE?.trim() || 'de',
      fasterWhisperModel: process.env.FASTER_WHISPER_MODEL?.trim() || 'small',
      fasterWhisperNumWorkers: Math.max(readInteger('FASTER_WHISPER_NUM_WORKERS', 1), 1),
      fasterWhisperPatience: Math.max(readFloat('FASTER_WHISPER_PATIENCE', 1.5), 1),
      fasterWhisperVadFilter: readBoolean('FASTER_WHISPER_VAD_FILTER', true),
      fasterWhisperVadMinSilenceMs: Math.max(readInteger('FASTER_WHISPER_VAD_MIN_SILENCE_MS', 250), 50),
      fasterWhisperWorkerPath: resolvePath(rootDir, process.env.FASTER_WHISPER_WORKER_PATH, path.join('scripts', 'faster_whisper_worker.py')),
      pythonBin: process.env.PYTHON_BIN?.trim() || 'python3',
      transcriptionTimeoutMs: Math.max(readInteger('SPEECH_TRANSCRIPTION_TIMEOUT_MS', 30000), 5000),
      maxBufferSeconds: speechBufferSeconds,
      maxPcmBufferBytes: speechBufferSeconds * 48_000 * 2 * 2,
      whisperCppPath: process.env.WHISPER_CPP_PATH ? path.resolve(rootDir, process.env.WHISPER_CPP_PATH) : '',
      whisperModelPath: process.env.WHISPER_MODEL_PATH ? path.resolve(rootDir, process.env.WHISPER_MODEL_PATH) : '',
      whisperLanguage: process.env.WHISPER_LANGUAGE?.trim() || '',
      tempDir: path.join(dataDir, 'speech-temp')
    }
  };
}

module.exports = {
  loadConfig
};
