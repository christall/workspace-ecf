# Dockerfile — Contexte d'exécution Claude Code (workspace ECF)
# Image basée sur node:22-slim (Debian 12 Bookworm)
# Rebuild : claude.bat <session> build
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    git default-mysql-client \
    python3 python3-pip \
    sqlite3 \
    openssh-client \
    php-cli \
    tmux \
    curl \
    locales \
    && locale-gen fr_FR.UTF-8 \
    && rm -rf /var/lib/apt/lists/*
# Routeur de modèles — dépendances Python (outil partagé, dossier routeur/)
RUN pip install --break-system-packages -q fastapi uvicorn httpx pyyaml python-dotenv
RUN npm install -g @anthropic-ai/claude-code pnpm@12.15.0
# ttyd — terminal web sur port 3000 (accès smartphone)
# 1.7.7 = dernière release stable (2024-03-30), pas de version plus récente disponible
RUN python3 -c "import urllib.request; urllib.request.urlretrieve('https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64', '/usr/local/bin/ttyd')" \
    && chmod +x /usr/local/bin/ttyd
# Resize tmux : window-size latest = la session suit le dernier client connecté (navigateur ttyd)
RUN echo 'set -g window-size latest' > /root/.tmux.conf
ENV CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS=1
ENV PNPM_STORE_DIR=/pnpm-store
ENV npm_config_cache=/root/.npm
ENV LANG=fr_FR.UTF-8
ENV LC_ALL=fr_FR.UTF-8
WORKDIR /workspace
CMD ["bash"]
