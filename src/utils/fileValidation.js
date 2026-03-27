const path = require('node:path');

const AUDIO_EXTENSION_BY_CONTENT_TYPE = {
  'application/ogg': '.ogg',
  'audio/mp3': '.mp3',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav'
};

const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav']);
const ALLOWED_CONTENT_TYPES = new Set(Object.keys(AUDIO_EXTENSION_BY_CONTENT_TYPE));

function resolveAudioExtension(fileName, contentType) {
  const fileExtension = path.extname(fileName || '').toLowerCase();
  if (ALLOWED_AUDIO_EXTENSIONS.has(fileExtension)) {
    return fileExtension;
  }

  return AUDIO_EXTENSION_BY_CONTENT_TYPE[contentType] || '';
}

function validateTriggerName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Das Triggerwort darf nicht leer sein.');
  }

  if (name.length < 2) {
    throw new Error('Das Triggerwort muss mindestens 2 Zeichen lang sein.');
  }

  if (name.length > 40) {
    throw new Error('Das Triggerwort darf maximal 40 Zeichen lang sein.');
  }
}

function validateAttachmentMetadata(attachment, maxUploadSizeBytes) {
  if (!attachment?.url) {
    throw new Error('Die hochgeladene Datei konnte nicht gelesen werden.');
  }

  if (attachment.size && attachment.size > maxUploadSizeBytes) {
    throw new Error(`Die Datei ist zu groß. Erlaubt sind maximal ${Math.round(maxUploadSizeBytes / 1024 / 1024)} MB.`);
  }

  const extension = resolveAudioExtension(attachment.name, attachment.contentType);
  if (!extension) {
    throw new Error('Erlaubte Dateiformate sind mp3, wav und ogg.');
  }

  if (attachment.contentType && !ALLOWED_CONTENT_TYPES.has(attachment.contentType) && !ALLOWED_AUDIO_EXTENSIONS.has(path.extname(attachment.name || '').toLowerCase())) {
    throw new Error('Der Dateityp wird nicht unterstützt.');
  }

  return {
    extension
  };
}

module.exports = {
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_CONTENT_TYPES,
  validateAttachmentMetadata,
  validateTriggerName
};
