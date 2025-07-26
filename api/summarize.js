export default async function handler(req, res) {
    const tema = req.query.tema;
    const delka = parseInt(req.query.delka) || 3;
  
    if (!tema) {
      res.status(400).json({ error: 'Chybí parametr "tema"' });
      return;
    }
  
    try {
      // 1. Wikipedia Search API
      const searchResponse = await fetch(
        `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(tema)}&limit=5`
      );
  
      if (!searchResponse.ok) {
        const text = await searchResponse.text();
        throw new Error(`Wikipedia search API error, status: ${searchResponse.status}, body: ${text}`);
      }
  
      const searchData = await searchResponse.json();
  
      const validPage = searchData.pages.find(
        (page) =>
          page.description &&
          !/disambiguation|Topics referred to by the same term/i.test(page.description)
      );
  
      if (!validPage) {
        res.status(404).json({ error: 'Nenalezen vhodný článek (není disambiguace).' });
        return;
      }
  
      const bestMatchTitle = validPage.key;
  
      // 2. Wikipedia Extracts API
      const extractResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(bestMatchTitle)}&redirects=1`
      );
  
      if (!extractResponse.ok) {
        const text = await extractResponse.text();
        throw new Error(`Wikipedia extract API error, status: ${extractResponse.status}, body: ${text}`);
      }
  
      const extractData = await extractResponse.json();
  
      const pages = extractData.query.pages;
      const pageId = Object.keys(pages)[0];
      const extractText = pages[pageId].extract;
  
      if (!extractText) {
        res.status(500).json({ error: 'Nepodařilo se načíst text článku z Wikipedie.' });
        return;
      }
  
      // 3. Groq API
      const prompt = `
  Jsi AI sumarizátor. Shrň následující text do ${delka} vět. Použij čisté HTML bez <html> nebo <body> tagů. Text je z Wikipedie.
  
  Text:
  ${extractText}
      `;
  
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
  
      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        throw new Error(`Groq API error: ${groqResponse.status} ${errText}`);
      }
  
      const groqData = await groqResponse.json();
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
  