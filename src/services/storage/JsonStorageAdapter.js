const fs = require('node:fs/promises');
const path = require('node:path');

const { StorageAdapter } = require('./StorageAdapter');

class JsonStorageAdapter extends StorageAdapter {
  async readJson(filePath, fallbackValue) {
    try {
      const rawContent = await fs.readFile(filePath, 'utf8');
      return JSON.parse(rawContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return fallbackValue;
      }

      throw error;
    }
  }

  async writeJson(filePath, data) {
    const directoryPath = path.dirname(filePath);
    const tempFilePath = `${filePath}.tmp`;

    await fs.mkdir(directoryPath, { recursive: true });
    await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempFilePath, filePath);
  }
}

module.exports = {
  JsonStorageAdapter
};
