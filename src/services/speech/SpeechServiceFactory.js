const { FasterWhisperSpeechRecognitionService } = require('./FasterWhisperSpeechRecognitionService');
const { NullSpeechRecognitionService } = require('./NullSpeechRecognitionService');
const { WhisperCppSpeechRecognitionService } = require('./WhisperCppSpeechRecognitionService');

async function createSpeechRecognitionService(config, logger) {
  if (config.provider === 'none') {
    return new NullSpeechRecognitionService('SPEECH_PROVIDER=none. Sprach-Trigger-Erkennung ist deaktiviert.');
  }

  if (config.provider === 'fasterwhisper') {
    try {
      return new FasterWhisperSpeechRecognitionService({
        beamSize: config.fasterWhisperBeamSize,
        computeType: config.fasterWhisperComputeType,
        device: config.fasterWhisperDevice,
        language: config.fasterWhisperLanguage,
        logger,
        model: config.fasterWhisperModel,
        pythonBin: config.pythonBin,
        tempDir: config.tempDir,
        transcriptionTimeoutMs: config.transcriptionTimeoutMs,
        vadFilter: config.fasterWhisperVadFilter,
        workerPath: config.fasterWhisperWorkerPath
      });
    } catch (error) {
      logger.warn('faster-whisper konnte nicht aktiviert werden. Der Bot laeuft ohne automatische Sprach-Trigger weiter.', {
        error: error.message
      });
      return new NullSpeechRecognitionService(`faster-whisper ist nicht bereit: ${error.message}`);
    }
  }

  if (config.provider === 'whispercpp') {
    try {
      return new WhisperCppSpeechRecognitionService({
        binaryPath: config.whisperCppPath,
        language: config.whisperLanguage,
        logger,
        modelPath: config.whisperModelPath,
        tempDir: config.tempDir
      });
    } catch (error) {
      logger.warn('whisper.cpp konnte nicht aktiviert werden. Der Bot laeuft ohne automatische Sprach-Trigger weiter.', {
        error: error.message
      });
      return new NullSpeechRecognitionService(`whisper.cpp ist nicht bereit: ${error.message}`);
    }
  }

  if (config.provider === 'openai' || config.provider === 'vosk') {
    return new NullSpeechRecognitionService(
      'Diese Version nutzt kostenlose lokale Speech-Provider. Nutze SPEECH_PROVIDER=fasterwhisper oder whispercpp.'
    );
  }

  return new NullSpeechRecognitionService(`Unbekannter Speech-Provider: ${config.provider}`);
}

module.exports = {
  createSpeechRecognitionService
};
