function createReadyHandler(context) {
  return (client) => {
    context.voiceSessionManager.setClientUserId(client.user.id);

    const speechAvailability = context.speechService.getAvailability();
    context.logger.info('Bot ist erfolgreich gestartet.', {
      botTag: client.user.tag,
      speechEnabled: speechAvailability.enabled,
      speechProvider: speechAvailability.provider,
      speechReason: speechAvailability.reason
    });
  };
}

module.exports = {
  createReadyHandler
};
