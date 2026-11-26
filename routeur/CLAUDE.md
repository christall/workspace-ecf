# Routeur de modèles pour Claude Code

Proxy HTTP qui intercepte les appels API de Claude Code et les route vers le
provider approprié (Anthropic, DeepSeek, OpenAI, Groq), avec traduction de
formats si nécessaire.

## Démarrage rapide

```bash
# 1. Configurer les clés API (une seule suffit pour démarrer)
cp .env.example .env
# Éditer .env et ajouter au moins une clé

# 2. Lancer le routeur (reste en foreground, ou & pour background)
cd /workspace/routeur
python3 main.py --port 8787 &

# 3. Rediriger Claude Code vers le routeur
# Dans .claude/settings.local.json (non suivi par git), ajouter dans "env" :
#   "ANTHROPIC_BASE_URL": "http://localhost:8787"
#   "ANTHROPIC_AUTH_TOKEN": "<clé>"
# Puis relancer Claude Code. Ne jamais mettre la clé dans settings.json (suivi).

# 4. Vérifier que ça fonctionne
python3 main.py --check
```

## Utilisation

### Routing direct

Claude Code envoie le modèle demandé → le routeur le mappe au bon provider :

| Modèle demandé | Provider | Modèle effectif |
|---|---|---|
| `deepseek-v4-pro` | DeepSeek | `deepseek-v4-pro` |
| `deepseek-v4-flash` | DeepSeek | `deepseek-v4-flash` |
| `claude-sonnet-5` | Anthropic | `claude-sonnet-5` |
| `gpt-4o` | OpenAI | `gpt-4o` |
| `gpt-4o-mini` | OpenAI | `gpt-4o-mini` |
| `openai/gpt-oss-120b` | Groq | `openai/gpt-oss-120b` |

### Smart routing

Définir `ANTHROPIC_MODEL=auto` dans `.claude/settings.json` → le routeur choisit
automatiquement le modèle selon la complexité du prompt :

- Prompt court (<3000 chars), sans outils → modèle **haiku** (flash, mini)
- Prompt complexe, ≥3 outils → modèle **opus** (pro, opus-4-8)
- Défaut → modèle **sonnet** (pro, sonnet-5, gpt-4o)

### Table ronde

Dans Claude Code, deux méthodes pour activer la table ronde :

**Par message (recommandé)** : préfixer le prompt avec `[roundtable]`
- `[roundtable]` → table ronde standard (4 modèles + arbitre)
- `[roundtable:quick]` → table ronde rapide (2 modèles)

**Par modèle (permanent)** : `/model roundtable` fait passer TOUTES les
requêtes suivantes en table ronde (y compris outils, continuations, etc.).
À éviter sauf si c'est vraiment voulu. Pour revenir à un modèle normal :
`/model deepseek-v4-pro` (ou autre).

**Mode synthesize** (défaut) : N analystes en parallèle → leurs réponses sont envoyées
à un arbitre qui synthétise.

**Mode debate** : N analystes en parallèle → leurs réponses sont concaténées sans
synthèse.

## Architecture

```
Claude Code → POST /v1/messages → Routeur
                                    │
                        ┌───────────┼───────────┐
                        ▼           ▼           ▼
                   Anthropic     OpenAI       Groq
                   (pass-thru)  (traduction) (traduction)
                   
                   DeepSeek
                   (pass-thru, Anthropic-compatible)
```

### Fichiers clés

| Fichier | Rôle |
|---|---|
| `main.py` | Serveur FastAPI, endpoints, roundtable |
| `router.py` | Logique de choix du modèle |
| `config.yaml` | Providers, modèles, règles de routing, presets roundtable |
| `providers/base.py` | Classe abstraite + factory |
| `providers/anthropic.py` | Pass-through pour APIs Anthropic-compatibles |
| `providers/openai.py` | Traduction Anthropic↔OpenAI |
| `providers/groq.py` | Traduction Anthropic↔OpenAI + spécificités Groq |
| `translate/request.py` | Anthropic Messages → OpenAI Chat Completions |
| `translate/response.py` | OpenAI SSE → Anthropic SSE events |

### Ajouter un provider

1. Ajouter une entrée dans `config.yaml` → `providers.<nom>`
2. Ajouter les modèles dans `config.yaml` → `models`
3. Si le format est déjà supporté (`anthropic` ou `openai`), aucune classe
   supplémentaire n'est nécessaire

### Ajouter un preset de table ronde

Dans `config.yaml` → `roundtables.<nom>` :
```yaml
roundtables:
  mon-preset:
    description: "Ma table ronde personnalisée"
    analysts:
      - "deepseek-v4-pro"
      - "claude-sonnet-5"
    arbitrator: "claude-opus-4-8"
    mode: "synthesize"
```

## Compatibilité de formats

| Provider | Format API | Traduction |
|---|---|---|
| Anthropic | Messages API (natif) | Aucune |
| DeepSeek | Messages API (compatible) | Aucune |
| OpenAI | Chat Completions | Anthropic↔OpenAI |
| Groq | Chat Completions (compatible OpenAI) | Anthropic↔OpenAI |

## Consultation ponctuelle d'un modèle (ex. « ChatGPT ») comme second avis

Certaines tâches (ex. chantiers avec revue croisée obligatoire) demandent de
consulter un modèle précis comme réviseur externe, sans que ça change le
modèle sur lequel tourne la session Claude Code elle-même. Le routeur permet
ça nativement : il suffit de lui envoyer une requête HTTP directe, en dehors
du canal habituel (`ANTHROPIC_BASE_URL`) par lequel Claude Code lui parle.

**Prérequis** : le routeur doit tourner (`curl -s http://127.0.0.1:8787/health`
— si vide/erreur, le démarrer : `cd /workspace/routeur && python3 main.py &`)
et le provider voulu doit apparaître dans la liste `providers` de la réponse
(sinon sa clé API n'est pas configurée dans `routeur/.env`).

**Piège** : `curl` n'est **pas installé** dans le conteneur Claude Code
(`node:22-slim` — vérifié le 10/09/2026, seul le conteneur cible d'un `ssh`
vers la VM OVH a `curl`). Utiliser `python3` + `urllib.request` (stdlib,
toujours disponible) :

```python
import urllib.request, json

body = {
    "model": "gpt-4o",              # importe peu que ce soit le modèle "actif"
    "max_tokens": 4096,
    "system": "...",                # rôle du réviseur, ton attendu
    "messages": [{"role": "user", "content": "..."}],
    "stream": False,                 # plus simple à parser qu'un flux SSE
}
req = urllib.request.Request(
    "http://127.0.0.1:8787/v1/messages",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=180) as r:
    obj = json.loads(r.read().decode())
text = "".join(b["text"] for b in obj["content"] if b["type"] == "text")
```

La réponse est au format Messages API Anthropic même pour un provider
OpenAI/Groq/Mistral (traduction faite par le routeur) — toujours lire
`obj["content"]` (liste de blocs) et `obj["usage"]`, jamais un format
OpenAI brut.

**« ChatGPT »** n'est pas un provider au sens du routeur — le modèle
disponible le plus proche est `gpt-4o` (provider `openai`), le modèle qui
alimente réellement ChatGPT, appelé via l'API OpenAI standard (pas
l'interface web chatgpt.com, pas de mémoire/browsing). Le présenter comme
tel dans toute documentation/log plutôt que d'affirmer avoir consulté
« ChatGPT » sans nuance.

**Usage réel** : chantier DeepSeek du 10/09/2026
(`tra-lab/studies/deepseek-migration-20260910/CHATGPT_EXCHANGES.md`) — revue
d'architecture en 4 tours (dont 2 contestations, une tranchée en faveur de
Claude Code après que `gpt-4o` a concédé une erreur de raisonnement). Chaque
tour : ~1 requête = quelques secondes à ~10s, coût de quelques centimes
(dizaines à basse-centaines de tokens en sortie).

## Limitations connues

- **Tool use avec OpenAI/Groq** : la traduction des tool calls est basique
  (les arguments sont strings, pas streaming parsed). Pour du tool use intensif,
  privilégier les providers Anthropic-compatibles.
- **Thinking/raisonnement** : les blocs `thinking` sont ignorés lors de la
  traduction vers OpenAI (non supporté).
- **Streaming vers non-streaming** : le routeur forwarde le mode demandé par le
  client. Si un provider ne supporte pas le streaming, il faut le désactiver
  dans le provider.
- **Bg jobs Claude Code fragiles sous ce routage** (trouvé 26/11/2026) :
  `main.py` n'a aucune supervision (pas de systemd/supervisor) — un `&` en
  shell interactif ne survit pas à la fin de cette session, ni à un rebuild.
  Si un bg job est créé pendant que `ANTHROPIC_BASE_URL` pointe ici, et que
  le daemon tente de le relancer plus tard alors que (a) le process routeur
  n'écoute plus sur 8787 et/ou (b) `.claude/settings.json` est redevenu la
  config Anthropic native, le job meurt immédiatement avec `No LLM gateway:
  session stopped` (aucun appel modèle envoyé — Claude Code détecte l'absence
  de gateway avant même d'essayer). Vécu avec le job "vdb booking sync"
  (créé 25/11 sous ce routage, mort au redémarrage du 26/11 07:47). Avant de
  lancer un bg job **durable** sous ce routage, s'assurer que le routeur
  tourne d'une façon qui survit à la fermeture du terminal qui l'a lancé —
  sinon réserver ce routage aux sessions interactives ou aux consultations
  ponctuelles (section ci-dessus).
