FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN useradd --create-home --uid 10001 appuser

COPY --from=builder /install /usr/local
COPY app ./app
COPY scripts ./scripts
COPY migrations ./migrations
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini

RUN mkdir -p /app/uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=3)"

CMD ["sh", "-c", "python scripts/init_db.py && exec uvicorn app.main:app --host 0.0.0.0 --port 8080 --proxy-headers --forwarded-allow-ips='*'"]
