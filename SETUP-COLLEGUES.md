# Environnement de développement Claude — Guide d'installation

## Prérequis

- **Docker Desktop** installé et démarré ([docker.com](https://www.docker.com/products/docker-desktop/))
- **Un compte Claude** (claude.ai) ou une clé API Anthropic
- **Google Drive** synchronisé sur le poste (le dossier de travail est géré via Drive)

---

## 1. Créer le dossier de travail

Créer un dossier sur votre Google Drive (ou ailleurs), par exemple :
```
C:\Users\<votre-nom>\Mon Drive\docker_dev\
```

Y placer les deux fichiers fournis :
- `Dockerfile`
- `claude.bat` (à modifier — voir étape 4)

---

## 2. Créer le dossier sources et cloner les dépôts

Dans `docker_dev`, créer un sous-dossier `sources` et y cloner les dépôts du projet :

```
docker_dev\
    sources\
        GPLearn\
        PlanniFProWeb\
        myroad_back\
        myroad_front\
        ecfcoach_back\
        ecfcoach_front\
        svnCERCA\
```

```bash
cd "C:\Users\<votre-nom>\Mon Drive\docker_dev\sources"
git clone <url-du-repo-GPLearn>
git clone <url-du-repo-PlanniFProWeb>
# ... etc.
```

---

## 3. Construire l'image Docker

Ouvrir un terminal dans le dossier `docker_dev` et lancer :

```bash
docker build -t mon-claude "C:\Users\<votre-nom>\Mon Drive\docker_dev"
```

> À ne faire qu'une fois (ou après modification du Dockerfile).

---

## 4. Adapter et lancer claude.bat

Éditer `claude.bat` et remplacer le chemin par le vôtre :

```bat
@echo off
docker run -it ^
  --memory 2g ^
  --cap-drop ALL ^
  -v "C:\Users\<votre-nom>\Mon Drive\docker_dev:/root:rw" ^
  mon-claude
```

Ensuite, double-cliquer sur `claude.bat` pour démarrer le conteneur.

---

## 5. Première connexion Claude

Au premier lancement, Claude Code demande une authentification :

```
> claude
```

Choisir **"Login with Claude.ai"** et suivre les instructions (ouverture d'un navigateur, connexion au compte).

> **Important :**
> - Utiliser son **compte claude.ai** (abonnement Pro ou Max) — **pas de clé API**.
> - Aucun token API n'est consommé : Claude tourne dans le forfait du compte.
> - Le login est **sauvegardé automatiquement** dans le dossier `docker_dev` (fichier `.credentials.json`). Il n'y a donc à se connecter **qu'une seule fois** — les sessions suivantes démarrent directement sans redemander l'authentification.

---

## 6. Structure du dossier de travail

```
docker_dev\                   ← monté sur /root dans le conteneur
    Dockerfile
    claude.bat
    settings.json             ← config Claude (thème, permissions, hooks)
    sources\                  ← dépôts git partagés (ignorés par le git local)
        GPLearn\
        PlanniFProWeb\
        ...
    analyse-refonte\          ← documents de travail Claude
    .claude\                  ← mémoire et config Claude Code
```

---

## Notes

- Le dossier `docker_dev` a son propre **git local** pour sauvegarder la config et la mémoire Claude. Les commits se font automatiquement en fin de session.
- Les dépôts dans `sources/` ont chacun leur propre git — les gérer indépendamment comme d'habitude.
- Google Drive assure la sauvegarde cloud du tout sans rien faire de plus.
