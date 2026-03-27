const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Speichert ein Triggerwort mit einer Audiodatei.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Das Triggerwort oder die Trigger-Phrase.')
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName('file')
        .setDescription('Die Audiodatei (mp3, wav oder ogg).')
        .setRequired(true)
    ),
  async execute(interaction, context) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const result = await context.triggerService.addTrigger({
        attachment: interaction.options.getAttachment('file', true),
        guildId: interaction.guildId,
        name: interaction.options.getString('name', true),
        userId: interaction.user.id
      });

      if (!result.created) {
        await interaction.editReply(`Das Triggerwort \`${result.trigger.name}\` existiert bereits auf diesem Server.`);
        return;
      }

      const reply = result.repaired
        ? `Trigger \`${result.trigger.name}\` wurde repariert und neu gespeichert. Datei: \`${result.trigger.fileName}\``
        : `Trigger \`${result.trigger.name}\` wurde gespeichert. Datei: \`${result.trigger.fileName}\``;

      await interaction.editReply(reply);
    } catch (error) {
      await interaction.editReply(`Trigger konnte nicht gespeichert werden: ${error.message}`);
    }
  }
};
