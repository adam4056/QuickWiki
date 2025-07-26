export default async function handler(req, res) {
    const tema = req.query.tema;
    const delka = parseInt(req.query.delka) || 3;
  
    if (!tema) {
      res.status(400).json({ error: 'Chybí parametr "tema"' });
      return;
    }
  
    try {
      // 1. MediaWiki Search API (méně náchylné na blokování)
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(tema)}&format=json`,
        {
          headers: {
            'User-Agent': 'MyWikiSummarizerBot/1.0 (your-email@example.com)',
            'Accept': 'application/json',
          }
        }
      );
  
      if (!searchRes.ok) {
        const text = await searchRes.text();
        throw new Error(`Wikipedia search API error, status: ${searchRes.status}, body: ${text}`);
      }
  
      const searchData = await searchRes.json();
      const searchResults = searchData.query.search;
  
      if (!searchResults || searchResults.length === 0) {
        res.status(404).json({ error: 'Nenalezen vhodný článek.' });
        return;
      }
  
      const bestMatchTitle = searchResults[0].title;
  
      // 2. Získání extractu článku (plain text)
      const extractRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(bestMatchTitle)}&redirects=1`,
        {
          headers: {
            'User-Agent': 'MyWikiSummarizerBot/1.0 (your-email@example.com)',
            'Accept': 'application/json',
          }
        }
      );
  
      if (!extractRes.ok) {
        const text = await extractRes.text();
        throw new Error(`Wikipedia extract API error, status: ${extractRes.status}, body: ${text}`);
      }
  
      const extractData = await extractRes.json();
      const pages = extractData.query.pages;
      const pageId = Object.keys(pages)[0];
      const extractText = pages[pageId].extract;
  
      if (!extractText) {
        res.status(500).json({ error: 'Nepodařilo se načíst text článku z Wikipedie.' });
        return;
      }
  
      // 3. Groq API volání (shrnutí)
      const prompt = `
  Jsi AI sumarizátor. Shrň následující text do ${delka} vět. Použij čisté HTML bez <html> nebo <body> tagů. Text je z Wikipedie.
  
  Text:
  ${extractText}
      `;
  
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
  
      if (!groqRes.ok) {
        const errText = await groqRes.text();
        throw new Error(`Groq API error: ${groqRes.status} ${errText}`);
      }
  
      const groqData = await groqRes.json();
      const htmlOutput = groqData.choices?.[0]?.message?.content;
  
      if (!htmlOutput) {
        res.status(500).json({ error: 'Groq API nevrátilo odpověď.' });
        return;
      }
  
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(htmlOutput);
  
    } catch (err) {
      console.error('Chyba:', err);
      res.status(500).json({ error: 'Interní chyba serveru', detail: err.message });
    }
  }
  