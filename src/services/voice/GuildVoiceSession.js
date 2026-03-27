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
    this.lastTriggerTimes = new Map();
    this.speakingHandler = null;
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

      this.logger.info('Sprachausschnitt wird transkribiert.', {
        bufferBytes: totalBytes,
        guildId: this.guildId,
        userId
      });

      const transcriptResult = await this.speechService.transcribePcm(Buffer.concat(chunks), {
        channels: 2,
        guildId: this.guildId,
        sampleRate: 48_000,
        userId
      });

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
