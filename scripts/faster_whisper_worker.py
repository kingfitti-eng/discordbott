import argparse
import json
import sys

from faster_whisper import WhisperModel


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", dest="compute_type", default="int8")
    parser.add_argument("--language", default=None)
    parser.add_argument("--beam-size", dest="beam_size", type=int, default=1)
    parser.add_argument("--vad-filter", dest="vad_filter", default="true")
    return parser.parse_args()


def to_bool(value):
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def main():
    args = parse_args()
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)

    emit(
        {
            "type": "ready",
            "model": args.model,
            "device": args.device,
            "compute_type": args.compute_type,
        }
    )

    for raw_line in sys.stdin:
      line = raw_line.strip()
      if not line:
          continue

      try:
          payload = json.loads(line)
          segments, _ = model.transcribe(
              payload["wavPath"],
              language=payload.get("language") or args.language,
              beam_size=args.beam_size,
              vad_filter=to_bool(args.vad_filter),
              condition_on_previous_text=False,
          )
          text = " ".join(segment.text.strip() for segment in segments).strip()
          emit({"type": "result", "id": payload["id"], "text": text})
      except Exception as error:
          emit({"type": "result", "id": payload.get("id"), "error": str(error)})


if __name__ == "__main__":
    main()
