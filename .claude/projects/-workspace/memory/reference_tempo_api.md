---
name: reference-tempo-api
description: "Comment remplir la feuille de temps Tempo de Christophe via l'API (token, piège issueId, conventions am/pm)"
metadata:
  node_type: memory
  type: reference
  originSessionId: d707532a-1213-42ee-8548-d598b72f635e
  modified: 2026-11-26T10:59:19.406Z
---

Accès Tempo (feuille de temps ECF) depuis le conteneur, validé le 25/11/2026 :

- **Token** : `/workspace/sources/Echanges_claude_code/api key-tempo jira.txt` (fichier 33 octets, fourni par Christophe — ne jamais l'afficher, le lire en interne via Node/Python).
- **API** : `https://api.eu.tempo.io/4/` (hôte EU, pas `api.tempo.io` pour les écritures — les GET marchent sur les deux).
- **Piège POST /worklogs** : exige **`issueId` numérique** (le champ `issueKey` renvoie 400 « L'ID du ticket ne peut pas être sans valeur »). Les ids se récupèrent via les outils Jira MCP (`getJiraIssue`). `authorAccountId` = `712020:de7e6bc4-4979-480c-9939-59df840ca76b` (Christophe), `timeSpentSeconds` = `billableSeconds`, `startTime` « 08:00:00 » / « 14:00:00 ». Aucun attribut d'imputation requis (valeurs vides sur l'existant).
- **Piège PUT (vécu le 25/11/2026)** : `PUT /4/worklogs/{id}` renvoie 2xx mais **ignore silencieusement le changement d'`issueId`** (le worklog garde son ticket d'origine — vérifié par re-lecture). Pour changer le ticket d'une imputation : **DELETE puis re-POST** avec le bon `issueId`. Toujours re-vérifier la répartition par ticket après toute « correction » (`GET /4/worklogs?from=&to=` + agrégation par `issue.id`).
- **Conventions** : journée pleine = 2×4h (am/pm, comme l'existant) ; le travail réel fait un jour de congé/WE se **rapporte sur un jour ouvré** (à la demande de Christophe, avec mention dans la description) ; jamais d'imputation inventée — toujours adosser à des preuves (commits git `sources/*`, mémoires, tickets) ; exclus : perso (zest/forum/tra) et jours absents (croiser avec l'export Lucca « lucca abscenses.html » dans le même dossier).
- **Lectures** : `GET /4/worklogs?from=&to=` (worklogs de l'utilisateur du token) ; `/4/worklogs/{id}` pour la structure. Le MCP Jira n'expose **pas** Tempo — passer par cette API.
- **Méthode complète pas-à-pas** (preuves commits/tickets/Lucca, pondération, am/pm, vérification) : `sources/Echanges_claude_code/METHODE-TEMPO.md` — validée le 25/11/2026 (novembre = 27 worklogs / 108 h).
