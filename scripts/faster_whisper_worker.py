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
    parser.add_argument("--cpu-threads", dest="cpu_threads", type=int, default=0)
    parser.add_argument("--language", default=None)
    parser.add_argument("--beam-size", dest="beam_size", type=int, default=1)
    parser.add_argument("--best-of", dest="best_of", type=int, default=5)
    parser.add_argument("--num-workers", dest="num_workers", type=int, default=1)
    parser.add_argument("--patience", dest="patience", type=float, default=1.0)
    parser.add_argument("--vad-filter", dest="vad_filter", default="true")
    parser.add_argument("--vad-min-silence-ms", dest="vad_min_silence_ms", type=int, default=250)
    return parser.parse_args()


def to_bool(value):
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def main():
    args = parse_args()
    model = WhisperModel(
        args.model,
        device=args.device,
        compute_type=args.compute_type,
        cpu_threads=args.cpu_threads,
        num_workers=args.num_workers,
    )

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
              best_of=args.best_of,
              hotwords=payload.get("hotwords") or None,
              patience=args.patience,
              vad_filter=to_bool(args.vad_filter),
              vad_parameters={"min_silence_duration_ms": args.vad_min_silence_ms},
              condition_on_previous_text=False,
          )
          text = " ".join(segment.text.strip() for segment in segments).strip()
          emit({"type": "result", "id": payload["id"], "text": text})
      except Exception as error:
          emit({"type": "result", "id": payload.get("id"), "error": str(error)})


if __name__ == "__main__":
    main()
