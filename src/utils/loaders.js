const fs = require('node:fs/promises');
const path = require('node:path');

async function loadCommandModules(directoryPath, keySelector) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const commands = new Map();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }

    const commandPath = path.join(directoryPath, entry.name);
    const commandModule = require(commandPath);
    const key = keySelector(commandModule);
    commands.set(key, commandModule);
  }

  return commands;
}

module.exports = {
  loadCommandModules
};
