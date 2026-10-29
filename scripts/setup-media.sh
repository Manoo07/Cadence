#!/usr/bin/env bash
# Install the media toolchain: Whisper (word-level caption timing) and yt-dlp
# (sourcing footage). Both live in an isolated venv so nothing touches the
# system Python.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v uv >/dev/null || { echo "uv is required: https://docs.astral.sh/uv/"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required: brew install ffmpeg"; exit 1; }

uv venv .venv-media --python 3.12
uv pip install --python .venv-media faster-whisper yt-dlp

echo
echo "Installed:"
.venv-media/bin/yt-dlp --version | sed 's/^/  yt-dlp /'
.venv-media/bin/python -c "import faster_whisper; print('  faster-whisper ok')"
