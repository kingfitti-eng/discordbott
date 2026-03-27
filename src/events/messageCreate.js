function createMessageCreateHandler(context) {
  return async (message) => {
    if (!message.inGuild() || message.author.bot) {
      return;
    }

    if (!message.content.startsWith(context.config.discord.prefix)) {
      return;
    }

    const commandLine = message.content.slice(context.config.discord.prefix.length).trim();
    if (!commandLine) {
      return;
    }

    const [rawCommandName] = commandLine.split(/\s+/);
    const commandName = rawCommandName.toLowerCase();
    const command = context.prefixCommands.get(commandName);

    if (!command) {
      return;
    }

    try {
      await command.execute(message, context);
    } catch (error) {
      context.logger.error('Prefix-Command ist fehlgeschlagen.', {
        command: commandName,
        error: error.message,
        guildId: message.guild.id
      });
      await message.reply('Beim Ausführen des Befehls ist ein Fehler aufgetreten.');
    }
  };
}

module.exports = {
  createMessageCreateHandler
};
