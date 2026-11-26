# Environnement Docker de développement

## Lancer / reprendre une session Claude

```bat
claude.bat              → session nommée "session" (défaut)
claude.bat monprojet    → session nommée "claude-monprojet"
claude.bat monprojet build  → rebuild l'image Docker
claude.bat monprojet bash   → bash direct dans le conteneur
```

Le script `claude.bat` est dans `C:\Users\christophe.alleon\Mon Drive\docker_dev\`.

## Ce que fait le conteneur

- Image : `mon-claude` (buildée depuis `docker_dev\`)
- Mémoire : 2 Go
- Volume : `docker_dev\` monté en `/workspace` (lecture/écriture)
- **Port exposé : 3000 → 3000 uniquement**

> Pour accéder à une app depuis Windows, elle doit écouter sur le port **3000**.

## Accéder à une app web depuis Windows

Tout serveur lancé dans le conteneur doit tourner sur le **port 3000** :

| App | Commande dans le conteneur |
|-----|---------------------------|
| IPTV PWA (dev) | `cd /workspace/iptv && npx vite --port 3000` |
| IPTV PWA (preview) | `cd /workspace/iptv && npx vite preview --port 3000` |
| ERP Next.js | voir `erp/docker-compose.yml` (port 3003) |

Puis ouvrir **http://localhost:3000** dans Chrome sur Windows.

## Rebuild de l'image

```bat
claude.bat build
```

ou pour une session nommée :
```bat
claude.bat monprojet build
```
