## QuickWiki

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1.11-38B2AC)

A simple web app that delivers lightning-fast 25-word AI definitions of any term, aimed at podcasters and editors. The frontend is static (in `public/`), styles are built with Tailwind CSS, and the backend endpoint runs on Vercel in `api/summarize.js`.

### Features
- Searches Wikipedia and selects the best matching article via relevance scoring
- Falls back to Brave Search when Wikipedia has no good match
- Generates a 25-word AI definition via OpenRouter (`nvidia/nemotron-3-ultra-550b-a55b:free`)
- **Automatic language detection** of the query — the answer is returned in the language of the query
- UI language switcher (EN / CS / DE / ES) with browser-based auto-detection
- Local cache and recent-terms history (localStorage only, no server storage)
- Apple-inspired UI with dark mode, reduced-motion support, and keyboard navigation
- PWA-ready (manifest, theme-color, favicon, apple-touch-icon)

### Requirements
- Node.js 18+
- Vercel account (for deployment)
- `OPENROUTER_API_KEY` environment variable (required)
- `BRAVE_API_KEY` environment variable (optional, enables Brave fallback)

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

Set the environment variables before running:
```bash
export OPENROUTER_API_KEY="<your_openrouter_key>"
export BRAVE_API_KEY="<your_brave_key>"   # optional
```

### API
- `GET /api/summarize?topic=<query>&lang=<ui_lang>`
  - `topic` (required): term to define
  - `lang` (optional): UI language hint, one of `en`, `cs`, `de`, `es` (default `en`)
  - The response language is determined automatically from the query text, independent of `lang`.

Example (with Vercel or `vercel dev` running):
```bash
curl "http://localhost:3000/api/summarize?topic=Ada%20Lovelace&lang=en"
```

Response:
```json
{
  "summary": "<p><strong>Ada Lovelace</strong> is ...</p>",
  "originalUrl": "https://en.wikipedia.org/wiki/Ada_Lovelace",
  "title": "Ada Lovelace",
  "detectedLang": "en"
}
```

### Environment variables
| Variable | Required | Description |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | OpenRouter API key (used for the AI model) |
| `BRAVE_API_KEY` | no | Brave Search API key (fallback source) |

### License
Licensed under the [MIT License](LICENSE)
