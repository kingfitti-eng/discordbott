const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('Listet alle gespeicherten Trigger auf diesem Server auf.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction, context) {
    const triggers = await context.triggerService.listTriggers(interaction.guildId);

    if (triggers.length === 0) {
      await interaction.reply({
        content: 'Fuer diesen Server sind noch keine Trigger gespeichert.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const lines = triggers.map((trigger) => {
      const createdAt = new Date(trigger.createdAt).toLocaleString('de-DE');
      const status = trigger.filePath ? trigger.fileName : 'Re-Upload erforderlich';
      return `- \`${trigger.name}\` -> \`${status}\` (${createdAt})`;
    });

    await interaction.reply({
      content: ['Gespeicherte Trigger:', ...lines].join('\n').slice(0, 1900),
      flags: MessageFlags.Ephemeral
    });
  }
};
