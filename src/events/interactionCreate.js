const { MessageFlags } = require('discord.js');

function createInteractionCreateHandler(context) {
  return async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'Dieser Bot kann Slash-Commands nur innerhalb eines Servers ausfuehren.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const command = context.slashCommands.get(interaction.commandName);
    if (!command) {
      return;
    }

    try {
      await command.execute(interaction, context);
    } catch (error) {
      context.logger.error('Slash-Command ist fehlgeschlagen.', {
        command: interaction.commandName,
        error: error.message,
        guildId: interaction.guildId
      });

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('Beim Ausfuehren des Slash-Commands ist ein Fehler aufgetreten.');
        return;
      }

      await interaction.reply({
        content: 'Beim Ausfuehren des Slash-Commands ist ein Fehler aufgetreten.',
        flags: MessageFlags.Ephemeral
      });
    }
  };
}

module.exports = {
  createInteractionCreateHandler
};
