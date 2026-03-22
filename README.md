# Smart Calendar Gemini

Extension **Raycast** (macOS) qui crée des événements dans l’app **Calendrier** à partir d’un **texte** et/ou d’une **image** (billet, capture, mail…), en s’appuyant sur **Google Gemini** (modèle Flash) pour extraire titre, date, heure, durée, lieu et catégorie.

## Prérequis

- macOS avec **Raycast**
- Une **clé API** [Google AI Studio](https://aistudio.google.com) (Gemini)
- Des **calendriers** dans l’app Calendrier dont les **noms correspondent exactement** aux catégories utilisées par l’extension (voir ci‑dessous)
- **Raycast** autorisé dans Réglages système → Confidentialité et sécurité → **Calendrier**

## Installation (usage local)

```bash
git clone https://github.com/<ton-compte>/smart-calendar-gemini.git
cd smart-calendar-gemini
npm install
npm run build
```

Dans Raycast : **Réglages → Extensions → Importer une extension** et sélectionne ce dossier (celui qui contient `package.json`).

Pour le développement avec rechargement automatique :

```bash
npm run dev
```

## Configuration

1. Ouvre les **préférences** de l’extension dans Raycast.
2. Colle ta **clé API Gemini** (champ sécurisé).

## Calendriers cibles (noms exacts)

L’IA choisit une catégorie ; l’extension crée l’événement dans le calendrier **du même nom**. Crée donc ces calendriers dans l’app Calendrier si besoin :

| Catégorie |
|-----------|
| Travail / Études |
| Loisir / Social |
| Sport / Santé |
| Administratif |
| Nous |
| Vacances |
| Personnel Important |
| Projets persos / Création |

## Commande Raycast

- **Titre affiché** : *Create Calendar Event with AI* (contrainte [Title Case](https://developers.raycast.com/) du linter Raycast).
- **Recherche** : tu peux taper par exemple `calendrier`, `événement`, `gemini`, `ia`, `billet`, `rdv` (mots-clés configurés dans le manifeste).

## Scripts npm

| Script | Rôle |
|--------|------|
| `npm run dev` | Mode développement Raycast |
| `npm run build` | Build production (`dist/`) |
| `npm run lint` | ESLint + Prettier + validation manifeste |
| `npm run publish` | Publication vers le Raycast Store (après compte auteur) |

## Stack technique

- TypeScript strict, React, `@raycast/api`, `@raycast/utils` (AppleScript / JXA pour Calendrier)
- `@google/generative-ai` (Gemini)

## Licence

MIT — voir [LICENSE](LICENSE).

## Publier sur GitHub

Si le dépôt n’existe pas encore :

```bash
git init
git add .
git commit -m "Initial commit: Smart Calendar Gemini Raycast extension"
gh repo create smart-calendar-gemini --public --source=. --remote=origin --push
```

Sans GitHub CLI, crée un dépôt vide sur github.com puis :

```bash
git remote add origin https://github.com/<ton-compte>/smart-calendar-gemini.git
git branch -M main
git push -u origin main
```

**Ne commite pas** `node_modules/` ni `dist/` (déjà dans `.gitignore`).
