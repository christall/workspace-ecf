---
name: Une livraison inclut le déploiement en prod
description: Si le code modifié tourne en production et que j'ai l'accès pour déployer, « livré » signifie déployé et vérifié — pas local + patch documenté « hors périmètre »
type: feedback
originSessionId: 354003d0-c93f-4632-9d61-04831533a06c
---
Quand le code modifié tourne sur un système en production et que l'accès de déploiement est
disponible (SSH, rsync, docker compose), ne pas clore la tâche sur une implémentation locale en
reportant le déploiement en « reste à faire / hors périmètre ». Déployer, vérifier, puis
annoncer.

**Why:** Le 23/10/2026, après avoir implémenté le Model Guardian du forum, j'ai annoncé la
livraison en documentant le patch de la VM comme hors périmètre — alors que j'avais la clé SSH
et que le forum tourne en prod sur la VM. Christophe a répondu « poussé sur la vm ? ». Pour lui
la tâche n'était pas finie : un code non déployé ne change rien au comportement du système, et
découper le périmètre de ma propre initiative transforme une livraison en travail à reprendre.

**How to apply:** Avant d'écrire « terminé » / `result:` : ce code tourne-t-il quelque part en
prod ? ai-je l'accès ? Si oui → backup, patch par blocs exacts (jamais écraser un fichier de
prod par sa version locale, les deux divergent), vérification sur place (compilation, tests,
simulation), puis annonce avec les backups. Si je décide de ne pas déployer (session en cours
sur la cible, risque réel), le poser comme une question explicite au lieu de le trancher
unilatéralement. Cohérent avec [[pas-de-demande-de-confirmation-systematique]] : déployer
plutôt que demander la permission de déployer.
