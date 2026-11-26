#!/bin/bash
# Déplace tout node_modules réel sous /workspace (monté en 9p — lecture d'un
# grand nombre de petits fichiers catastrophiquement lente, ~50x mesuré, voir
# CLAUDE.md racine § node_modules sur 9p) vers le filesystem local du
# conteneur (/root, non-9p), et le remplace par un symlink. Généralise
# l'ancien vdb/ops/fix-node-modules-9p.sh à tout le workspace.
#
# Appelé automatiquement par docker-entrypoint.sh à CHAQUE démarrage du
# conteneur (docker start ET rebuild) — idempotent, sûr à relancer (no-op si
# déjà en place). /root est effacé par un rebuild (claude.bat ... build),
# pas par un simple restart — ce script se répare tout seul au redémarrage
# suivant sans action manuelle.
#
# Périmètre volontairement explicite (pas de `find /workspace -name
# node_modules` aveugle) : exclut sources/ (dépôts legacy CERCA/ECF, chacun
# son propre .git, déploiement géré manuellement depuis Windows par
# Christophe — périmètre séparé, voir CLAUDE.md racine § Périmètres).
set -uo pipefail  # pas -e : un projet en échec ne doit jamais bloquer les autres

CACHE_DIR="/root/.node-modules-cache"
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PROJETS=(
  "vdb/api"
  "vdb/web"
  "voice-bridge"
  "zest/admin"
  "zest/api"
  "zest/client"
  "tra/monitoring/pwa"
)

fix_one() {
  local rel="$1"
  local projet_dir="$WORKSPACE_DIR/$rel"
  local cache_key="${rel//\//-}"   # vdb/api -> vdb-api
  local cache_target="$CACHE_DIR/$cache_key/node_modules"
  local backup_dir="$projet_dir/node_modules.old-9p-backup"

  if [ ! -d "$projet_dir" ]; then
    echo "[$rel] absent, ignoré."
    return 0
  fi

  if [ -L "$projet_dir/node_modules" ] && [ -d "$cache_target" ] && [ -n "$(ls -A "$cache_target" 2>/dev/null)" ]; then
    echo "[$rel] déjà en place (symlink -> $cache_target)."
    return 0
  fi

  # Symlink présent mais cache LOCAL absent/vide : soit ce conteneur vient
  # d'être rebuild (son /root a été effacé), soit /workspace est partagé
  # avec un AUTRE conteneur qui a posé ce symlink sans partager /root (ex.
  # Codex — voir CLAUDE.md racine § Codex CLI). Dans les deux cas, la bonne
  # action est de reconstruire le cache local depuis .old-9p-backup si
  # présent — jamais de supprimer le symlink partagé : un autre conteneur
  # peut être en train de l'utiliser correctement au même moment.
  if [ -L "$projet_dir/node_modules" ]; then
    if [ -d "$backup_dir" ]; then
      echo "[$rel] symlink présent, cache local absent — reconstruction depuis $backup_dir ..."
      mkdir -p "$(dirname "$cache_target")"
      rm -rf "$cache_target"
      cp -r "$backup_dir" "$cache_target"
      # .modules.yaml enregistre le chemin du virtual store au moment de
      # l'install d'origine (avant déplacement) — périmé après la copie,
      # fait échouer silencieusement tout futur `pnpm add`/`install` (pnpm
      # détecte l'écart, refuse d'utiliser l'existant, n'installe rien
      # d'utilisable). Supprimé pour forcer une régénération propre au
      # prochain usage — vérifié empiriquement le 03/09/2026, voir CLAUDE.md
      # racine § node_modules sur 9p.
      rm -f "$cache_target/.modules.yaml"
      local n_src n_dst
      n_src=$(find "$backup_dir" -type f 2>/dev/null | wc -l)
      n_dst=$(find "$cache_target" -type f 2>/dev/null | wc -l)
      if [ "$n_src" = "$n_dst" ] && [ "$n_src" != "0" ]; then
        echo "[$rel] OK ($n_src fichiers) -> $cache_target (reconstruit depuis backup)"
      else
        echo "[$rel] ERREUR reconstruction incomplète ($n_dst/$n_src fichiers) — cache local laissé vide."
        rm -rf "$cache_target"
        return 1
      fi
    else
      echo "[$rel] symlink présent, cache local absent, pas de backup — pnpm install requis dans $projet_dir."
    fi
    return 0
  fi

  if [ ! -d "$projet_dir/node_modules" ]; then
    echo "[$rel] pas de node_modules — pnpm install requis dans $projet_dir."
    return 0
  fi

  echo "[$rel] copie node_modules -> $cache_target ..."
  mkdir -p "$(dirname "$cache_target")"
  rm -rf "$cache_target"
  cp -r "$projet_dir/node_modules" "$cache_target"

  local n_src n_dst
  n_src=$(find "$projet_dir/node_modules" -type f 2>/dev/null | wc -l)
  n_dst=$(find "$cache_target" -type f 2>/dev/null | wc -l)
  if [ "$n_src" != "$n_dst" ] || [ "$n_src" = "0" ]; then
    echo "[$rel] ERREUR copie incomplète ($n_dst/$n_src fichiers) — node_modules original laissé intact, rien basculé."
    rm -rf "$cache_target"
    return 1
  fi

  mv "$projet_dir/node_modules" "$backup_dir"
  ln -sfn "$cache_target" "$projet_dir/node_modules"
  # Même raison que dans la branche reconstruction ci-dessus : .modules.yaml
  # référence l'ancien emplacement, périmé dès qu'on bascule en symlink.
  rm -f "$cache_target/.modules.yaml"
  echo "[$rel] OK ($n_src fichiers) -> $cache_target"
}

for p in "${PROJETS[@]}"; do
  fix_one "$p" &
done
wait

echo ""
echo "Terminé. Vérifier : ls -la ${PROJETS[*]/%//node_modules}"
