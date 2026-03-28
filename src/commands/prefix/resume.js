module.exports = {
  name: 'resume',
  description: 'Setzt eine pausierte Wiedergabe im Voice-Channel fort.',
  async execute(message, context) {
    const result = context.voiceSessionManager.resumeGuildPlayback(message.guild.id);

    if (!result.ok) {
      const reply =
        result.code === 'NOT_CONNECTED'
          ? 'Ich bin auf diesem Server gerade mit keinem Sprachkanal verbunden.'
          : 'Gerade ist keine Wiedergabe pausiert.';

      await message.reply(reply);
      return;
    }

    await message.reply('Die Wiedergabe laeuft jetzt weiter.');
  }
};
