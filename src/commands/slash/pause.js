const { MessageFlags, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausiert den aktuell laufenden Sound im Voice-Channel.'),
  async execute(interaction, context) {
    const result = context.voiceSessionManager.pauseGuildPlayback(interaction.guildId);

    if (!result.ok) {
      const message =
        result.code === 'NOT_CONNECTED'
          ? 'Ich bin auf diesem Server gerade mit keinem Sprachkanal verbunden.'
          : 'Gerade laeuft kein Sound, den ich pausieren koennte.';

      await interaction.reply({
        content: message,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.reply({
      content: 'Die Wiedergabe wurde pausiert.',
      flags: MessageFlags.Ephemeral
    });
  }
};
