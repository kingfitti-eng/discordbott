function normalizeWhitespace(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeTriggerName(name) {
  return normalizeWhitespace(name).toLowerCase();
}

function normalizeTranscript(text) {
  return normalizeWhitespace(text).toLowerCase();
}

function normalizeSpeechToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function collapseRepeatedCharacters(value) {
  return value.replace(/(.)\1+/g, '$1');
}

function createGermanPhoneticKey(value) {
  let token = normalizeSpeechToken(value);
  if (!token) {
    return '';
  }

  token = token
    .replace(/sch/g, 's')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'kw')
    .replace(/x/g, 'ks')
    .replace(/(?:tz|ts|zs|ss)/g, 's')
    .replace(/[vw]/g, 'f')
    .replace(/[yj]/g, 'i')
    .replace(/c(?=[aoukqrxl])/g, 'k')
    .replace(/c/g, 's')
    .replace(/h/g, '')
    .replace(/[aeiou]+/g, 'a');

  return collapseRepeatedCharacters(token);
}

function tokenizeSpeechText(text) {
  const normalizedText = normalizeTranscript(text);
  const tokens = [];
  const pattern = /[\p{L}\p{N}]+/gu;

  for (const match of normalizedText.matchAll(pattern)) {
    const raw = match[0];
    const normalized = normalizeSpeechToken(raw);
    if (!normalized) {
      continue;
    }

    tokens.push({
      index: match.index ?? -1,
      normalized,
      phonetic: createGermanPhoneticKey(normalized)
    });
  }

  return tokens;
}

function findTokenWindowMatchIndex(transcriptTokens, triggerTokens, predicate) {
  if (!transcriptTokens.length || !triggerTokens.length || transcriptTokens.length < triggerTokens.length) {
    return -1;
  }

  const lastStartIndex = transcriptTokens.length - triggerTokens.length;
  for (let startIndex = 0; startIndex <= lastStartIndex; startIndex += 1) {
    let matches = true;

    for (let offset = 0; offset < triggerTokens.length; offset += 1) {
      if (!predicate(transcriptTokens[startIndex + offset], triggerTokens[offset])) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return transcriptTokens[startIndex].index;
    }
  }

  return -1;
}

function isPhoneticEquivalent(transcriptToken, triggerToken) {
  if (!transcriptToken?.normalized || !triggerToken?.normalized) {
    return false;
  }

  if (transcriptToken.normalized === triggerToken.normalized) {
    return true;
  }

  if (triggerToken.normalized.length < 4 || transcriptToken.normalized.length < 4) {
    return false;
  }

  return (
    transcriptToken.phonetic &&
    transcriptToken.phonetic === triggerToken.phonetic &&
    transcriptToken.normalized[0] === triggerToken.normalized[0]
  );
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
  const transcriptTokens = tokenizeSpeechText(transcript);
  const triggerTokens = tokenizeSpeechText(triggerName);

  const exactMatchIndex = findTokenWindowMatchIndex(
    transcriptTokens,
    triggerTokens,
    (transcriptToken, triggerToken) => transcriptToken.normalized === triggerToken.normalized
  );

  if (exactMatchIndex >= 0) {
    return exactMatchIndex;
  }

  return findTokenWindowMatchIndex(transcriptTokens, triggerTokens, isPhoneticEquivalent);
}

module.exports = {
  createGermanPhoneticKey,
  escapeRegex,
  getTriggerMatchIndex,
  normalizeTranscript,
  normalizeSpeechToken,
  normalizeTriggerName,
  normalizeWhitespace,
  sanitizeFileBaseName,
  sanitizePathSegment
};
