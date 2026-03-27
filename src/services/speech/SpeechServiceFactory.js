const { NullSpeechRecognitionService } = require('./NullSpeechRecognitionService');
const { VoskSpeechRecognitionService } = require('./VoskSpeechRecognitionService');

async function createSpeechRecognitionService(config, logger) {
  if (config.provider === 'none') {
    return new NullSpeechRecognitionService('SPEECH_PROVIDER=none. Sprach-Trigger-Erkennung ist deaktiviert.');
  }

  if (config.provider === 'vosk') {
    try {
      const service = new VoskSpeechRecognitionService({
        logger,
        modelPath: config.voskModelPath
      });

      await service.initialize();
      return service;
    } catch (error) {
      logger.warn('Vosk konnte nicht aktiviert werden. Der Bot läuft ohne automatische Sprach-Trigger weiter.', {
        error: error.message
      });
      return new NullSpeechRecognitionService(`Vosk ist nicht bereit: ${error.message}`);
    }
  }

  return new NullSpeechRecognitionService(`Unbekannter Speech-Provider: ${config.provider}`);
}

module.exports = {
  createSpeechRecognitionService
};
