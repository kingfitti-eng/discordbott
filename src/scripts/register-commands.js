const path = require('node:path');

const { REST, Routes } = require('discord.js');

const { loadConfig } = require('../config/env');
const { loadCommandModules } = require('../utils/loaders');

async function main() {
  const config = loadConfig({
    requireApplicationId: true,
    requireToken: true
  });

  const slashCommands = await loadCommandModules(
    path.join(config.rootDir, 'src', 'commands', 'slash'),
    (commandModule) => commandModule.data.name ?? commandModule.data.toJSON().name
  );

  const body = Array.from(slashCommands.values()).map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  if (config.discord.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.discord.applicationId, config.discord.guildId), {
      body
    });
    console.log(`Guild-Slash-Commands wurden für Guild ${config.discord.guildId} registriert.`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.discord.applicationId), {
    body
  });
  console.log('Globale Slash-Commands wurden registriert.');
}

main().catch((error) => {
  console.error('Slash-Commands konnten nicht registriert werden:', error);
  process.exitCode = 1;
});
