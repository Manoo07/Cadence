"""
Word-level transcription sidecar.

Prints one JSON object on stdout:

    {"words": [{"text": "...", "startMs": 0, "endMs": 320}, ...],
     "language": "en", "durationMs": 102300}

faster-whisper gives true word timings (`word_timestamps=True`), which is the
only reason this exists: segment-level timings are useless for karaoke
captions, and re-deriving words by splitting a segment on spaces guesses at
exactly the thing we need to be exact about.

Run with the project's media venv:
    .venv-media/bin/python scripts/transcribe.py <audio> [--model base] [--lang en]
"""

import argparse
import json
import subprocess
import sys


SAMPLE_RATE = 16000


def decode(path: str):
    """
    Decode any audio or video file to the mono float32 array Whisper wants.

    faster-whisper will happily open a file itself, but it does so through
    PyAV, whose API drifts between releases and breaks the call. ffmpeg is
    already a hard requirement of this project and decodes every container we
    care about, so we hand Whisper a plain array and keep PyAV out of the
    picture entirely. It also means a video file can be transcribed directly,
    with no separate audio-extraction step.
    """
    import numpy as np

    process = subprocess.run(
        [
            "ffmpeg", "-nostdin", "-v", "error",
            "-i", path,
            "-f", "f32le", "-acodec", "pcm_f32le",
            "-ac", "1", "-ar", str(SAMPLE_RATE),
            "-",
        ],
        capture_output=True,
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr.decode("utf8", "replace")[:500])
    return np.frombuffer(process.stdout, dtype=np.float32).copy()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--model", default="base")
    parser.add_argument("--lang", default=None)
    # A known script makes the transcript exact rather than merely close;
    # Whisper is used only for *when* each word is said, not what it is.
    parser.add_argument("--prompt", default=None)
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            json.dumps({"error": "faster-whisper is not installed in this interpreter."}),
            file=sys.stdout,
        )
        return 1

    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    segments, info = model.transcribe(
        decode(args.audio),
        word_timestamps=True,
        language=args.lang,
        initial_prompt=args.prompt,
        vad_filter=False,
        beam_size=5,
    )

    words = []
    for segment in segments:
        for word in segment.words or []:
            text = word.word.strip()
            if not text:
                continue
            words.append(
                {
                    "text": text,
                    "startMs": int(round(word.start * 1000)),
                    "endMs": int(round(word.end * 1000)),
                    "confidence": round(float(word.probability), 4),
                }
            )

    json.dump(
        {
            "words": words,
            "language": info.language,
            "durationMs": int(round(info.duration * 1000)),
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
