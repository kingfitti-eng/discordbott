class StorageAdapter {
  async readJson() {
    throw new Error('readJson must be implemented by a storage adapter.');
  }

  async writeJson() {
    throw new Error('writeJson must be implemented by a storage adapter.');
  }
}

module.exports = {
  StorageAdapter
};
