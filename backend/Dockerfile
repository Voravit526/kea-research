FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for phonemization and building pyopenjtalk
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    cmake \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download unidic dictionary for Japanese (required by misaki)
RUN python -m unidic download

# Pre-download TTS model and tokenizer from HuggingFace (so first request is fast)
ENV HF_HOME=/app/.cache
RUN python -c "from huggingface_hub import hf_hub_download; \
    hf_hub_download('onnx-community/Kokoro-82M-v1.0-ONNX', 'onnx/model_quantized.onnx'); \
    hf_hub_download('onnx-community/Kokoro-82M-v1.0-ONNX', 'tokenizer.json')"

# Copy application code
COPY app/ ./app/

# Create directories
RUN mkdir -p /app/data /app/.cache

# Non-root user for security
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV HF_HOME=/app/.cache

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
