---
name: connexion-mysql-gplearn-recette
description: "Paramètres de connexion au MySQL de recette pour l'agent Claude — identifiants valides au 19/11/2026"
metadata:
  node_type: memory
  type: reference
  originSessionId: fe9e60f6-4f39-4149-848f-a03258333e28
  modified: 2026-11-19T10:02:36.048Z
---

Serveur MySQL **recette** : 192.168.1.130 (IP directe — le nom `gp-mysql-rct.cerca-ecf.lan`
ne résout pas depuis le conteneur, cf. [[feedback_handoff_when_env_lacks_capability]]).
Utilisateur : `proc_stock` — Mot de passe : `cXA6UI8QuEb8n48`
Commande : `mysql -h 192.168.1.130 -P 3306 -u proc_stock -p'cXA6UI8QuEb8n48'`
Droits vérifiés le 19/11/2026 : `ALL PRIVILEGES ON *.*` (CREATE/DROP DATABASE inclus).

⚠️ L'ancien couple `claude_agent`/`tHfizls9iFqZs7SG` de cette mémoire est **mort**
(ERROR 1045 constatée le 19/11/2026) — ne pas le réutiliser. Les identifiants vivants sont
aussi documentés dans `sources/CLAUDE.md` § Connexion MySQL (source primaire).
**Prod (`mysql-adh.ecf-cerca.fr:3307` et autres) : hors périmètre**, exécution par Christophe
via bddTools uniquement.
