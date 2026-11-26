#!/bin/bash
# Lance l'ERP depuis le container Docker
# node_modules installés dans /opt/erp-deps (hors Drive)

ERP_DIR="/workspace/erp"
DEPS_DIR="/opt/erp-deps"

cd "$ERP_DIR"

# Installer les dépendances si absentes ou package.json plus récent
if [ ! -d "$DEPS_DIR/node_modules" ] || [ "$ERP_DIR/package.json" -nt "$DEPS_DIR/node_modules/.package-lock.json" ]; then
  echo "📦 Installation des dépendances dans $DEPS_DIR..."
  mkdir -p "$DEPS_DIR"
  cp package.json package-lock.json "$DEPS_DIR/" 2>/dev/null || true
  cd "$DEPS_DIR" && npm install --silent
  cd "$ERP_DIR"
fi

# Lien symbolique node_modules → /opt/erp-deps/node_modules
if [ ! -L "$ERP_DIR/node_modules" ] || [ "$(readlink $ERP_DIR/node_modules)" != "$DEPS_DIR/node_modules" ]; then
  rm -rf "$ERP_DIR/node_modules"
  ln -sf "$DEPS_DIR/node_modules" "$ERP_DIR/node_modules"
  echo "🔗 node_modules lié vers $DEPS_DIR"
fi

# Initialiser la base si absente
mkdir -p "$ERP_DIR/db"
if [ ! -f "$ERP_DIR/db/erp.db" ]; then
  echo "🗄️  Création de la base avec données de démo..."
  npx --prefix "$DEPS_DIR" tsx "$ERP_DIR/db/seed.ts"
fi

echo "🚀 Démarrage ERP sur http://localhost:3000"
echo "   admin@cerca.fr / Demo1234!"
echo ""
exec npx --prefix "$DEPS_DIR" next dev --turbopack
