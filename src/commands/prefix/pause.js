module.exports = {
  name: 'pause',
  description: 'Pausiert den aktuell laufenden Sound im Voice-Channel.',
  async execute(message, context) {
    const result = context.voiceSessionManager.pauseGuildPlayback(message.guild.id);

    if (!result.ok) {
      const reply =
        result.code === 'NOT_CONNECTED'
          ? 'Ich bin auf diesem Server gerade mit keinem Sprachkanal verbunden.'
          : 'Gerade laeuft kein Sound, den ich pausieren koennte.';

      await message.reply(reply);
      return;
    }

    await message.reply('Die Wiedergabe wurde pausiert.');
  }
};
