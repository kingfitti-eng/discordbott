module.exports = {
  name: 'stop',
  description: 'Stoppt die aktuelle Wiedergabe und leert die Audio-Queue.',
  async execute(message, context) {
    const result = context.voiceSessionManager.stopGuildPlayback(message.guild.id);

    if (!result.ok) {
      const reply =
        result.code === 'NOT_CONNECTED'
          ? 'Ich bin auf diesem Server gerade mit keinem Sprachkanal verbunden.'
          : 'Gerade laeuft keine Wiedergabe und die Queue ist bereits leer.';

      await message.reply(reply);
      return;
    }

    await message.reply('Die Wiedergabe wurde gestoppt und die Queue geleert.');
  }
};
