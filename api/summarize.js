export default async function handler(req, res) {
    const topic = req.query.topic;
    const primaryLang = req.query.lang || 'en';

    if (!topic) {
        res.status(400).json({ error: 'Missing parameter "topic"' });
        return;
    }

    try {
        // Multi-language fallback logic: Primary -> English (if not primary) -> Spanish (if not primary/en)
        const fallbackChain = [primaryLang];
        if (primaryLang !== 'en') fallbackChain.push('en');
        if (!fallbackChain.includes('es')) fallbackChain.push('es');

        let bestMatchTitle = null;
        let finalLang = primaryLang;
        let extractText = null;

        for (const lang of fallbackChain) {
            const searchRes = await fetch(
                `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=1`,
                { headers: { 'User-Agent': 'QuickWiki/1.0' } }
            );

            if (!searchRes.ok) continue;
            const searchData = await searchRes.json();
            const results = searchData.query.search;

            if (results && results.length > 0) {
                const title = results[0].title;
                
                // Try to get extract for this title
                const extractRes = await fetch(
                    `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(title)}&redirects=1`,
                    { headers: { 'User-Agent': 'QuickWiki/1.0' } }
                );

                if (extractRes.ok) {
                    const extractData = await extractRes.json();
                    const pages = extractData.query.pages;
                    const pageId = Object.keys(pages)[0];
                    const text = pages[pageId].extract;

                    if (text && text.length > 100) { // Ensure we have actual content
                        bestMatchTitle = title;
                        finalLang = lang;
                        extractText = text;
                        break; // Found it!
                    }
                }
            }
        }

        if (!extractText) {
            res.status(404).json({ error: 'No suitable article found even in fallbacks.' });
            return;
        }

        // 3. Truncate text aggressively to save context/tokens
        const truncatedText = extractText.slice(0, 3000);

        // 4. Groq API call
        const langNames = { 'en': 'English', 'cs': 'Czech', 'de': 'German', 'es': 'Spanish' };
        const targetLangName = langNames[primaryLang] || 'English';

        const systemPrompt = `You are an intelligent knowledge agent. Provide a definition based ONLY on the provided Wikipedia context. 
If the context is in a different language than requested, translate the core facts into ${targetLangName}.

Constraints:
- Respond in ${targetLangName}.
- Max 75 words.
- Format: HTML (<p>, <strong>).
- Use ONLY provided facts. If facts are missing, be honest.`;
      
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
                    { role: 'user', content: `Topic: ${topic}\nContext: ${truncatedText}` }
                ],
                temperature: 0.3,
                max_tokens: 300,
            }),
        });

        if (!groqRes.ok) throw new Error('Groq API Error');

        const groqData = await groqRes.json();
        const htmlOutput = groqData.choices?.[0]?.message?.content;

        const originalUrl = `https://${finalLang}.wikipedia.org/wiki/${encodeURIComponent(bestMatchTitle.replace(/ /g, '_'))}`;
        res.status(200).json({ 
            summary: htmlOutput, 
            originalUrl,
            title: bestMatchTitle,
            sourceLang: finalLang
        });

    } catch (err) {
        res.status(500).json({ error: 'Agent error', detail: err.message });
    }
}

    } catch (err) {
      console.error('Error in summarize API:', err);
      
      // Handle specific error types
      if (err.message.includes('Rate limit')) {
        res.status(429).json({ 
          error: 'Service temporarily overloaded. Please try again in a few seconds.',
          detail: err.message
        });
      } else if (err.message.includes('Wikipedia')) {
        res.status(503).json({ 
          error: 'Wikipedia service temporarily unavailable',
          detail: err.message
        });
      } else if (err.message.includes('Groq API')) {
        res.status(503).json({ 
          error: 'AI summarization service temporarily unavailable',
          detail: err.message
        });
      } else {
        res.status(500).json({ 
          error: 'Internal server error', 
          detail: err.message 
        });
      }
    }
  }
  