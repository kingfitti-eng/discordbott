class BaseSpeechRecognitionService {
  isEnabled() {
    return false;
  }

  getAvailability() {
    return {
      enabled: false,
      provider: 'none',
      reason: 'Kein Speech-Service aktiv.'
    };
  }

  async transcribePcm() {
    return null;
  }

  async close() {}
}

module.exports = {
  BaseSpeechRecognitionService
};
