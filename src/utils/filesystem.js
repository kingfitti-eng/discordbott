const fs = require('node:fs/promises');
const path = require('node:path');

async function ensureDir(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function ensureRuntimeDirectories(config) {
  await Promise.all([
    ensureDir(config.storage.dataDir),
    ensureDir(config.storage.uploadsDir),
    ensureDir(path.dirname(config.storage.triggersFile))
  ]);
}

async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  ensureDir,
  ensureRuntimeDirectories,
  safeUnlink
};
