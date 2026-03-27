module.exports = {
  name: 'leave',
  description: 'Lässt den Bot den aktuellen Voice-Channel verlassen.',
  async execute(message, context) {
    const result = await context.voiceSessionManager.leaveGuild(message.guild.id);

    if (!result.ok) {
      await message.reply('Ich bin gerade mit keinem Sprachkanal auf diesem Server verbunden.');
      return;
    }

    await message.reply('Ich habe den Sprachkanal verlassen.');
  }
};
