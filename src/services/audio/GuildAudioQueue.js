const fs = require('node:fs');

const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource
} = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');
const prism = require('prism-media');

class GuildAudioQueue {
  constructor(options) {
    this.guildId = options.guildId;
    this.logger = options.logger;
    this.maxQueueSize = options.maxQueueSize;
    this.queue = [];
    this.isAdvancing = false;

    if (ffmpegPath && !process.env.FFMPEG_PATH) {
      process.env.FFMPEG_PATH = ffmpegPath;
    }

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      void this.playNext();
    });

    this.player.on('error', (error) => {
      this.logger.error('Fehler beim Abspielen einer Audiodatei.', {
        error: error.message,
        guildId: this.guildId
      });
      void this.playNext();
    });
  }

  attachConnection(connection) {
    connection.subscribe(this.player);
  }

  enqueue(item) {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Die Audio-Queue ist voll.');
    }

    this.queue.push(item);

    if (this.player.state.status === AudioPlayerStatus.Idle) {
      void this.playNext();
    }
  }

  async playNext() {
    if (this.isAdvancing || this.player.state.status !== AudioPlayerStatus.Idle || this.queue.length === 0) {
      return;
    }

    this.isAdvancing = true;

    try {
      const nextItem = this.queue.shift();
      if (!nextItem) {
        return;
      }

      this.player.play(this.createResource(nextItem));
      this.logger.debug('Audio-Queue spielt den naechsten Sound ab.', {
        guildId: this.guildId,
        trigger: nextItem.triggerName,
        remainingItems: this.queue.length
      });
    } catch (error) {
      this.logger.error('Der naechste Sound konnte nicht gestartet werden.', {
        error: error.message,
        guildId: this.guildId
      });

      if (this.queue.length > 0) {
        void this.playNext();
      }
    } finally {
      this.isAdvancing = false;
    }
  }

  createResource(item) {
    if (!process.env.FFMPEG_PATH) {
      throw new Error('ffmpeg konnte nicht gefunden werden. Pruefe ffmpeg-static.');
    }

    if (!item.filePath || !fs.existsSync(item.filePath)) {
      throw new Error(`Audiodatei wurde nicht gefunden: ${item.filePath || 'unbekannt'}`);
    }

    const transcoder = new prism.FFmpeg({
      args: [
        '-analyzeduration',
        '0',
        '-loglevel',
        '0',
        '-i',
        item.filePath,
        '-f',
        's16le',
        '-ar',
        '48000',
        '-ac',
        '2',
        'pipe:1'
      ]
    });

    return createAudioResource(transcoder, {
      inputType: StreamType.Raw,
      metadata: item
    });
  }

  clear() {
    this.queue.length = 0;
  }

  stop() {
    this.clear();
    this.player.stop(true);
  }
}

module.exports = {
  GuildAudioQueue
};
