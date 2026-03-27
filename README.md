# Discord Voice Trigger Bot

Ein modularer Discord-Bot mit `discord.js`, Prefix-Commands (`!join`, `!leave`), Slash-Commands (`/add`, `/list`, `/remove`), lokaler Persistenz und vorbereiteter Speech-Service-Abstraktion fuer automatische Trigger in Voice-Channels.

## Was sofort funktioniert

- `!join` laesst den Bot dem Voice-Channel des Users beitreten.
- `!leave` trennt die Voice-Verbindung wieder.
- `/add` speichert ein Triggerwort plus Audiodatei lokal.
- `/list` zeigt alle Trigger fuer eine Guild.
- `/remove` entfernt Trigger wieder sauber inklusive Datei.
- Sounds werden pro Guild ueber eine Queue nacheinander abgespielt, damit sich nichts ueberlappt.
- Triggerdaten werden persistent in `data/triggers.json` abgelegt.

## Architektur

```text
src/
  index.js
  config/
    env.js
  commands/
    prefix/
      join.js
      leave.js
    slash/
      add.js
      list.js
      remove.js
  events/
    interactionCreate.js
    messageCreate.js
    ready.js
  services/
    audio/
      GuildAudioQueue.js
    speech/
      BaseSpeechRecognitionService.js
      NullSpeechRecognitionService.js
      SpeechServiceFactory.js
      VoskSpeechRecognitionService.js
    storage/
      JsonStorageAdapter.js
      StorageAdapter.js
    triggers/
      TriggerRepository.js
      TriggerService.js
    voice/
      GuildVoiceSession.js
      VoiceSessionManager.js
  utils/
    fileStorage.js
    fileValidation.js
    filesystem.js
    loaders.js
    logger.js
    sanitize.js
  scripts/
    register-commands.js
data/
uploads/
```

## Tech-Stack und warum

- `discord.js`: Standardbibliothek fuer Discord-Bots mit guter Slash-Command-Unterstuetzung.
- `@discordjs/voice`: Offizielle Voice-Erweiterung fuer Join, Playback und Audio-Receive.
- `prism-media`: Audio-Decoding fuer Discord-Voice und FFmpeg-Pipelines.
- `ffmpeg-static`: Bringt ein FFmpeg-Binary fuer lokales Audio-Transcoding mit, damit `mp3`, `wav` und `ogg` realistisch abgespielt werden koennen.
- `dotenv`: Liest Konfiguration aus `.env`.
- `vosk` als `optionalDependency`: Kostenlose lokale Speech-to-Text-Option ohne API-Key. Optional, weil Installation und Modell-Download je nach Plattform aufwendiger sein koennen.

## Voraussetzungen

- Node.js `20.11+`
- Ein Discord-Bot im [Discord Developer Portal](https://discord.com/developers/applications)
- Fuer automatische Speech-Erkennung optional:
  - installierbares `vosk`-Paket
  - lokal heruntergeladenes Vosk-Sprachmodell

## Setup

1. Abhaengigkeiten installieren:

```powershell
npm.cmd install
```

2. Umgebungsvariablen anlegen:

```powershell
Copy-Item .env.example .env
```

3. `.env` fuellen:

```env
APPLICATION_ID=deine_application_id
DISCORD_TOKEN=dein_bot_token
GUILD_ID=optional_fuer_schnelle_guild_registrierung
SOUND_CHANNEL_ID=optional_fester_sound_channel
SUPABASE_KEY=optional
SUPABASE_URL=optional
PREFIX=!
SPEECH_PROVIDER=none
VOSK_MODEL_PATH=
```

4. Slash-Commands registrieren:

```powershell
npm.cmd run register-commands
```

5. Bot starten:

```powershell
npm.cmd start
```

## Discord Developer Portal

Aktiviere unter `Bot` diese Einstellungen:

- `MESSAGE CONTENT INTENT`
- `SERVER MEMBERS INTENT` ist fuer diesen MVP nicht zwingend noetig, kann aber spaeter hilfreich sein

Noetige Gateway Intents im Code:

- `Guilds`
- `GuildMessages`
- `MessageContent`
- `GuildVoiceStates`

Empfohlene Bot-Berechtigungen:

- `View Channels`
- `Send Messages`
- `Read Message History`
- `Connect`
- `Speak`
- `Use Voice Activity`
- `Attach Files` ist fuer den Bot selbst nicht noetig, nur fuer User bei `/add`

## Verwendung

- `!join`
  - Der Bot joint den Voice-Channel des Users.
  - Wenn der Bot schon in einem anderen Channel ist, wechselt er dorthin.
- `!leave`
  - Der Bot verlaesst den Voice-Channel der Guild.
- `/add name:<trigger> file:<audio>`
  - Speichert einen Trigger fuer die aktuelle Guild.
- `/list`
  - Listet alle Trigger auf.
- `/remove name:<trigger>`
  - Entfernt einen Trigger.

## Persistenz und Erweiterbarkeit

- Trigger-Metadaten enthalten:
  - `id`
  - `guildId`
  - `name`
  - `originalName`
  - `fileName`
  - `filePath`
  - `mimeType`
  - `originalFileName`
  - `size`
  - `createdAt`
  - `createdBy`
- Persistenz laeuft aktuell ueber JSON.
- Der Wechsel auf SQLite oder PostgreSQL ist spaeter sauber moeglich, weil `TriggerRepository` bereits ueber eine Storage-Schicht arbeitet.

## Speech-Erkennung

### Aktueller MVP

Die Architektur fuer Live-Trigger im Voice-Call ist enthalten:

- Audio-Receive pro sprechendem User
- PCM-Decoding
- Speech-Service-Abstraktion
- Trigger-Matching pro Guild
- Audio-Queue pro Guild

### Kostenlose praktikable Option

`Vosk` ist die realistischste kostenlose lokale Option fuer einen MVP ohne API-Key:

1. Vosk-Modell lokal herunterladen
2. `SPEECH_PROVIDER=vosk` setzen
3. `VOSK_MODEL_PATH` auf das Modell zeigen lassen
4. Bot neu starten

Wenn Vosk nicht verfuegbar ist, faellt der Bot sauber auf `SPEECH_PROVIDER=none` zurueck. Dann funktionieren Join, Leave, Trigger-Verwaltung und Playback weiterhin, aber keine automatische Spracherkennung.

Wenn die optionale `vosk`-Installation auf deinem System fehlschlaegt, ist das fuer den Start kein Blocker. Lass `SPEECH_PROVIDER=none` gesetzt und nimm Vosk erst spaeter dazu.

## Deployment

Kostenlos oder guenstig moeglich auf:

- lokal auf einem eigenen PC oder Mini-PC
- Railway, wenn Voice und optionale native Dependencies in dein Budget passen
- VPS mit Node.js, falls du dauerhaft stabile Voice-Sessions willst

Fuer einen kostenlosen Start ist lokal oder ein kleiner Heimserver oft realistischer als serverlose Plattformen, weil Discord-Voice und kontinuierliches Audio-Processing keine gute Passung fuer klassische Free-Tier-Functions sind.

## Realistische Grenzen

- Discord-Voice empfangen und lokal in Speech-to-Text umwandeln ist technisch moeglich, aber deutlich fragiler als reines Sound-Playback.
- Komplett kostenlose Live-Spracherkennung ohne Cloud-API ist CPU-lastig und haengt stark von Audioqualitaet, Sprache, Dialekt und Hintergrundgeraeuschen ab.
- `vosk` ist fuer einen MVP ehrlich sinnvoll, aber nicht so treffsicher wie moderne kostenpflichtige Cloud-Modelle oder lokal optimierte Whisper-Setups.
- Exakte Echtzeit-Reaktion in jeder Situation ist nicht garantiert, weil Discord-Receive, Paketverluste, Silence-Ende und Modellqualitaet Grenzen setzen.
- Wenn du spaeter maximale Zuverlaessigkeit willst, ist die beste Erweiterung ein austauschbarer externer STT-Service oder ein staerkeres lokales Modell.

## Was ich jetzt von dir brauche

Pflicht:

- Discord-Account
- Discord-Anwendung plus Bot im Developer Portal
- `DISCORD_TOKEN`
- `APPLICATION_ID`
- mindestens einen Test-Server, in den du den Bot einlaedst

Empfohlen fuer schnellere Entwicklung:

- `GUILD_ID`, damit Slash-Commands sofort in einer Test-Guild registriert werden

Optional:

- `SOUND_CHANNEL_ID`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- ein lokales Vosk-Modell
- `VOSK_MODEL_PATH`
- spaeter Hosting-Ziel
- spaeter echte Datenbank statt JSON

Erst spaeter noetig:

- API-Key fuer externes Speech-to-Text
- PostgreSQL- oder andere Datenbank-Zugaenge
- erweitertes Monitoring oder Log-Aggregation
