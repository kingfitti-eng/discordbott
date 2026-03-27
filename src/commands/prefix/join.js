module.exports = {
  name: 'join',
  description: 'Lässt den Bot dem Voice-Channel des Users beitreten.',
  async execute(message, context) {
    const result = await context.voiceSessionManager.joinForMember(message.member);

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
      reply += ' Die automatische Sprach-Trigger-Erkennung ist aktuell deaktiviert. Sie wird aktiv, sobald ein Speech-Provider wie Vosk konfiguriert ist.';
    }

    await message.reply(reply);
  }
};
