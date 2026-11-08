#!/bin/bash
# Senior Voice — WSL Ubuntu user-level environment setup (no sudo needed)
set -x
export PATH="$HOME/.local/bin:$PATH"
cd "$HOME" || exit 1

echo "### 1. uv"
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"
uv --version || exit 1

echo "### 2. Python 3.11"
uv python install 3.11 || exit 1

echo "### 3. project venv"
mkdir -p "$HOME/senior-voice" && cd "$HOME/senior-voice" || exit 1
if [ ! -x .venv/bin/python ]; then
  uv venv --python 3.11 .venv || exit 1
fi
PY="$HOME/senior-voice/.venv/bin/python"
"$PY" --version

echo "### 4. PyTorch (Linux default wheel includes CUDA runtime)"
uv pip install -p "$PY" torch torchaudio || exit 1

echo "### 5. STT training / inference"
uv pip install -p "$PY" transformers peft datasets accelerate evaluate jiwer librosa soundfile faster-whisper tensorboard huggingface_hub || exit 1

echo "### 6. RAG / destination resolution"
uv pip install -p "$PY" sentence-transformers faiss-cpu rapidfuzz jamo || exit 1

echo "### 7. API server"
uv pip install -p "$PY" fastapi "uvicorn[standard]" python-multipart pydantic-settings httpx || exit 1

echo "### 8. verification"
"$PY" -c "import torch; print('TORCH', torch.__version__, '| CUDA available:', torch.cuda.is_available(), '|', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'no GPU')"
"$PY" -c "import transformers, peft, datasets, faster_whisper, faiss, sentence_transformers, rapidfuzz, jamo, fastapi, torchaudio, soundfile; print('IMPORTS OK', transformers.__version__, peft.__version__)"
echo "### DONE"
