const { MessageFlags, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Setzt eine pausierte Wiedergabe im Voice-Channel fort.'),
  async execute(interaction, context) {
    const result = context.voiceSessionManager.resumeGuildPlayback(interaction.guildId);

    if (!result.ok) {
      const message =
        result.code === 'NOT_CONNECTED'
          ? 'Ich bin auf diesem Server gerade mit keinem Sprachkanal verbunden.'
          : 'Gerade ist keine Wiedergabe pausiert.';

      await interaction.reply({
        content: message,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.reply({
      content: 'Die Wiedergabe laeuft jetzt weiter.',
      flags: MessageFlags.Ephemeral
    });
  }
};
