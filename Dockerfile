FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# ffmpeg is required by yt-dlp's FFmpegExtractAudio postprocessor, which powers
# the third transcript fallback (audio download -> Gemini speech-to-text).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first so pip layer is cached across code-only changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import os, sys, urllib.request; p = os.environ.get('PORT', '8000'); sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:' + p + '/api/health', timeout=4).status == 200 else 1)"

# exec keeps uvicorn as PID 1 so SIGTERM shuts it down gracefully.
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
