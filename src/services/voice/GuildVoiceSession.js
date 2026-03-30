const { finished } = require('node:stream/promises');

const {
  EndBehaviorType,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel
} = require('@discordjs/voice');
const prism = require('prism-media');

const { GuildAudioQueue } = require('../audio/GuildAudioQueue');

class GuildVoiceSession {
  constructor(options) {
    this.captureSilenceMs = options.captureSilenceMs;
    this.channelId = null;
    this.clientUserId = options.clientUserId;
    this.connection = null;
    this.guildId = options.guildId;
    this.logger = options.logger;
    this.maxPcmBufferBytes = options.maxPcmBufferBytes;
    this.onDestroyed = options.onDestroyed;
    this.speechService = options.speechService;
    this.triggerCooldownMs = options.triggerCooldownMs;
    this.triggerService = options.triggerService;
    this.audioQueue = new GuildAudioQueue({
      guildId: options.guildId,
      logger: options.logger,
      maxQueueSize: options.maxQueueSize
    });
    this.activeCaptures = new Set();
    this.isProcessingTranscriptionQueue = false;
    this.lastTriggerTimes = new Map();
    this.speakingHandler = null;
    this.transcriptionQueue = [];
  }

  async connect(channel) {
    const wasConnected = Boolean(this.connection);
    const previousChannelId = this.channelId;

    if (wasConnected && previousChannelId === channel.id) {
      return {
        alreadyConnected: true,
        moved: false
      };
    }

    if (wasConnected) {
      this.cleanupConnection(false);
    }

    this.connection = joinVoiceChannel({
      adapterCreator: channel.guild.voiceAdapterCreator,
      channelId: channel.id,
      guildId: channel.guild.id,
      selfDeaf: false,
      selfMute: false
    });
    this.channelId = channel.id;

    this.bindConnectionEvents();
    await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
    this.audioQueue.attachConnection(this.connection);
    this.bindReceiver();

    return {
      alreadyConnected: false,
      moved: wasConnected && previousChannelId !== channel.id
    };
  }

  bindConnectionEvents() {
    const activeConnection = this.connection;

    activeConnection.on('stateChange', (oldState, newState) => {
      if (this.connection !== activeConnection) {
        return;
      }

      this.logger.info('Voice-Statuswechsel.', {
        guildId: this.guildId,
        newStatus: newState.status,
        oldStatus: oldState.status
      });
    });

    activeConnection.on('error', (error) => {
      if (this.connection !== activeConnection) {
        return;
      }

      this.logger.error('Voice-Verbindung hat einen Fehler gemeldet.', {
        error: error.message,
        guildId: this.guildId
      });
    });

    activeConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.connection !== activeConnection) {
        return;
      }

       this.logger.warn('Voice-Verbindung wurde getrennt.', {
        closeCode: activeConnection.state.closeCode,
        guildId: this.guildId,
        reason: activeConnection.state.reason,
        rejoinAttempts: activeConnection.rejoinAttempts
      });

      try {
        if (
          activeConnection.state.reason === VoiceConnectionDisconnectReason.WebSocketClose &&
          activeConnection.state.closeCode === 4014
        ) {
          await entersState(activeConnection, VoiceConnectionStatus.Connecting, 10_000);
          return;
        }

        if (activeConnection.rejoinAttempts < 10) {
          await new Promise((resolve) => setTimeout(resolve, (activeConnection.rejoinAttempts + 1) * 3_000));

          if (this.connection !== activeConnection) {
            return;
          }

          activeConnection.rejoin();
          await entersState(activeConnection, VoiceConnectionStatus.Ready, 30_000);
          return;
        }
      } catch {
        if (this.connection !== activeConnection) {
          return;
        }

        this.logger.warn('Voice-Verbindung wurde getrennt und konnte nicht wiederhergestellt werden.', {
          guildId: this.guildId
        });
      }
    });
  }

  bindReceiver() {
    if (!this.speechService.isEnabled()) {
      return;
    }

    this.speakingHandler = (userId) => {
      void this.captureSpeech(userId);
    };

    this.connection.receiver.speaking.on('start', this.speakingHandler);
  }

  async captureSpeech(userId) {
    if (!this.connection || !this.speechService.isEnabled()) {
      return;
    }

    if (this.audioQueue.isPlaybackActive()) {
      this.logger.info('Sprachcapture wird waehrend der Sound-Wiedergabe uebersprungen.', {
        guildId: this.guildId,
        userId
      });
      return;
    }

    if (userId === this.clientUserId || this.activeCaptures.has(userId)) {
      return;
    }

    this.activeCaptures.add(userId);
    let bufferLimitReached = false;

    try {
      const opusStream = this.connection.receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: this.captureSilenceMs
        }
      });

      const decoder = new prism.opus.Decoder({
        channels: 2,
        frameSize: 960,
        rate: 48_000
      });

      const chunks = [];
      let totalBytes = 0;

      decoder.on('data', (chunk) => {
        totalBytes += chunk.length;

        if (totalBytes <= this.maxPcmBufferBytes) {
          chunks.push(chunk);
          return;
        }

        bufferLimitReached = true;
        decoder.destroy(new Error('Maximale Speech-Puffergröße erreicht.'));
        opusStream.destroy();
      });

      opusStream.pipe(decoder);
      const streamResult = await finished(decoder).then(() => null).catch((error) => error);

      if (streamResult && !bufferLimitReached && streamResult.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        this.logger.warn('Audio-Stream eines Sprechers konnte nicht sauber verarbeitet werden.', {
          error: streamResult.message,
          guildId: this.guildId,
          userId
        });
      }

      if (!chunks.length || bufferLimitReached) {
        return;
      }

      if (this.audioQueue.isPlaybackActive()) {
        this.logger.info('Sprachausschnitt wird verworfen, weil waehrenddessen ein Sound abgespielt wurde.', {
          bufferBytes: totalBytes,
          guildId: this.guildId,
          userId
        });
        return;
      }

      this.logger.info('Sprachausschnitt wird transkribiert.', {
        bufferBytes: totalBytes,
        guildId: this.guildId,
        userId
      });

      const hotwords = await this.triggerService.buildSpeechHotwords(this.guildId, {
        maxCount: this.speechService.hotwordsMax || 25
      });

      const transcriptResult = await this.enqueueTranscriptionTask(
        () =>
          this.speechService.transcribePcm(Buffer.concat(chunks), {
            channels: 2,
            guildId: this.guildId,
            hotwords,
            sampleRate: 48_000,
            userId
          }),
        {
          bufferBytes: totalBytes,
          userId
        }
      );

      if (!transcriptResult?.text) {
        this.logger.info('Keine erkennbare Sprache im Ausschnitt gefunden.', {
          guildId: this.guildId,
          userId
        });
        return;
      }

      this.logger.info('Transkript erhalten.', {
        guildId: this.guildId,
        text: transcriptResult.text,
        userId
      });

      await this.handleTranscript(userId, transcriptResult.text);
    } catch (error) {
      this.logger.warn('Sprachcapture konnte nicht verarbeitet werden.', {
        error: error.message,
        guildId: this.guildId,
        userId
      });
    } finally {
      this.activeCaptures.delete(userId);
    }
  }

  async handleTranscript(userId, transcript) {
    const matchingTriggers = await this.triggerService.findMatchingTriggers(this.guildId, transcript);
    if (matchingTriggers.length === 0) {
      return;
    }

    for (const trigger of matchingTriggers) {
      if (!trigger.filePath) {
        this.logger.warn('Trigger kann nicht abgespielt werden, weil keine lokale Audiodatei vorhanden ist.', {
          guildId: this.guildId,
          legacyUrl: trigger.legacyUrl,
          trigger: trigger.name,
          userId
        });
        continue;
      }

      const lastTriggeredAt = this.lastTriggerTimes.get(trigger.name) || 0;
      const now = Date.now();

      if (now - lastTriggeredAt < this.triggerCooldownMs) {
        continue;
      }

      try {
        this.audioQueue.enqueue({
          filePath: trigger.filePath,
          requestedBy: userId,
          transcript,
          triggerName: trigger.name
        });
      } catch (error) {
        this.logger.warn('Trigger konnte nicht in die Audio-Queue gelegt werden.', {
          error: error.message,
          guildId: this.guildId,
          trigger: trigger.name
        });
        continue;
      }

      this.lastTriggerTimes.set(trigger.name, now);
      this.logger.info('Triggerwort erkannt und zur Audio-Queue hinzugefügt.', {
        guildId: this.guildId,
        trigger: trigger.name,
        userId
      });
    }
  }

  async enqueueTranscriptionTask(task, metadata) {
    return new Promise((resolve, reject) => {
      this.transcriptionQueue.push({
        metadata,
        reject,
        resolve,
        task
      });

      if (this.transcriptionQueue.length > 1) {
        this.logger.info('Speech-Transkription wurde in die Warteschlange gestellt.', {
          guildId: this.guildId,
          queuedJobs: this.transcriptionQueue.length,
          userId: metadata?.userId
        });
      }

      void this.processTranscriptionQueue();
    });
  }

  async processTranscriptionQueue() {
    if (this.isProcessingTranscriptionQueue) {
      return;
    }

    this.isProcessingTranscriptionQueue = true;

    try {
      while (this.transcriptionQueue.length > 0) {
        const nextJob = this.transcriptionQueue.shift();
        if (!nextJob) {
          continue;
        }

        try {
          const result = await nextJob.task();
          nextJob.resolve(result);
        } catch (error) {
          nextJob.reject(error);
        }
      }
    } finally {
      this.isProcessingTranscriptionQueue = false;
    }
  }

  pausePlayback() {
    return this.audioQueue.pause();
  }

  resumePlayback() {
    return this.audioQueue.resume();
  }

  stopPlayback() {
    return this.audioQueue.stop();
  }

  async destroy(reason = 'manual') {
    this.logger.info('Voice-Session wird beendet.', {
      guildId: this.guildId,
      reason
    });
    this.cleanupConnection(true);
  }

  cleanupConnection(notifyManager) {
    const activeConnection = this.connection;

    if (activeConnection?.receiver?.speaking && this.speakingHandler) {
      activeConnection.receiver.speaking.off('start', this.speakingHandler);
      this.speakingHandler = null;
    }

    this.audioQueue.stop();
    this.activeCaptures.clear();
    this.lastTriggerTimes.clear();

    while (this.transcriptionQueue.length > 0) {
      const pendingJob = this.transcriptionQueue.shift();
      pendingJob?.reject?.(new Error('Voice-Session wurde beendet.'));
    }

    if (activeConnection) {
      activeConnection.removeAllListeners('error');
      activeConnection.removeAllListeners(VoiceConnectionStatus.Disconnected);
      activeConnection.destroy();
    }

    this.connection = null;
    this.channelId = null;

    if (notifyManager && typeof this.onDestroyed === 'function') {
      this.onDestroyed(this.guildId);
    }
  }
}

module.exports = {
  GuildVoiceSession
};
