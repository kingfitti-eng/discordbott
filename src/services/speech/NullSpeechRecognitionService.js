const { BaseSpeechRecognitionService } = require('./BaseSpeechRecognitionService');

class NullSpeechRecognitionService extends BaseSpeechRecognitionService {
  constructor(reason = 'Kein Speech-Provider konfiguriert.') {
    super();
    this.reason = reason;
  }

  getAvailability() {
    return {
      enabled: false,
      provider: 'none',
      reason: this.reason
    };
  }
}

module.exports = {
  NullSpeechRecognitionService
};
