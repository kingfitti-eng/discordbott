const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { transcodeToPlaybackWav } = require('./audioNormalization');
const { ensureDir } = require('./filesystem');
const { validateAttachmentMetadata } = require('./fileValidation');
const { sanitizeFileBaseName, sanitizePathSegment } = require('./sanitize');

async function downloadAttachment(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Datei konnte nicht heruntergeladen werden (HTTP ${response.status}).`);
  }

  const fileBuffer = Buffer.from(await response.arrayBuffer());
  if (!fileBuffer.length) {
    throw new Error('Die hochgeladene Datei ist leer.');
  }

  return fileBuffer;
}

async function storeAttachmentFile(options) {
  const { attachment, guildId, maxUploadSizeBytes, triggerName, uploadsDir } = options;
  const { extension } = validateAttachmentMetadata(attachment, maxUploadSizeBytes);
  const fileBuffer = await downloadAttachment(attachment.url);

  if (fileBuffer.length > maxUploadSizeBytes) {
    throw new Error(`Die Datei ist zu groß. Erlaubt sind maximal ${Math.round(maxUploadSizeBytes / 1024 / 1024)} MB.`);
  }

  const guildUploadDirectory = path.join(uploadsDir, sanitizePathSegment(guildId));
  await ensureDir(guildUploadDirectory);

  const safeTriggerName = sanitizePathSegment(triggerName).slice(0, 32);
  const safeBaseName = sanitizeFileBaseName(attachment.name || triggerName);
  const sourceFileName = `${Date.now()}-${safeTriggerName}-${safeBaseName}-${crypto.randomUUID()}${extension}`;
  const sourceFilePath = path.join(guildUploadDirectory, sourceFileName);
  const fileName = `${Date.now()}-${safeTriggerName}-${safeBaseName}-${crypto.randomUUID()}.wav`;
  const filePath = path.join(guildUploadDirectory, fileName);

  await fs.writeFile(sourceFilePath, fileBuffer);

  try {
    await transcodeToPlaybackWav(sourceFilePath, filePath);
  } finally {
    await fs.unlink(sourceFilePath).catch(() => {});
  }

  const storedFileStats = await fs.stat(filePath);

  return {
    fileName,
    filePath,
    mimeType: 'audio/wav',
    originalFileName: attachment.name || null,
    size: storedFileStats.size
  };
}

module.exports = {
  storeAttachmentFile
};
