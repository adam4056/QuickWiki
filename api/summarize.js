const WIKIPEDIA_USER_AGENT = 'QuickWiki/1.0 (https://github.com/adam4056/QuickWiki; contact: adam@example.com)';
const OPENROUTER_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const FETCH_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return { promise: promise(controller.signal), controller, timer };
}

function clearTimeoutSafe(timer) {
    if (timer) clearTimeout(timer);
}

// Detekce jazyka dotazu na základě Unicode znaků, diakritiky a klíčových slov.
// Vrací kód jazyka ('cs','de','es','en') nebo 'en' jako fallback.
function detectQueryLanguage(text) {
    const lower = (text || '').toLowerCase().trim();
    if (!lower) return 'en';

    // 1) Klíčová slova a fráze (fungují i bez diakritiky).
    const phraseTests = [
        { lang: 'cs', re: /\b(co je|kdo je|kde je|kdy|proč|jak[ýýě]|jak se|kolik|jaká|jaký)\b/ },
        { lang: 'de', re: /\b(was ist|wer ist|wo ist|warum|wieso|wie funktioniert|wann|wohin|erklärung)\b/ },
        { lang: 'es', re: /\b(qué es|quién es|dónde|cuándo|por qué|cómo|cuál|explicación|definición)\b/ }
    ];
    for (const t of phraseTests) {
        if (t.re.test(lower)) return t.lang;
    }

    // 2) Diakritika a specifické znaky.
    if (/[áčďéěíňóřšťúůýž]/i.test(lower)) return 'cs';
    if (/[ĺľôŕäöüß]/i.test(lower)) return 'de';
    if (/[ñçáéíóúü]/i.test(lower)) return 'es';

    // 3) Azbuka a další písma -> fallback en (model si poradí).
    return 'en';
}

// Bodování relevance názvu článku vůbec dotazu pomocí překryvu slov a snippetu.
function scoreRelevance(query, title, snippet) {
    const q = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const t = title.toLowerCase();
    const s = (snippet || '').toLowerCase();
    if (q.length === 0) return 1;
    let score = 0;
    for (const word of q) {
        if (t.includes(word)) score += 2;
        else if (s.includes(word)) score += 1;
    }
    return score / (q.length * 2);
}

export default async function handler(req, res) {
    const topic = req.query.topic;
    const uiLang = req.query.lang || 'en';

    if (!topic) {
        res.status(400).json({ error: 'Missing parameter "topic"' });
        return;
    }

    // Autodetekce jazyka dotazu (nezávisle na UI jazyku).
    const detectedLang = detectQueryLanguage(topic);

    // Pokud API klíč chybí, vrať bezpečnou generickou chybu (bez leaku internals).
    if (!process.env.OPENROUTER_API_KEY) {
        console.error('OPENROUTER_API_KEY is not set in environment.');
        res.status(500).json({ error: 'Server is not properly configured.' });
        return;
    }

    try {
        let wikiContext = '';
        let wikiSourceUrl = '';
        let wikiSourceTitle = '';

        let braveContext = '';
        let braveSourceUrl = '';
        let braveSourceTitle = '';

        // 1. WIKIPEDIA - preferovaný zdroj.
        const fetchWiki = async () => {
            // Pořadí jazyků: detekovaný jazyk dotazu, UI jazyk, pak cs a en.
            const chain = [detectedLang, uiLang, 'cs', 'en'];
            const seen = new Set();
            const uniqueChain = chain.filter(l => {
                if (seen.has(l)) return false;
                seen.add(l);
                return true;
            });

            for (const lang of uniqueChain) {
                try {
                    const { promise, controller, timer } = withTimeout((signal) => fetch(
                        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=1`,
                        { headers: { 'User-Agent': WIKIPEDIA_USER_AGENT }, signal }
                    ), FETCH_TIMEOUT_MS);

                    let searchData;
                    try {
                        const wikiSearch = await promise;
                        searchData = await wikiSearch.json();
                    } finally {
                        clearTimeoutSafe(timer);
                    }

                    const hit = searchData.query?.search?.[0];
                    if (!hit) continue;

                    const title = hit.title;
                    const snippet = hit.snippet || '';
                    const relevance = scoreRelevance(topic, title, snippet);
                    // Relevance threshold - pokud je příliš nízká, zkus další jazyk.
                    if (relevance < 0.2) continue;

                    const { promise: extractPromise, controller: extractCtrl, timer: extractTimer } = withTimeout((signal) => fetch(
                        `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exchars=1200&format=json&titles=${encodeURIComponent(title)}&redirects=1`,
                        { headers: { 'User-Agent': WIKIPEDIA_USER_AGENT }, signal }
                    ), FETCH_TIMEOUT_MS);

                    let extractData;
                    try {
                        const wikiExtract = await extractPromise;
                        extractData = await wikiExtract.json();
                    } finally {
                        clearTimeoutSafe(extractTimer);
                    }

                    const pages = extractData.query?.pages;
                    const pageId = pages ? Object.keys(pages)[0] : null;
                    const text = pageId ? pages[pageId].extract : '';

                    if (text && text.length > 200) {
                        wikiContext = text.trim();
                        wikiSourceTitle = title;
                        wikiSourceUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
                        break;
                    }
                } catch (e) {
                    if (e.name === 'AbortError') {
                        console.warn(`Wiki fetch timed out for lang ${lang}`);
                    } else {
                        console.error(`Wiki fetch error for lang ${lang}:`, e);
                    }
                }
            }
        };

        // 2. BRAVE - fallback, volá se pouze když Wikipedia nic nedala.
        const fetchBrave = async () => {
            if (!process.env.BRAVE_API_KEY) return;
            try {
                const { promise, controller, timer } = withTimeout((signal) => fetch(
                    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(topic)}&count=3`,
                    {
                        headers: {
                            'Accept': 'application/json',
                            'X-Subscription-Token': process.env.BRAVE_API_KEY
                        },
                        signal
                    }
                ), FETCH_TIMEOUT_MS);

                let braveData;
                try {
                    const braveRes = await promise;
                    if (!braveRes.ok) return;
                    braveData = await braveRes.json();
                } finally {
                    clearTimeoutSafe(timer);
                }

                const results = braveData.web?.results || [];
                if (results.length > 0) {
                    braveContext = results.map(r => `${r.title}: ${r.description}`).join('\n\n');
                    braveSourceTitle = results[0].title;
                    braveSourceUrl = results[0].url;
                }
            } catch (e) {
                if (e.name === 'AbortError') {
                    console.warn('Brave fetch timed out');
                } else {
                    console.error('Brave fetch error:', e);
                }
            }
        };

        // Nejdříve Wikipedia. Až když nic nenajde, zkus Brave.
        await fetchWiki();
        if (!wikiContext) {
            await fetchBrave();
        }

        let combinedContext = '';
        if (wikiContext) combinedContext += `[WIKIPEDIA]:\n${wikiContext}\n\n`;
        if (braveContext) combinedContext += `[WEB SEARCH]:\n${braveContext}\n\n`;

        if (!combinedContext) {
            res.status(404).json({ error: 'Term not found in any trusted source.' });
            return;
        }

        // Preferuj wiki jako hlavní zdroj, Brave jako doplněk pro aktuálnost.
        const sourceUrl = wikiSourceUrl || braveSourceUrl;
        const sourceTitle = wikiSourceTitle || braveSourceTitle;

        // 3. AI GENERACE přes OpenRouter.
        const langNames = { 'en': 'English', 'cs': 'Czech', 'de': 'German', 'es': 'Spanish' };
        // Jazyk odpovědi = jazyk dotazu (autodetekce), ne UI jazyk.
        const responseLangName = langNames[detectedLang] || 'the same language as the query';

        const systemPrompt = `You are an encyclopedic assistant. Explain the given term from context accurately and meaningfully.
- Output language: ${responseLangName}. If the user query is in another language, answer in THAT language.
- Length: Max 25 words!
- Format: <p><strong>Term</strong> is...</p>
- Do not copy SEO headlines. Write a fluent, original definition.
- Source priority: use [WIKIPEDIA] first, supplement with [WEB SEARCH] for current facts.`;

        let htmlOutput = null;

        try {
            const { promise, controller, timer } = withTimeout((signal) => fetch(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://quickwiki.app',
                        'X-Title': 'QuickWiki'
                    },
                    body: JSON.stringify({
                        model: OPENROUTER_MODEL,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: `Term: ${topic}\nContext:\n${combinedContext}` }
                        ],
                        temperature: 0.2
                    }),
                    signal
                }
            ), FETCH_TIMEOUT_MS * 2);

            let groqData;
            try {
                const groqRes = await promise;
                if (!groqRes.ok) {
                    console.error('OpenRouter API HTTP error:', groqRes.status, groqRes.statusText);
                    throw new Error('AI provider error');
                }
                groqData = await groqRes.json();
            } finally {
                clearTimeoutSafe(timer);
            }

            htmlOutput = groqData.choices?.[0]?.message?.content;
        } catch (apiError) {
            if (apiError.name === 'AbortError') {
                console.error('OpenRouter API timed out');
            } else {
                console.error('AI API Error:', apiError);
            }
            // Generická hláška klientovi, detail zůstává v logu.
            res.status(500).json({ error: 'Could not generate a definition. Try again later.' });
            return;
        }

        if (!htmlOutput) {
            res.status(500).json({ error: 'Could not generate a definition. Try again later.' });
            return;
        }

        res.status(200).json({
            summary: htmlOutput,
            originalUrl: sourceUrl,
            title: sourceTitle,
            detectedLang
        });

    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'An error occurred while processing the term.' });
    }
}
