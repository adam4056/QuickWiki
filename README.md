## QuickWiki

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1.11-38B2AC)

A simple web app that quickly summarizes Wikipedia articles using AI. The frontend is static (in `public/`), styles are built with Tailwind CSS, and the backend endpoint runs on Vercel in `api/summarize.js`.

### Features
- Searches Wikipedia and selects the best matching article
- Fetches a clean plaintext extract of the article
- Generates a short AI summary (configurable number of sentences)

### Requirements
- Node.js 18+
- Vercel account (for deployment)
- Groq API key in environment variable `GROQ_API_KEY`

### Installation
```bash
npm install
```

### CSS build (Tailwind)
- One-off build:
```bash
npm run build:css
```
- Watch during development:
```bash
npm run build:css:watch
```
- Minified build:
```bash
npm run build:css:minify
```

Input: `src/input.css`
Output: `public/output.css`

### Local development
The frontend is static. Open `public/index.html` in your browser after generating `public/output.css`. To serve locally you can use, for example:
```bash
npx serve public
```

The API endpoint is designed for Vercel (`/api/summarize`). To run locally with Vercel CLI:
```bash
npx vercel dev
```

Remember to set the environment variable:
```bash
export GROQ_API_KEY="<your_key>"
```

### API
- `GET /api/summarize?topic=<query>&length=<sentence_count>`
  - `topic` (required): article/topic name on Wikipedia
  - `length` (optional): number of sentences in the summary (default 3)

Example (with Vercel or `vercel dev` running):
```bash
curl "http://localhost:3000/api/summarize?topic=Ada%20Lovelace&length=3"
```

### License
Licensed under the [MIT License](LICENSE)



