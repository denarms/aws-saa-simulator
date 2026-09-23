# AWS SAA-C03 Exam Simulator

Simulador de examen para AWS Certified Solutions Architect - Associate (SAA-C03), con modo práctica y modo examen, explicaciones y soporte de idiomas Inglés/Español/Mix.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) that builds the static frontend with Vite and publishes it to GitHub Pages on every push to `main`.

To enable it on your repo:
1. Push this repo to GitHub.
2. In the repo settings, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the Actions tab) — the site will be published at `https://<your-username>.github.io/<repo-name>/`.

This is a static build: the AI-assisted features (Gemini-based explanations, translation and question generation) that depended on a Node/Express backend are not included, since GitHub Pages only serves static files.
