const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Entfernt ein gespeichertes Triggerwort.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Das Triggerwort, das entfernt werden soll.')
        .setRequired(true)
    ),
  async execute(interaction, context) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const triggerName = interaction.options.getString('name', true);
    const removedTrigger = await context.triggerService.removeTrigger(interaction.guildId, triggerName);

    if (!removedTrigger) {
      await interaction.editReply(`Es gibt keinen Trigger mit dem Namen \`${triggerName.trim().toLowerCase()}\`.`);
      return;
    }

    await interaction.editReply(`Trigger \`${removedTrigger.name}\` wurde entfernt.`);
  }
};
