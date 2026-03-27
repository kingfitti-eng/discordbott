module.exports = {
  name: 'join',
  description: 'Laesst den Bot dem Voice-Channel des Users beitreten.',
  async execute(message, context) {
    let result;

    try {
      result = await context.voiceSessionManager.joinForMember(message.member);
    } catch (error) {
      context.logger.error('Voice-Join ist fehlgeschlagen.', {
        error: error.message,
        guildId: message.guild.id,
        memberId: message.member?.id
      });

      let reply = 'Ich konnte dem Sprachkanal gerade nicht beitreten.';

      if (error.message.includes('timed out')) {
        reply += ' Discord hat die Voice-Verbindung nicht rechtzeitig bestaetigt. Versuch es bitte noch einmal.';
      } else if (error.message.includes('permission') || error.message.includes('Access')) {
        reply += ' Bitte pruefe, ob ich Connect- und Speak-Rechte fuer den Channel habe.';
      } else {
        reply += ` Fehler: ${error.message}`;
      }

      await message.reply(reply);
      return;
    }

    if (!result.ok) {
      await message.reply('Du musst zuerst in einem Sprachkanal sein, damit ich dir beitreten kann.');
      return;
    }

    let reply = `Ich bin jetzt in <#${result.channel.id}>.`;
    if (result.alreadyConnected) {
      reply = `Ich bin bereits in <#${result.channel.id}>.`;
    } else if (result.moved) {
      reply = `Ich bin in deinen Sprachkanal <#${result.channel.id}> gewechselt.`;
    }

    if (!result.speechEnabled) {
      reply += ' Die automatische Sprach-Trigger-Erkennung ist aktuell deaktiviert. Sie wird aktiv, sobald whisper.cpp konfiguriert und SPEECH_PROVIDER=whispercpp gesetzt ist.';
    }

    await message.reply(reply);
  }
};
