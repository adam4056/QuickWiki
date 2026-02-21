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
        // Prvně zkusíme vyhledat na české, až potom na anglické Wikipedii (zajišťuje nalezení lokálních termínů jako Vojtěch Žižka)
        const fallbackChain = [];
        if (primaryLang !== 'cs') fallbackChain.push(primaryLang);
        fallbackChain.push('cs');
        if (primaryLang !== 'en') fallbackChain.push('en');
        // Příklad pro primaryLang='cs': ['cs', 'en']
        // Příklad pro primaryLang='en': ['en', 'cs']
        // Deduplikace jazyků:
        const uniqueFallbackChain = [...new Set(fallbackChain)];

        for (const lang of uniqueFallbackChain) {
            const wikiSearch = await fetch(
                `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=1`,
                { headers: { 'User-Agent': 'QuickWiki/1.0' } }
            );
            const searchData = await wikiSearch.json();
            
            if (searchData.query?.search?.length > 0) {
                const title = searchData.query.search[0].title;
                const snippet = searchData.query.search[0].snippet;
                
                // Měkké ověření relevance - alespoň část zadaného textu by měla být v názvu článku (či začátku textu).
                // Řeší problém "bottlecap" (vrací Tomaše Mikolova) nebo "Vojta Žižka" (vrací Jana Žižku).
                const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 2); // Filtrujeme spojky atp
                const titleLower = title.toLowerCase();
                
                // Zkontrolujeme, zda alespoň jedno z delších hledaných slov je v titulku 
                const isRelevantTitle = topicWords.length === 0 || topicWords.some(word => titleLower.includes(word));
                
                if (!isRelevantTitle) {
                    // Pokud je titulek úplně irelevantní (ani jedno shoda slova), přeskočíme tento výsledek
                    // Může se jednat o článek, kde je slovo pouze zmíněno hluboko v textu, což u 25slovních definic nechceme
                    // Například: Hledá se "Bottlecap", najde se "Tomáš Mikolov", v názvu shoda není -> přeskočí se na Brave/další jazyk
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
                            parts: [{ text: `Pojem: ${topic}\nKontext: ${context}` }]
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
                            { role: 'user', content: `Pojem: ${topic}\nKontext: ${context}` }
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
