const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

function formatContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context) || Object.keys(context).length === 0) {
    return '';
  }

  return ` ${JSON.stringify(context)}`;
}

function createLogger(level = 'info') {
  const activeLevel = LEVELS[level] ?? LEVELS.info;

  function shouldLog(targetLevel) {
    return (LEVELS[targetLevel] ?? LEVELS.info) <= activeLevel;
  }

  function write(targetLevel, message, context) {
    if (!shouldLog(targetLevel)) {
      return;
    }

    const output = `[${new Date().toISOString()}] [${targetLevel.toUpperCase()}] ${message}${formatContext(context)}`;
    const writer = targetLevel === 'error' ? console.error : console.log;
    writer(output);
  }

  return {
    error(message, context) {
      write('error', message, context);
    },
    warn(message, context) {
      write('warn', message, context);
    },
    info(message, context) {
      write('info', message, context);
    },
    debug(message, context) {
      write('debug', message, context);
    }
  };
}

module.exports = {
  createLogger
};
