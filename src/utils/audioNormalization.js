const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const ffmpegPath = require('ffmpeg-static');

const execFileAsync = promisify(execFile);

async function transcodeToPlaybackWav(inputPath, outputPath) {
  const resolvedFfmpegPath = process.env.FFMPEG_PATH || ffmpegPath;
  if (!resolvedFfmpegPath) {
    throw new Error('ffmpeg wurde nicht gefunden. Audio-Normalisierung ist nicht moeglich.');
  }

  await execFileAsync(
    resolvedFfmpegPath,
    [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '48000',
      '-ac',
      '2',
      outputPath
    ],
    {
      timeout: 120_000,
      windowsHide: true
    }
  );
}

module.exports = {
  transcodeToPlaybackWav
};
