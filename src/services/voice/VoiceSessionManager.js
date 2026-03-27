const { GuildVoiceSession } = require('./GuildVoiceSession');

class VoiceSessionManager {
  constructor(options) {
    this.captureSilenceMs = options.captureSilenceMs;
    this.clientUserId = null;
    this.logger = options.logger;
    this.maxPcmBufferBytes = options.maxPcmBufferBytes;
    this.maxQueueSize = options.maxQueueSize;
    this.sessions = new Map();
    this.speechService = options.speechService;
    this.triggerCooldownMs = options.triggerCooldownMs;
    this.triggerService = options.triggerService;
  }

  setClientUserId(userId) {
    this.clientUserId = userId;

    for (const session of this.sessions.values()) {
      session.clientUserId = userId;
    }
  }

  async joinForMember(member) {
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      return {
        ok: false,
        code: 'USER_NOT_IN_VOICE'
      };
    }

    let session = this.sessions.get(member.guild.id);
    if (!session) {
      session = new GuildVoiceSession({
        captureSilenceMs: this.captureSilenceMs,
        clientUserId: this.clientUserId,
        guildId: member.guild.id,
        logger: this.logger,
        maxPcmBufferBytes: this.maxPcmBufferBytes,
        maxQueueSize: this.maxQueueSize,
        onDestroyed: (guildId) => {
          this.sessions.delete(guildId);
        },
        speechService: this.speechService,
        triggerCooldownMs: this.triggerCooldownMs,
        triggerService: this.triggerService
      });
      this.sessions.set(member.guild.id, session);
    }

    try {
      const result = await session.connect(voiceChannel);
      return {
        ...result,
        channel: voiceChannel,
        ok: true,
        speechEnabled: this.speechService.isEnabled()
      };
    } catch (error) {
      this.sessions.delete(member.guild.id);
      session.cleanupConnection(false);
      throw error;
    }
  }

  async leaveGuild(guildId) {
    const session = this.sessions.get(guildId);
    if (!session) {
      return {
        ok: false,
        code: 'NOT_CONNECTED'
      };
    }

    await session.destroy('manual');
    return {
      ok: true
    };
  }

  async destroyAll() {
    const sessions = Array.from(this.sessions.values());
    await Promise.all(sessions.map((session) => session.destroy('shutdown')));
    this.sessions.clear();
  }
}

module.exports = {
  VoiceSessionManager
};
