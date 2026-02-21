export default async function handler(req, res) {
    const topic = req.query.topic;
    const primaryLang = req.query.lang || 'en';

    if (!topic) {
        res.status(400).json({ error: 'Missing parameter "topic"' });
        return;
    }

    try {
        let context = "";
        let sourceUrl = "";
        let sourceTitle = "";

        // 1. ZKUSÍME WIKIPEDII
        const fallbackChain = [primaryLang];
        if (primaryLang !== 'en') fallbackChain.push('en');

        for (const lang of fallbackChain) {
            const wikiSearch = await fetch(
                `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=1`,
                { headers: { 'User-Agent': 'QuickWiki/1.0' } }
            );
            const searchData = await wikiSearch.json();
            
            if (searchData.query?.search?.length > 0) {
                const title = searchData.query.search[0].title;
                const wikiExtract = await fetch(
                    `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(title)}&redirects=1`,
                    { headers: { 'User-Agent': 'QuickWiki/1.0' } }
                );
                const extractData = await wikiExtract.json();
                const pages = extractData.query.pages;
                const pageId = Object.keys(pages)[0];
                const text = pages[pageId].extract;

                if (text && text.length > 200) {
                    context = text.slice(0, 3000);
                    sourceTitle = title;
                    sourceUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
                    break;
                }
            }
        }

        // 2. POKUD WIKI SELŽE, NEBO PRO LEPŠÍ PODLOŽENOST, POUŽIJEME BRAVE SEARCH
        if (!context && process.env.BRAVE_API_KEY) {
            const braveRes = await fetch(
                `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(topic + " definition summary")}&count=3`,
                {
                    headers: { 
                        'Accept': 'application/json',
                        'X-Subscription-Token': process.env.BRAVE_API_KEY 
                    }
                }
            );
            
            if (braveRes.ok) {
                const braveData = await braveRes.json();
                const results = braveData.web?.results || [];
                if (results.length > 0) {
                    context = results.map(r => `${r.title}: ${r.description}`).join("\n\n");
                    sourceTitle = results[0].title;
                    sourceUrl = results[0].url;
                }
            }
        }

        if (!context) {
            res.status(404).json({ error: 'Pojem nebyl nalezen v žádném důvěryhodném zdroji.' });
            return;
        }

        // 3. AI GENERACE (GROQ)
        const langNames = { 'en': 'English', 'cs': 'Czech', 'de': 'German', 'es': 'Spanish' };
        const targetLangName = langNames[primaryLang] || 'English';

        const systemPrompt = `Jsi terminologický expert pro video editory. Tvým úkolem je vysvětlit pojem bleskově a přesně.
        
        Pravidla:
        - Jazyk: ${targetLangName}.
        - LIMIT: Max 25 slov (striktně).
        - FORMÁT: Čistý text v <p>, klíčová slova v <strong>.
        - ZDROJ: Použij výhradně přiložený kontext. Pokud je to Brave Search, syntetizuj nejdůležitější fakta.`;
      
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Pojem: ${topic}\nKontext: ${context}` }
                ],
                temperature: 0.2,
            }),
        });

        const groqData = await groqRes.json();
        const htmlOutput = groqData.choices?.[0]?.message?.content;

        res.status(200).json({ 
            summary: htmlOutput, 
            originalUrl: sourceUrl,
            title: sourceTitle
        });

    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'Chyba při zpracování pojmu.' });
    }
}
