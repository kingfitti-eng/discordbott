const path = require('node:path');

const { Client, Events, GatewayIntentBits } = require('discord.js');

const { loadConfig } = require('./config/env');
const { createInteractionCreateHandler } = require('./events/interactionCreate');
const { createMessageCreateHandler } = require('./events/messageCreate');
const { createReadyHandler } = require('./events/ready');
const { createSpeechRecognitionService } = require('./services/speech/SpeechServiceFactory');
const { createHealthServer } = require('./services/http/healthServer');
const { JsonStorageAdapter } = require('./services/storage/JsonStorageAdapter');
const { TriggerRepository } = require('./services/triggers/TriggerRepository');
const { TriggerService } = require('./services/triggers/TriggerService');
const { VoiceSessionManager } = require('./services/voice/VoiceSessionManager');
const { ensureRuntimeDirectories } = require('./utils/filesystem');
const { loadCommandModules } = require('./utils/loaders');
const { createLogger } = require('./utils/logger');

async function bootstrap() {
  const config = loadConfig();
  const logger = createLogger(config.app.logLevel);

  await ensureRuntimeDirectories(config);

  const storage = new JsonStorageAdapter();
  const triggerRepository = new TriggerRepository({
    filePath: config.storage.triggersFile,
    storage
  });
  const triggerService = new TriggerService({
    logger,
    maxUploadSizeBytes: config.storage.maxUploadSizeBytes,
    repository: triggerRepository,
    uploadsDir: config.storage.uploadsDir
  });
  const speechService = await createSpeechRecognitionService(config.speech, logger);
  const healthServer = createHealthServer({
    config: config.http,
    logger,
    speechService
  });
  const voiceSessionManager = new VoiceSessionManager({
    captureSilenceMs: config.speech.captureSilenceMs,
    logger,
    maxPcmBufferBytes: config.speech.maxPcmBufferBytes,
    maxQueueSize: config.audio.maxQueueSize,
    speechService,
    triggerCooldownMs: config.audio.triggerCooldownMs,
    triggerService
  });

  const [prefixCommands, slashCommands] = await Promise.all([
    loadCommandModules(path.join(config.rootDir, 'src', 'commands', 'prefix'), (commandModule) => commandModule.name),
    loadCommandModules(
      path.join(config.rootDir, 'src', 'commands', 'slash'),
      (commandModule) => commandModule.data.name ?? commandModule.data.toJSON().name
    )
  ]);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent
    ]
  });

  const context = {
    config,
    logger,
    prefixCommands,
    slashCommands,
    speechService,
    triggerService,
    voiceSessionManager
  };

  client.once(Events.ClientReady, createReadyHandler(context));
  client.on(Events.InteractionCreate, createInteractionCreateHandler(context));
  client.on(Events.MessageCreate, createMessageCreateHandler(context));

  const shutdown = async (signal) => {
    logger.info('Bot fährt herunter.', { signal });
    client.removeAllListeners();

    await Promise.allSettled([
      healthServer.stop(),
      voiceSessionManager.destroyAll(),
      speechService.close()
    ]);

    client.destroy();
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT').finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM').finally(() => process.exit(0));
  });

  await client.login(config.discord.token);
  await healthServer.start();
}

bootstrap().catch((error) => {
  console.error('Bot konnte nicht gestartet werden:', error);
  process.exitCode = 1;
});
