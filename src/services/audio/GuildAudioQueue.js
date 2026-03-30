const fs = require('node:fs');

const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  createAudioPlayer,
  createAudioResource
} = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');

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
      this.logger.info('Audio-Player ist idle.', {
        guildId: this.guildId,
        queuedItems: this.queue.length
      });
      void this.playNext();
    });

    this.player.on(AudioPlayerStatus.Playing, () => {
      const metadata = this.player.state.resource?.metadata;
      this.logger.info('Audio-Player spielt Sound ab.', {
        filePath: metadata?.filePath,
        guildId: this.guildId,
        trigger: metadata?.triggerName
      });
    });

    this.player.on(AudioPlayerStatus.Paused, () => {
      const metadata = this.player.state.resource?.metadata;
      this.logger.info('Audio-Player wurde pausiert.', {
        filePath: metadata?.filePath,
        guildId: this.guildId,
        trigger: metadata?.triggerName
      });
    });

    this.player.on(AudioPlayerStatus.Buffering, () => {
      const metadata = this.player.state.resource?.metadata;
      this.logger.info('Audio-Player puffert Sound.', {
        filePath: metadata?.filePath,
        guildId: this.guildId,
        trigger: metadata?.triggerName
      });
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
    this.logger.info('Audio-Player wird mit Voice-Verbindung verbunden.', {
      guildId: this.guildId,
      status: connection.state.status
    });
    connection.subscribe(this.player);
  }

  enqueue(item) {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Die Audio-Queue ist voll.');
    }

    this.queue.push(item);
    this.logger.info('Sound wurde in die Audio-Queue gelegt.', {
      filePath: item.filePath,
      guildId: this.guildId,
      queueLength: this.queue.length,
      trigger: item.triggerName
    });

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

      this.logger.info('Audio-Queue startet den naechsten Sound.', {
        exists: fs.existsSync(nextItem.filePath),
        filePath: nextItem.filePath,
        guildId: this.guildId,
        trigger: nextItem.triggerName
      });
      this.player.play(this.createResource(nextItem));
      this.logger.info('Audio-Queue hat den Player gestartet.', {
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

    return createAudioResource(item.filePath, {
      metadata: item
    });
  }

  clear() {
    this.queue.length = 0;
  }

  isPlaybackActive() {
    return (
      this.player.state.status === AudioPlayerStatus.Playing ||
      this.player.state.status === AudioPlayerStatus.Buffering
    );
  }

  stop() {
    const hadAudio = this.queue.length > 0 || this.player.state.status !== AudioPlayerStatus.Idle;
    this.clear();
    this.player.stop(true);

    if (hadAudio) {
      this.logger.info('Audio-Player wurde gestoppt und die Queue geleert.', {
        guildId: this.guildId
      });
    }

    return {
      code: hadAudio ? 'STOPPED' : 'NOT_PLAYING',
      ok: hadAudio
    };
  }

  pause() {
    const isActivePlayback =
      this.player.state.status === AudioPlayerStatus.Playing ||
      this.player.state.status === AudioPlayerStatus.Buffering;

    if (!isActivePlayback) {
      return {
        code: 'NOT_PLAYING',
        ok: false
      };
    }

    const paused = this.player.pause(true);
    return {
      code: paused ? 'PAUSED' : 'NOT_PLAYING',
      ok: paused
    };
  }

  resume() {
    const isPausedPlayback =
      this.player.state.status === AudioPlayerStatus.Paused ||
      this.player.state.status === AudioPlayerStatus.AutoPaused;

    if (!isPausedPlayback) {
      return {
        code: 'NOT_PAUSED',
        ok: false
      };
    }

    const resumed = this.player.unpause();
    if (resumed) {
      this.logger.info('Audio-Player wird fortgesetzt.', {
        guildId: this.guildId
      });
    }

    return {
      code: resumed ? 'RESUMED' : 'NOT_PAUSED',
      ok: resumed
    };
  }
}

module.exports = {
  GuildAudioQueue
};
