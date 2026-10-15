# Render box: everything needed to build videos headlessly.
#   docker build -t video-factory .
#   docker run --rm -v "$PWD/projects:/app/projects" -v "$PWD/.vf-cache:/app/.vf-cache" --env-file .env \
#     video-factory build projects/example-photosynthesis
FROM node:22-bookworm-slim

# ffmpeg for mastering; the rest are Chrome headless-shell dependencies for Remotion.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
      libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npx remotion browser ensure
COPY . .

ENTRYPOINT ["npx", "tsx", "src/cli.ts"]
CMD ["--help"]
