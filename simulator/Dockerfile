# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f simulator/Dockerfile .
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN groupadd -g 1001 vitalguard && \
    useradd -u 1001 -g vitalguard -m -s /bin/bash vitalguard

COPY simulator/requirements.txt ./simulator/
RUN pip install --no-cache-dir -r ./simulator/requirements.txt

COPY schemas ./schemas
COPY simulator ./simulator

RUN chown -R vitalguard:vitalguard /app

USER vitalguard
WORKDIR /app/simulator

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/healthz')" || exit 1

CMD ["python", "manager.py"]
