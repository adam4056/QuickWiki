export default async function handler(req, res) {
    const topic = req.query.topic;
    const primaryLang = req.query.lang || 'en';

    if (!topic) {
        res.status(400).json({ error: 'Missing parameter "topic"' });
        return;
    }

    try {
        let wikiContext = "";
        let wikiSourceUrl = "";
        let wikiSourceTitle = "";

        let braveContext = "";
        let braveSourceUrl = "";
        let braveSourceTitle = "";

        // 1. ZKUSÍME WIKIPEDII (Spustíme asynchronně)
        const fetchWiki = async () => {
            const fallbackChain = [];
            if (primaryLang !== 'cs') fallbackChain.push(primaryLang);
            fallbackChain.push('cs');
            if (primaryLang !== 'en') fallbackChain.push('en');
            const uniqueFallbackChain = [...new Set(fallbackChain)];

            for (const lang of uniqueFallbackChain) {
                try {
                    const wikiSearch = await fetch(
                        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=1`,
                        { headers: { 'User-Agent': 'QuickWiki/1.0' } }
                    );
                    const searchData = await wikiSearch.json();
                    
                    if (searchData.query?.search?.length > 0) {
                        const title = searchData.query.search[0].title;
                        
                        const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                        const titleLower = title.toLowerCase();
                        
                        const isRelevantTitle = topicWords.length === 0 || topicWords.some(word => titleLower.includes(word));
                        
                        if (!isRelevantTitle) {
                            continue;
                        }

                        const wikiExtract = await fetch(
                            `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(title)}&redirects=1`,
                            { headers: { 'User-Agent': 'QuickWiki/1.0' } }
                        );
                        const extractData = await wikiExtract.json();
                        const pages = extractData.query.pages;
                        const pageId = Object.keys(pages)[0];
                        const text = pages[pageId].extract;

                        if (text && text.length > 200) {
                            wikiContext = text.slice(0, 3000);
                            wikiSourceTitle = title;
                            wikiSourceUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
                            break;
                        }
                    }
                } catch (e) {
                    console.error(`Wiki fetch error for lang ${lang}:`, e);
                }
            }
        };

        // 2. SOUBĚŽNĚ ZKUSÍME BRAVE SEARCH (Není to už fallback, ale rovnocenný zdroj)
        const fetchBrave = async () => {
            if (process.env.BRAVE_API_KEY) {
                try {
                    const braveRes = await fetch(
                        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(topic)}&count=4`,
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
                            // Vezmeme obsah z více relevantních stránek a spojíme ho
                            braveContext = results.map(r => `${r.title}: ${r.description}`).join("\n\n");
                            braveSourceTitle = results[0].title;
                            braveSourceUrl = results[0].url;
                        }
                    }
                } catch (e) {
                    console.error('Brave fetch error:', e);
                }
            }
        };

        // Spustíme obě vyhledávání paralelně pro maximální rychlost
        await Promise.allSettled([fetchWiki(), fetchBrave()]);

        // Spojíme kontext z obou zdrojů, aby měla AI maximální přehled
        let combinedContext = "";
        if (wikiContext) combinedContext += `[ENCYKLOPEDIE WIKIPEDIE]:\n${wikiContext}\n\n`;
        if (braveContext) combinedContext += `[AKTUÁLNÍ WEB SEARCH]:\n${braveContext}\n\n`;

        if (!combinedContext) {
            res.status(404).json({ error: 'Pojem nebyl nalezen v žádném důvěryhodném zdroji (Wiki ani Web).' });
            return;
        }

        // Určení hlavního zdroje pro zobrazení bublinky v UI. 
        // Preferujeme Wiki, pokud něco našla, jinak dáme první odkaz z Webu (což bude např. web dané firmy)
        const sourceUrl = wikiSourceUrl || braveSourceUrl;
        const sourceTitle = wikiSourceTitle || braveSourceTitle;

        // 3. AI GENERACE (GROQ / GEMINI)
        const langNames = { 'en': 'English', 'cs': 'Czech', 'de': 'German', 'es': 'Spanish' };
        const targetLangName = langNames[primaryLang] || 'English';

        const systemPrompt = `Jsi profesionální encyklopedický asistent. Tvým úkolem je vysvětlit zadaný pojem stručně, bleskově a přesně.
        
        Pravidla:
        - Jazyk: ${targetLangName}.
        - LIMIT: Maximálně 25 slov (striktně).
        - FORMÁT: Čistý text obalený v <p>, hlavní název pojmu dej do <strong>.
        - STYL: VŽDY piš plynulou a smysluplnou definici ve formě celé věty (např. "<strong>Pojem</strong> je společnost/nástroj/osoba, která..."). 
        - ZÁKAZ: Nikdy nesmíš pouze zkopírovat nesouvislé útržky textu nebo SEO titulky z vyhledávače. Musíš to přepsat do vlastní lidské definice.
        - ZDROJ: K pochopení pojmu využij přiložený kontext. Syntetizuj z něj to nejdůležitější.`;
      
        let htmlOutput = null;

        let useGemini = false;
        const specialKey = req.query.special_key || req.query.backup_key || req.query.key;
        const expectedKey = process.env.SPECIAL_KEY || process.env.BACKUP_KEY;
        let geminiApiKey = process.env.GEMINI_API_KEY;

        if (specialKey) {
            if (expectedKey) {
                // Pokud je definováno tajné heslo v env proměnných, kontrolujeme vůči němu
                useGemini = (specialKey === expectedKey);
            } else {
                // Pokud server nemá tajné heslo nastaveno, považujeme zadaný klíč za přímý Gemini API klíč
                useGemini = true;
                geminiApiKey = specialKey;
            }
        }

        try {
            if (useGemini) {
                if (!geminiApiKey) {
                    throw new Error('GEMINI_API_KEY není k dispozici.');
                }

                const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash-preview:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: systemPrompt }]
                        },
                        contents: [{
                            role: 'user',
                            parts: [{ text: `Pojem: ${topic}\nKontext:\n${combinedContext}` }]
                        }],
                        generationConfig: {
                            temperature: 0.2
                        }
                    })
                });

                if (!geminiRes.ok) {
                    throw new Error(`Gemini API error: ${geminiRes.statusText}`);
                }

                const geminiData = await geminiRes.json();
                htmlOutput = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            } else {
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
                            { role: 'user', content: `Pojem: ${topic}\nKontext:\n${combinedContext}` }
                        ],
                        temperature: 0.2,
                    }),
                });

                if (!groqRes.ok) {
                    throw new Error(`Groq API error: ${groqRes.statusText}`);
                }

                const groqData = await groqRes.json();
                htmlOutput = groqData.choices?.[0]?.message?.content;
            }
        } catch (apiError) {
            console.error('AI API Error:', apiError);
            res.status(500).json({ error: 'Chyba při komunikaci s AI modelem.' });
            return;
        }

        if (!htmlOutput) {
            res.status(500).json({ error: 'Nepodařilo se vygenerovat výsledek z žádného modelu.' });
            return;
        }

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
