const { normalizeTriggerName } = require('../../utils/sanitize');

class TriggerRepository {
  constructor(options) {
    this.storage = options.storage;
    this.filePath = options.filePath;
    this.writeLock = Promise.resolve();
  }

  async listByGuild(guildId) {
    const payload = await this.readStore();
    return payload.triggers
      .filter((trigger) => trigger.guildId === guildId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async findByGuildAndName(guildId, triggerName) {
    const normalizedName = normalizeTriggerName(triggerName);
    const payload = await this.readStore();
    return payload.triggers.find((trigger) => trigger.guildId === guildId && trigger.name === normalizedName) || null;
  }

  async createIfMissing(trigger) {
    return this.withWriteLock(async () => {
      const payload = await this.readStore();
      const existingTrigger = payload.triggers.find(
        (entry) => entry.guildId === trigger.guildId && entry.name === trigger.name
      );

      if (existingTrigger) {
        return {
          created: false,
          trigger: existingTrigger
        };
      }

      payload.triggers.push(trigger);
      await this.writeStore(payload);

      return {
        created: true,
        trigger
      };
    });
  }

  async replaceByGuildAndName(trigger) {
    return this.withWriteLock(async () => {
      const payload = await this.readStore();
      const index = payload.triggers.findIndex(
        (entry) => entry.guildId === trigger.guildId && entry.name === trigger.name
      );

      if (index === -1) {
        payload.triggers.push(trigger);
      } else {
        payload.triggers[index] = trigger;
      }

      await this.writeStore(payload);

      return {
        created: index === -1,
        trigger
      };
    });
  }

  async removeByGuildAndName(guildId, triggerName) {
    const normalizedName = normalizeTriggerName(triggerName);

    return this.withWriteLock(async () => {
      const payload = await this.readStore();
      const index = payload.triggers.findIndex(
        (trigger) => trigger.guildId === guildId && trigger.name === normalizedName
      );

      if (index === -1) {
        return null;
      }

      const [removedTrigger] = payload.triggers.splice(index, 1);
      await this.writeStore(payload);
      return removedTrigger;
    });
  }

  async readStore() {
    const payload = await this.storage.readJson(this.filePath, {
      version: 1,
      triggers: []
    });

    return {
      ...payload,
      triggers: Array.isArray(payload.triggers)
        ? payload.triggers.map((trigger) => this.normalizeTrigger(trigger))
        : []
    };
  }

  async writeStore(payload) {
    await this.storage.writeJson(this.filePath, payload);
  }

  async withWriteLock(task) {
    const nextTask = this.writeLock.then(task, task);
    this.writeLock = nextTask.then(
      () => undefined,
      () => undefined
    );

    return nextTask;
  }

  normalizeTrigger(trigger) {
    if (!trigger || typeof trigger !== 'object') {
      return trigger;
    }

    const legacyUrl = typeof trigger.legacyUrl === 'string'
      ? trigger.legacyUrl
      : typeof trigger.url === 'string'
        ? trigger.url
        : null;

    return {
      ...trigger,
      legacyUrl,
      filePath: typeof trigger.filePath === 'string' ? trigger.filePath : null
    };
  }
}

module.exports = {
  TriggerRepository
};
