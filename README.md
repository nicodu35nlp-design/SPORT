# Carnet — suivi d'entraînement

App perso pour planifier et suivre tes séances (course, vélo, muscu, natation), ton sommeil et ton alimentation, avec dashboard, planning semaine/mois et graphiques de progression. Palette électrique, typographie Rajdhani/Space Mono. Stockage via **Netlify Blobs** (rien à configurer, tout se passe côté Netlify).

## Déployer (méthode recommandée — via GitHub)

1. Crée un repo GitHub (ex: `sport-tracker`) et pousse ce dossier dedans :
   ```bash
   cd sport-tracker
   git init
   git add .
   git commit -m "Premier commit"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/sport-tracker.git
   git push -u origin main
   ```
2. Va sur [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**.
3. Connecte ton compte GitHub, choisis le repo `sport-tracker`.
4. Build settings : laisse tel quel (déjà configuré dans `netlify.toml` : publish = `public`, functions = `netlify/functions`).
5. Clique **Deploy**. Netlify installe automatiquement les dépendances (`@netlify/blobs`) et build les fonctions.
6. Ton appli est en ligne, ajoute-la à l'écran d'accueil de ton iPhone comme d'habitude.

Avantage : à chaque `git push`, Netlify redéploie automatiquement.

## Déployer (méthode rapide — CLI, sans GitHub)

```bash
npm install -g netlify-cli
cd sport-tracker
npm install
netlify login
netlify init          # crée un nouveau site Netlify
netlify deploy --prod
```

## Structure du projet

```
sport-tracker/
├── netlify.toml              # config Netlify (publish + functions)
├── package.json              # dépendance @netlify/blobs
├── seed-plan.mjs              # script pour injecter le plan d'entraînement (76 séances)
├── netlify/functions/
│   ├── workouts.js           # API CRUD séances → /api/workouts
│   ├── sleep.js              # API CRUD sommeil → /api/sleep
│   └── nutrition.js          # API CRUD repas → /api/nutrition
└── public/
    ├── index.html            # structure de l'appli (6 vues)
    ├── style.css             # identité visuelle électrique
    └── app.js                # logique : état, rendu, formulaires, graphiques, calendrier
```

## Fonctionnement

- **Tableau de bord** : compte à rebours vers le marathon (08.11.2026, objectif 3h30), résumé de la semaine par sport, prochaines séances et dernières réalisées.
- **Planning** : vue **Semaine** (colonnes Lun→Dim) et vue **Mois** (calendrier avec pastilles colorées par sport), navigation prev/next/aujourd'hui. Clique un jour vide pour créer une séance à cette date.
- **Journal** : séances réalisées avec distance/durée/allure/FC/ressenti/notes.
- **Progression** : volume hebdomadaire (10 dernières semaines), évolution de l'allure course à pied, records personnels par sport.
- **Sommeil** : heure de coucher/lever (durée calculée automatiquement), qualité 1-5, graphique des 7 dernières nuits.
- **Nourriture** : repas (type, description), hydratation journalière, ressenti énergie.

Pour l'allure, utilise le format `mm:ss` (ex: `4:52`) — c'est ce format qui alimente le graphique de progression.

## Injecter ton plan d'entraînement jusqu'au marathon

Le fichier `seed-plan.mjs` contient **76 séances** générées du 10 août au 8 novembre 2026 (course, vélo, muscu), structurées en 4 phases :

1. **Reprise** (semaines 1-3) — volume très bas, priorité absolue au genou
2. **Base** (semaines 4-7, avec cutback semaine 6) — remontée progressive du volume
3. **Spécifique marathon** (semaines 8-11, avec cutback semaine 9) — sorties longues jusqu'à 30 km, segments à allure marathon (5:00/km)
4. **Affûtage** (semaines 12-13) — réduction du volume, jour J le 8 novembre

Une fois ton site déployé :
```bash
node seed-plan.mjs https://ton-site.netlify.app
```
Ça poste chaque séance vers `/api/workouts`. Tu peux ensuite tout modifier/décaler/supprimer directement dans l'appli (vue Planning) au fil de l'eau — **notamment si le genou ne suit pas** : le plan est volontairement progressif mais reste ambitieux vu ton point de départ, adapte-le sans hésiter.

## Aller plus loin (idées)

- Ajouter l'authentification Netlify Identity si tu veux y accéder depuis plusieurs appareils en toute sécurité (actuellement l'API est ouverte à qui a l'URL — acceptable pour un usage perso mais à garder en tête).
- Ajouter un export CSV des séances réalisées.
- Brancher l'import de données Apple Health (tu as déjà un script Python pour ça).
