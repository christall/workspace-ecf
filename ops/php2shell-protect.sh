#!/bin/bash
# =============================================================================
# php2shell-protect.sh — protection de la VM 217.182.168.21 contre PHP2Shell
#
# Failles : CVE-2026-109618 (UAF sur la gestion OOM) + CVE-2026-109619 (état
# global non réinitialisé) — RCE pré-authentification, CVSS 9.2, PoC publics et
# exploitation in-the-wild. Contexte : Apache 2.4.41 + mod_php 7.4.3-4ubuntu2.29
# (Ubuntu 20.04 focal — correctif uniquement via Ubuntu Pro/ESM).
# Correctif officiel : USN-8948-2 (publié le 21/10/2026) → 7.4.3-4ubuntu2.29+esm5.
#
# Usage (sur la VM, chemin déployé /opt/zest/php2shell-protect.sh) :
#   bash /opt/zest/php2shell-protect.sh --check       # état des lieux, aucun changement
#   bash /opt/zest/php2shell-protect.sh --mitigate    # mitigations php.ini (root requis)
#   bash /opt/zest/php2shell-protect.sh --patch       # patch ESM uniquement (root + Pro requis)
#   bash /opt/zest/php2shell-protect.sh               # en root : mitigations + patch + vérif
#
# Idempotent (rejouable sans danger), backup du php.ini horodaté avant modification.
# Journal : /var/log/php2shell-protect.log (si inscriptible).
# =============================================================================
set -u

LOG=/var/log/php2shell-protect.log
PHP_INI=/etc/php/7.4/apache2/php.ini
PHP_BIN=/usr/bin/php7.4
NEEDED="7.4.3-4ubuntu2.29+esm5"

# --- journalisation : stdout toujours, fichier si possible ---------------------
log() {
    local line="[$(date '+%F %T')] $*"
    echo "$line"
    if [ -w "$LOG" ] || [ -w "$(dirname "$LOG")" ]; then
        echo "$line" >> "$LOG"
    fi
}

die() { log "ERREUR: $*"; exit 1; }

as_root() { [ "$(id -u)" -eq 0 ]; }

php_ini_value() {
    "$PHP_BIN" -c "$PHP_INI" -i 2>/dev/null | grep "^$1" | awk '{print $3}'
}

# --- état des lieux (lecture seule, utilisable sans root) -----------------------
check() {
    log "=== ÉTAT DES LIEUX (lecture seule) ==="
    log "OS : $(lsb_release -ds 2>/dev/null)"
    log "PHP : $("$PHP_BIN" -v 2>/dev/null | head -1)"
    log "Apache : actif=$(systemctl is-active apache2 2>/dev/null) enabled=$(systemctl is-enabled apache2 2>/dev/null)"
    log "mod_php activés : $(ls /etc/apache2/mods-enabled/ 2>/dev/null | grep -E '^php' | tr '\n' ' ')"
    if ls /etc/apache2/mods-enabled/ 2>/dev/null | grep -q '^php5'; then
        log "⚠️  ATTENTION : un mod_php5.x est ACTIVÉ — PHP 5.x est aussi vulnérable à PHP2Shell."
    else
        log "mod_php5.x : non activé (OK, à laisser ainsi)"
    fi
    log "session.upload_progress.enabled : $(php_ini_value 'session.upload_progress.enabled')"
    log "memory_limit : $(php_ini_value 'memory_limit')"
    log "post_max_size : $(php_ini_value 'post_max_size')"
    log "upload_max_filesize : $(php_ini_value 'upload_max_filesize')"
    local pro_state
    pro_state=$(pro status --format json 2>/dev/null | grep -o '"attached": *[a-z]*' | head -1)
    log "Ubuntu Pro : ${pro_state:-non détecté}"
    local pkg
    pkg=$(dpkg-query -W -f='${Package} ${Version}\n' libapache2-mod-php7.4 2>/dev/null)
    log "libapache2-mod-php7.4 : ${pkg:-NON INSTALLÉ}"
    if [ -n "$pkg" ] && ! echo "$pkg" | grep -q "esm5"; then
        log "❌ PHP 7.4 NON corrigé — correctif requis : $NEEDED (Ubuntu Pro/ESM)"
    elif [ -n "$pkg" ]; then
        log "✅ PHP 7.4 corrigé (version ESM)"
    fi
    log "=== FIN ÉTAT DES LIEUX ==="
}

# --- vérification fonctionnelle post-changement ----------------------------------
verify() {
    log "=== VÉRIFICATION ==="
    local code host
    code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/ 2>/dev/null)
    log "HTTP 127.0.0.1 : ${code:-échec}"
    for host in zest.christall.net vdb.christall.net amlooweb.fr; do
        code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $host" http://127.0.0.1/ 2>/dev/null)
        log "HTTP Host $host : ${code:-échec}"
    done
    log "mod_php : $(apache2ctl -M 2>/dev/null | grep -iE 'php7' | tr '\n' ' ')"
    log "=== FIN VÉRIFICATION ==="
}

# --- mitigations php.ini (root requis) -------------------------------------------
mitigate() {
    as_root || die "--mitigate nécessite root (claude-deploy n'a pas sudo : geste Christophe)"
    log "=== MITIGATIONS php.ini ==="
    local bak="$PHP_INI.bak-php2shell-$(date '+%Y%m%d-%H%M%S')"
    cp -a "$PHP_INI" "$bak" || die "backup php.ini impossible"
    log "backup : $bak"

    # CVE-2026-109619 : progression d'upload en session désactivée (défaut : On).
    if grep -qE '^[[:space:]]*session\.upload_progress\.enabled[[:space:]]*=[[:space:]]*0' "$PHP_INI"; then
        log "session.upload_progress.enabled = 0 déjà présent"
    elif grep -qE '^[[:space:]]*session\.upload_progress\.enabled' "$PHP_INI"; then
        sed -i -E 's/^[[:space:]]*session\.upload_progress\.enabled[[:space:]]*=.*/session.upload_progress.enabled = 0/' "$PHP_INI"
        log "session.upload_progress.enabled = 0 appliqué (ligne existante corrigée)"
    else
        echo "session.upload_progress.enabled = 0" >> "$PHP_INI"
        log "session.upload_progress.enabled = 0 ajouté"
    fi

    # CVE-2026-109618 : memory_limit = -1 évite le chemin OOM défaillant (selon
    # l'avis). OPTIONNEL et non activé par défaut : chaque worker Apache perd son
    # plafond mémoire. Poser OPT_IN_MEMORY_LIMIT=1 devant la commande pour l'activer.
    if [ "${OPT_IN_MEMORY_LIMIT:-0}" = "1" ]; then
        sed -i -E 's/^[[:space:]]*memory_limit[[:space:]]*=.*/memory_limit = -1/' "$PHP_INI"
        log "memory_limit = -1 appliqué (mitigation CVE-2026-109618, optionnelle)"
    else
        log "memory_limit laissé tel quel (mitigation optionnelle non activée)"
    fi

    # post_max_size (8M) et upload_max_filesize (2M) : bornes déjà faibles, non touchées.

    systemctl reload apache2 || systemctl restart apache2 || die "reload Apache impossible"
    log "Apache rechargé : $(systemctl is-active apache2)"
    verify
}

# --- patch officiel via Ubuntu Pro/ESM (root + Pro attaché requis) -----------------
patch_php() {
    as_root || die "--patch nécessite root"
    log "=== PATCH PHP 7.4 (USN-8948-2, via ESM) ==="
    if ! pro status --format json 2>/dev/null | grep -q '"attached": *true'; then
        log "Ubuntu Pro n'est PAS attaché — le correctif ESM est indisponible."
        log "À faire une fois, en root :"
        log "  1. lancer : pro attach"
        log "  2. le lien affiché ouvre la création du token (compte Ubuntu One) — coller le token"
        log "  3. relancer ce script : il fera apt update + upgrade + reload + vérification"
        log "Note : le palier gratuit Ubuntu Pro (5 machines) vise un usage personnel ;"
        log "       pour un serveur d'entreprise, vérifier la licence. Alternative sans Pro :"
        log "       backports communautaires php7.4 focal (risque supply-chain, à valider d'abord)."
        return 0
    fi

    apt-get update -qq || die "apt-get update a échoué"
    local pkgs
    pkgs="$(dpkg-query -W -f='${Package} ' 'php7.4*' 2>/dev/null)libapache2-mod-php7.4"
    log "mise à niveau : $pkgs"
    DEBIAN_FRONTEND=noninteractive apt-get install -y --only-upgrade $pkgs || die "apt-get install a échoué"

    local ver
    ver=$(dpkg-query -W -f='${Version}' libapache2-mod-php7.4 2>/dev/null)
    if echo "$ver" | grep -q "esm5"; then
        log "✅ PHP 7.4 corrigé : $ver"
    else
        log "❌ version toujours non corrigée : $ver (attendu $NEEDED) — vérifier 'pro status' et les dépôts ESM."
    fi

    systemctl reload apache2 || systemctl restart apache2 || die "reload Apache impossible"
    log "Apache rechargé : $(systemctl is-active apache2)"
    verify
}

# --- point d'entrée ---------------------------------------------------------------
case "${1:-}" in
    --check)    check ;;
    --mitigate) mitigate ;;
    --patch)    patch_php ;;
    "")
        check
        if as_root; then
            mitigate
            patch_php
        else
            log "Exécuté sans root : état des lieux uniquement. En root : bash $0 (mitigations + patch)."
        fi
        ;;
    *) die "usage : bash $0 [--check|--mitigate|--patch]" ;;
esac
