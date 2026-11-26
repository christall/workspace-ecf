#!/bin/bash
# Démarre le routeur de modèles et vérifie la config Claude Code
set -e

ROUTEUR_DIR="/workspace/routeur"
SETTINGS_FILE="/workspace/.claude/settings.local.json"
ROUTER_URL="http://localhost:8787"
FALLBACK_URL="https://api.deepseek.com/anthropic"

cd "$ROUTEUR_DIR"

# 1. Vérifier que le routeur n'est pas déjà en marche
if curl -s http://localhost:8787/health > /dev/null 2>&1; then
    echo "✓ Routeur déjà en marche sur le port 8787"
else
    echo "Démarrage du routeur..."
    python3 main.py --port 8787 &
    sleep 2
    if curl -s http://localhost:8787/health > /dev/null 2>&1; then
        echo "✓ Routeur démarré"
    else
        echo "✗ Échec du démarrage — vérifier /workspace/routeur/routeur.log"
        exit 1
    fi
fi

# 2. Vérifier la config Claude Code (surcharges locales, hors git)
if grep -q "$ROUTER_URL" "$SETTINGS_FILE" /workspace/.claude/settings.json 2>/dev/null; then
    echo "✓ Claude Code pointe déjà vers le routeur"
else
    echo ""
    echo "Pour activer le routeur, ajouter dans $SETTINGS_FILE (non suivi par git) :"
    echo "  ANTHROPIC_BASE_URL = \"$ROUTER_URL\""
    echo "  ANTHROPIC_AUTH_TOKEN = \"<clé>\""
    echo ""
    echo "Pour revenir au direct DeepSeek :"
    echo "  ANTHROPIC_BASE_URL = \"$FALLBACK_URL\""
fi

echo ""
echo "Routeur prêt — providers disponibles :"
curl -s http://localhost:8787/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  {d[\"providers\"]} ({d[\"models\"]} modèles)')"
