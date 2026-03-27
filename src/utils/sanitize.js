function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeTriggerName(name) {
  return normalizeWhitespace(name).toLowerCase();
}

function normalizeTranscript(text) {
  return normalizeWhitespace(text).toLowerCase();
}

function sanitizePathSegment(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'item';
}

function sanitizeFileBaseName(fileName) {
  const sanitized = String(fileName)
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return sanitized || 'sound';
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTriggerMatchIndex(transcript, triggerName) {
  const pattern = new RegExp(`(^|\\W)${escapeRegex(triggerName)}($|\\W)`, 'i');
  const match = transcript.match(pattern);
  return match ? match.index ?? -1 : -1;
}

module.exports = {
  escapeRegex,
  getTriggerMatchIndex,
  normalizeTranscript,
  normalizeTriggerName,
  normalizeWhitespace,
  sanitizeFileBaseName,
  sanitizePathSegment
};
