# Déploiement IRISSAM sur VPS avec Dokploy (Voie B — conteneur unique)

## Architecture

```
Internet → Traefik (Dokploy) → app:3001
                                  ├── GET /           → ERP React SPA
                                  ├── GET /patient-portal/ → Patient Portal SPA
                                  └── GET /api/*      → Express API + PostgreSQL
```

Un seul conteneur Docker sert les deux frontends React (compilés en assets statiques lors du build) et l'API Express. Traefik gère le TLS et le reverse-proxy.

---

## Configuration Dokploy

### Champs Dokploy

| Champ | Valeur |
|---|---|
| **Build type** | Dockerfile |
| **Dockerfile path** | `artifacts/api-server/Dockerfile` |
| **Docker build context** | `.` (racine du dépôt) |
| **Container port** | `3001` |

### Variables d'environnement requises

Copier `.env.production.example` en `.env` et remplir toutes les valeurs.

| Variable | Description |
|---|---|
| `POSTGRES_DB` | Nom de la base (défaut : `irissam`) |
| `POSTGRES_USER` | Utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | ⚠️ Mot de passe fort (obligatoire) |
| `DATABASE_URL` | `postgresql://USER:PASS@HOST:5432/DB` |
| `SESSION_SECRET` | 64 octets aléatoires en hex |
| `JWT_SECRET` | 64 octets aléatoires en hex |
| `JWT_REFRESH_SECRET` | 64 octets aléatoires en hex |
| `PORT` | `3001` (port interne du conteneur) |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | URL publique de votre VPS, ex: `https://erp.votre-hopital.dz` |
| `LOG_LEVEL` | `info` (ou `debug` pour déboguer) |

#### Stockage fichiers (volumes Docker)

| Variable | Valeur dans le conteneur |
|---|---|
| `STORAGE_PROVIDER` | `local` |
| `LOCAL_STORAGE_ROOT` | `/app/storage` |
| `DOCUMENTS_DIR` | `/app/storage/documents` |
| `UPLOADS_DIR` | `/app/storage/uploads` |
| `PDF_DIR` | `/app/storage/pdfs` |
| `BACKUP_DIR` | `/app/storage/backups` |
| `MAX_DOC_FILE_SIZE` | `52428800` (50 Mo) |

#### Générer des secrets sécurisés

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Volumes persistants

Créer les répertoires sur le VPS **avant** le premier démarrage :

```bash
sudo mkdir -p /data/irissam/{uploads,documents,pdfs,backups,postgres}
# node uid = 1000 dans node:22-alpine
sudo chown -R 1000:1000 /data/irissam/uploads \
                         /data/irissam/documents \
                         /data/irissam/pdfs \
                         /data/irissam/backups
# postgres uid = 999
sudo chown -R 999:999 /data/irissam/postgres
```

Mapper ces répertoires dans Dokploy (onglet **Volumes**) :

| Chemin hôte | Chemin conteneur |
|---|---|
| `/data/irissam/uploads` | `/app/storage/uploads` |
| `/data/irissam/documents` | `/app/storage/documents` |
| `/data/irissam/pdfs` | `/app/storage/pdfs` |
| `/data/irissam/backups` | `/app/storage/backups` |

---

## Labels Traefik (Dokploy les génère automatiquement)

Si vous gérez Traefik manuellement, voici un exemple :

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.irissam.rule=Host(`erp.votre-hopital.dz`)"
  - "traefik.http.routers.irissam.entrypoints=websecure"
  - "traefik.http.routers.irissam.tls.certresolver=letsencrypt"
  - "traefik.http.services.irissam.loadbalancer.server.port=3001"
```

---

## Smoke test post-déploiement

Remplacer `https://erp.votre-hopital.dz` par votre domaine réel :

```bash
# 1. ERP principal
curl -s -o /dev/null -w "%{http_code}" https://erp.votre-hopital.dz/
# Attendu : 200

# 2. Portail patient
curl -s -o /dev/null -w "%{http_code}" https://erp.votre-hopital.dz/patient-portal/
# Attendu : 200

# 3. API santé
curl -s https://erp.votre-hopital.dz/api/healthz
# Attendu : {"status":"ok"} (ou {"status":"migrating"} au premier démarrage)

# 4. Route React profonde (SPA fallback)
curl -s -o /dev/null -w "%{http_code}" https://erp.votre-hopital.dz/admissions
# Attendu : 200

# 5. Route profonde portail
curl -s -o /dev/null -w "%{http_code}" https://erp.votre-hopital.dz/patient-portal/appointments
# Attendu : 200
```

---

## Déploiement via docker-compose (sans Dokploy)

Pour un déploiement manuel avec `docker compose` :

```bash
# Copier et remplir les variables
cp .env.production.example .env
nano .env

# Construire et démarrer
docker compose -f docker-compose.single.yml up -d --build

# Vérifier les logs
docker compose -f docker-compose.single.yml logs -f app
```

---

## Mise à jour

```bash
# Tirer le nouveau code
git pull

# Reconstruire sans interruption (Dokploy le fait automatiquement)
docker compose -f docker-compose.single.yml up -d --build app

# Vérifier la santé
docker compose -f docker-compose.single.yml ps
```

---

## Sauvegarde PostgreSQL

Le script `scripts/backup.sh` effectue un `pg_dump` et archive les fichiers de stockage local :

```bash
# Depuis le VPS
PGHOST=localhost PGPORT=5432 PGUSER=irissam PGPASSWORD=xxx \
  BACKUP_ROOT=/data/irissam/backups RETENTION_DAYS=30 \
  bash scripts/backup.sh
```

Planifier via cron (quotidien à 2h) :

```cron
0 2 * * * bash /chemin/vers/scripts/backup.sh >> /var/log/irissam-backup.log 2>&1
```

---

## Dépannage

### L'application répond 503 au démarrage

C'est normal : les migrations PostgreSQL s'exécutent en arrière-plan. Attendre 30–60 secondes et réessayer. Le endpoint `/api/healthz` retourne `{"status":"migrating"}` pendant cette phase.

### `GET /` retourne 404

Vérifier que le build Docker a bien inclus les assets statiques :

```bash
docker exec <container_id> ls /workspace/public/erp/
# Doit afficher : assets/ favicon.svg index.html ...
```

Si le répertoire est vide, le build Docker a échoué silencieusement. Consulter les logs de build Dokploy.

### Variables d'environnement manquantes

```bash
docker exec <container_id> env | grep -E "DATABASE_URL|JWT_SECRET|PORT"
```
