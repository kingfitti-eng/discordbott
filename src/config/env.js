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

function resolvePath(rootDir, rawPath, fallbackPath) {
  return path.resolve(rootDir, rawPath && rawPath.trim() ? rawPath.trim() : fallbackPath);
}

function loadConfig(options = {}) {
  const rootDir = process.cwd();
  const requireToken = options.requireToken ?? true;
  const requireApplicationId = options.requireApplicationId ?? false;

  const dataDir = resolvePath(rootDir, process.env.DATA_DIR, 'data');
  const uploadsDir = resolvePath(rootDir, process.env.UPLOADS_DIR, 'uploads');
  const triggersFile = resolvePath(rootDir, process.env.TRIGGERS_FILE, path.join('data', 'triggers.json'));

  const speechProvider = (process.env.SPEECH_PROVIDER || 'none').trim().toLowerCase();
  const speechBufferSeconds = Math.max(readInteger('SPEECH_MAX_BUFFER_SECONDS', 12), 3);

  return {
    rootDir,
    app: {
      env: process.env.NODE_ENV || 'development',
      logLevel: (process.env.LOG_LEVEL || 'info').trim().toLowerCase()
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
      maxBufferSeconds: speechBufferSeconds,
      maxPcmBufferBytes: speechBufferSeconds * 48_000 * 2 * 2,
      voskModelPath: process.env.VOSK_MODEL_PATH ? path.resolve(rootDir, process.env.VOSK_MODEL_PATH) : ''
    }
  };
}

module.exports = {
  loadConfig
};
