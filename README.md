# Discord Voice Trigger Bot

Ein modularer Discord-Bot mit `discord.js`, Prefix-Commands (`!join`, `!leave`), Slash-Commands (`/add`, `/list`, `/remove`), Trigger-Persistenz pro Guild und kostenloser Sprach-Erkennung fuer deutsche Triggerwoerter.

Diese Version ist jetzt auf einen AWS-tauglichen Betrieb ausgelegt:

- dauerhafte Bot-Laufzeit statt kurzlebigem Webhook-Style
- optionaler HTTP-Healthcheck fuer Container/Load-Balancer
- kostenloser lokaler Speech-Stack ueber `faster-whisper`
- Audio-Uploads werden beim Speichern in sauberes `wav` normalisiert

## Was jetzt funktioniert

- `!join` laesst den Bot dem Voice-Channel des Users beitreten
- `!leave` trennt die Voice-Verbindung wieder
- `/add` speichert Triggerwort plus Audiodatei lokal
- `/list` zeigt alle Trigger pro Guild
- `/remove` entfernt Trigger sauber
- Sounds werden pro Guild ueber eine Queue nacheinander abgespielt
- Sprache wird abschnittsweise erkannt und gegen Triggerwoerter gematcht
- Trigger koennen ueber sehr lange Calls laufen, weil nur kurze Sprachschnipsel verarbeitet werden statt ganze Calls zu puffern

## Beste kostenlose Speech-Loesung fuer deinen Fall

Fuer deinen Bot ist `faster-whisper` die robusteste kostenlose Option:

- kostenlos und lokal betreibbar
- in der Praxis stabiler und oft genauer als `whisper.cpp` bei laengerem Dauerbetrieb
- auf AWS CPU-Instanzen gut nutzbar
- deutsche Sprache wird gut erkannt

Wichtiger Realismus:

- komplett kostenlos ist die Speech-Engine, aber AWS-Compute selbst ist normalerweise nicht dauerhaft gratis
- fuer CPU-only auf AWS ist `small` der sinnvollste Start
- wenn du spaeter eine staerkere Instanz nutzt, kannst du auf `medium` hochgehen

## AWS-Empfehlung

Fuer einen Discord-Voice-Bot ist eine normale AWS-`Web Service`-Denke nicht ideal. Du brauchst einen Prozess, der dauerhaft online bleibt und Voice/Gateway-Verbindungen offen haelt.

Empfohlen:

1. `EC2` mit Docker
2. alternativ `ECS Service`

Nicht meine erste Wahl:

- App Runner
- Lambda

## Voraussetzungen

- Node.js `22.12+`
- Python `3.10+`
- `ffmpeg`
- Discord Bot im Developer Portal
- AWS-Host mit dauerhaft laufendem Prozess, wenn du online hosten willst

## Lokales Setup

1. Abhaengigkeiten installieren:

```powershell
npm.cmd install
pip install -r requirements.txt
```

2. Env-Datei anlegen:

```powershell
Copy-Item .env.example .env
```

3. `.env` fuellen:

```env
APPLICATION_ID=deine_application_id
DISCORD_TOKEN=dein_bot_token
GUILD_ID=deine_test_guild_id

SPEECH_PROVIDER=fasterwhisper
PYTHON_BIN=python3
FASTER_WHISPER_WORKER_PATH=./scripts/faster_whisper_worker.py
FASTER_WHISPER_MODEL=small
FASTER_WHISPER_LANGUAGE=de
FASTER_WHISPER_DEVICE=cpu
FASTER_WHISPER_COMPUTE_TYPE=int8
FASTER_WHISPER_BEAM_SIZE=1
FASTER_WHISPER_BEST_OF=5
FASTER_WHISPER_PATIENCE=1.5
FASTER_WHISPER_CPU_THREADS=0
FASTER_WHISPER_NUM_WORKERS=1
FASTER_WHISPER_HOTWORDS_ENABLED=true
FASTER_WHISPER_HOTWORDS_MAX=25
FASTER_WHISPER_VAD_FILTER=true
FASTER_WHISPER_VAD_MIN_SILENCE_MS=250
SPEECH_TRANSCRIPTION_TIMEOUT_MS=30000

HTTP_ENABLED=true
HOST=0.0.0.0
PORT=3000
```

4. Slash-Commands registrieren:

```powershell
npm.cmd run register-commands
```

5. Bot starten:

```powershell
npm.cmd start
```

## Docker fuer AWS

Dieses Repo hat jetzt ein `Dockerfile`.

Build lokal:

```powershell
docker build -t discord-voice-trigger-bot .
```

Start lokal im Container:

```powershell
docker run --env-file .env -p 3000:3000 discord-voice-trigger-bot
```

Healthcheck:

- `GET /health`
- `GET /`

Beispielantwort:

```json
{
  "ok": true,
  "speech": {
    "enabled": true,
    "provider": "fasterwhisper",
    "reason": "faster-whisper aktiv mit Modell small auf cpu/int8"
  },
  "uptimeSeconds": 42
}
```

## AWS-Deployment kurz und realistisch

Wenn du AWS schon nutzt, ist das der sinnvollste Weg:

1. Docker-Image bauen
2. nach ECR pushen
3. auf EC2 oder ECS als dauerhaft laufenden Service starten
4. `.env` als AWS-Umgebungsvariablen oder aus Secrets Manager setzen
5. `uploads` und `data` auf persistentem Volume oder spaeter S3/Postgres auslagern

## Wichtige Env-Variablen

Pflicht:

- `DISCORD_TOKEN`
- `APPLICATION_ID`
- `SPEECH_PROVIDER`

Fuer `faster-whisper`:

- `PYTHON_BIN`
- `FASTER_WHISPER_WORKER_PATH`
- `FASTER_WHISPER_MODEL`
- `FASTER_WHISPER_LANGUAGE`
- `FASTER_WHISPER_DEVICE`
- `FASTER_WHISPER_COMPUTE_TYPE`

Fuer staerkere Erkennung:

- `FASTER_WHISPER_BEAM_SIZE`
- `FASTER_WHISPER_BEST_OF`
- `FASTER_WHISPER_PATIENCE`
- `FASTER_WHISPER_HOTWORDS_ENABLED`
- `FASTER_WHISPER_HOTWORDS_MAX`
- `FASTER_WHISPER_VAD_MIN_SILENCE_MS`
- `FASTER_WHISPER_CPU_THREADS`
- `FASTER_WHISPER_NUM_WORKERS`

Optional:

- `GUILD_ID`
- `SOUND_CHANNEL_ID`
- `SUPABASE_URL`
- `SUPABASE_KEY`

## Trigger und Audio

- Trigger werden in `data/triggers.json` gespeichert
- Audiodateien werden in `uploads/` gespeichert
- neue Uploads werden automatisch in ein sauberes `wav` fuer stabiles Playback umgewandelt

## Discord Developer Portal

Aktiviere unter `Bot`:

- `MESSAGE CONTENT INTENT`

Scopes fuer den Invite:

- `bot`
- `applications.commands`

Empfohlene Berechtigungen:

- `View Channels`
- `Send Messages`
- `Read Message History`
- `Connect`
- `Speak`
- `Use Voice Activity`

## Realistische Grenzen

- Voice-Empfang und STT fuer viele gleichzeitige Sprecher kostet CPU
- `small` ist auf AWS CPU meist der beste Start
- `medium` ist genauer, aber schwerer
- fuer extrem laute oder ueberlappende Gespraeche bleibt Speech-to-Text fehleranfaellig
- es wird abschnittsweise nach kurzer Stille transkribiert, nicht als perfekte Wort-fuer-Wort-Livestream-Engine

## Was ich jetzt von dir brauche

- `DISCORD_TOKEN`
- `APPLICATION_ID`
- optional `GUILD_ID`
- Entscheidung: `EC2` oder `ECS`
- wenn du AWS direkt willst: ECR/EC2 oder ECS-Zugang

Wenn du willst, ist der naechste Schritt:

1. ich richte dir die `.env` fuer AWS sauber ein
2. danach gebe ich dir die exakten Docker- und AWS-Befehle fuer dein Setup
