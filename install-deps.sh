#!/bin/bash
# Réinstalle les node_modules du seul projet JS du workspace ECF : debordement-app.
# À lancer dans le conteneur après sa (re)création. Idempotent : réutilise le cache /pnpm-store.
set -e
cd /workspace
d=sources/applisWeb/debordement-app
echo "== pnpm install $d"
# --store-dir obligatoire : pnpm 12 ignore PNPM_STORE_DIR, les clés .npmrc et la
# variable npm_config_store_dir (régression constatée le 27/10/2026) — sans le flag,
# pnpm recrée un store dans /workspace/.pnpm-store sur le montage 9p.
(cd "$d" && pnpm install --store-dir /pnpm-store)
# Filet : si pnpm a recréé un store fantôme sur le montage malgré --store-dir,
# le purger (cache régénérable).
if [ -d /workspace/.pnpm-store ]; then
  echo "⚠️ /workspace/.pnpm-store recréé par pnpm — purge (le flag --store-dir n'a pas suffi)."
  rm -rf /workspace/.pnpm-store
fi
echo "Terminé."
