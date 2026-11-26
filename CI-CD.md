# JobRadar — déploiement automatique (CI/CD)

À chaque `git push` sur `main` :

```
push JobRadar (Backend/ ou Frontend/)
  → GitHub Actions construit l'image Docker
  → publie ghcr.io/nourlassoued/jobradar-<backend|frontend>:sha-<commit>
  → écrit cette version dans jobradar-gitops (commit « deploy: backend sha-xxxxxxx »)
  → ArgoCD voit le changement et déploie dans le cluster
```

| Fichier | Rôle |
|---|---|
| `.github/workflows/backend-deploy.yml` | Se lance quand `Backend/` change |
| `.github/workflows/frontend-deploy.yml` | Se lance quand `Frontend/` change |
| `.github/workflows/_build-deploy.yml` | Les étapes communes (build, publication, mise à jour GitOps) |

## Réglages à faire une seule fois

1. **Jeton pour écrire dans jobradar-gitops** : GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → *Generate new token* : accès au **seul** dépôt `jobradar-gitops`,
   permission **Contents : Read and write**, expiration 90 jours.
2. **Le donner à JobRadar** : dépôt JobRadar → Settings → Secrets and variables → Actions →
   *New repository secret* : nom `GITOPS_TOKEN`, valeur = le jeton.
3. **Autoriser JobRadar à publier les images** : GitHub → ton profil → Packages → `jobradar-backend` →
   Package settings → *Manage Actions access* → ajouter le dépôt JobRadar avec le rôle **Write**.
   Pareil pour `jobradar-frontend`.

## Version

`sha-1a2b3c4` = les 7 premiers caractères du commit JobRadar : on sait toujours quel code tourne dans le cluster.
Jamais `latest` (on ne saurait pas quelle version est déployée, et on ne pourrait pas revenir en arrière).

## Revenir en arrière

Un `git revert` du commit « deploy: … » dans `jobradar-gitops` : ArgoCD remet l'ancienne image
(c'est exactement ce que fait OpsPilot quand il répare une panne).
