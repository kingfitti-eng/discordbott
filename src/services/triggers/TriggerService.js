const crypto = require('node:crypto');

const { safeUnlink } = require('../../utils/filesystem');
const { validateTriggerName } = require('../../utils/fileValidation');
const { storeAttachmentFile } = require('../../utils/fileStorage');
const { getTriggerMatchIndex, normalizeTranscript, normalizeTriggerName } = require('../../utils/sanitize');

class TriggerService {
  constructor(options) {
    this.logger = options.logger;
    this.maxUploadSizeBytes = options.maxUploadSizeBytes;
    this.repository = options.repository;
    this.uploadsDir = options.uploadsDir;
  }

  async addTrigger(options) {
    const normalizedName = normalizeTriggerName(options.name);
    validateTriggerName(normalizedName);

    const existingTrigger = await this.repository.findByGuildAndName(options.guildId, normalizedName);
    const canRepairExistingTrigger = existingTrigger && !existingTrigger.filePath;

    if (existingTrigger && !canRepairExistingTrigger) {
      return {
        created: false,
        reason: 'exists',
        trigger: existingTrigger
      };
    }

    const storedFile = await storeAttachmentFile({
      attachment: options.attachment,
      guildId: options.guildId,
      maxUploadSizeBytes: this.maxUploadSizeBytes,
      triggerName: normalizedName,
      uploadsDir: this.uploadsDir
    });

    const trigger = {
      id: existingTrigger?.id || crypto.randomUUID(),
      guildId: options.guildId,
      name: normalizedName,
      originalName: options.name.trim(),
      fileName: storedFile.fileName,
      filePath: storedFile.filePath,
      mimeType: storedFile.mimeType,
      originalFileName: storedFile.originalFileName,
      size: storedFile.size,
      createdAt: existingTrigger?.createdAt || new Date().toISOString(),
      createdBy: options.userId || existingTrigger?.createdBy || null
    };

    try {
      const result = canRepairExistingTrigger
        ? await this.repository.replaceByGuildAndName(trigger)
        : await this.repository.createIfMissing(trigger);

      if (!result.created && !canRepairExistingTrigger) {
        await safeUnlink(storedFile.filePath);
        return {
          created: false,
          reason: 'exists',
          trigger: result.trigger
        };
      }

      return {
        ...result,
        repaired: Boolean(canRepairExistingTrigger)
      };
    } catch (error) {
      await safeUnlink(storedFile.filePath);
      throw error;
    }
  }

  async removeTrigger(guildId, triggerName) {
    const removedTrigger = await this.repository.removeByGuildAndName(guildId, triggerName);
    if (!removedTrigger) {
      return null;
    }

    try {
      await safeUnlink(removedTrigger.filePath);
    } catch (error) {
      this.logger.warn('Trigger-Datei konnte nach dem Entfernen nicht gelöscht werden.', {
        error: error.message,
        filePath: removedTrigger.filePath,
        guildId
      });
    }

    return removedTrigger;
  }

  async listTriggers(guildId) {
    return this.repository.listByGuild(guildId);
  }

  async findMatchingTriggers(guildId, transcript) {
    const normalizedTranscript = normalizeTranscript(transcript);
    if (!normalizedTranscript) {
      return [];
    }

    const triggers = await this.repository.listByGuild(guildId);
    const matches = [];

    for (const trigger of triggers) {
      const matchIndex = getTriggerMatchIndex(normalizedTranscript, trigger.name);
      if (matchIndex >= 0) {
        matches.push({
          trigger,
          index: matchIndex
        });
      }
    }

    return matches
      .sort((left, right) => {
        if (left.index !== right.index) {
          return left.index - right.index;
        }

        return right.trigger.name.length - left.trigger.name.length;
      })
      .map((entry) => entry.trigger);
  }
}

module.exports = {
  TriggerService
};
