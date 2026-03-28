const { MessageFlags, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stoppt die aktuelle Wiedergabe und leert die Audio-Queue.'),
  async execute(interaction, context) {
    const result = context.voiceSessionManager.stopGuildPlayback(interaction.guildId);

    if (!result.ok) {
      const message =
        result.code === 'NOT_CONNECTED'
          ? 'Ich bin auf diesem Server gerade mit keinem Sprachkanal verbunden.'
          : 'Gerade laeuft keine Wiedergabe und die Queue ist bereits leer.';

      await interaction.reply({
        content: message,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.reply({
      content: 'Die Wiedergabe wurde gestoppt und die Queue geleert.',
      flags: MessageFlags.Ephemeral
    });
  }
};
