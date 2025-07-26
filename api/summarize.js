const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

  const tema = req.query.tema;
  const delka = parseInt(req.query.delka) || 3;

  if (!tema) {
    return res.status(400).json({ error: 'Chybí parametr "tema"' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Není nastaven GROQ_API_KEY' });
  }

  try {
    if (DEBUG_MODE) console.log('DEBUG: Začínám zpracovávat požadavek');

    // 1. Wikipedia search API
    if (DEBUG_MODE) console.log(`DEBUG: Hledám článek pro téma: ${tema}`);
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(tema)}&limit=5`
    );
    const searchData = await searchRes.json();

    if (DEBUG_MODE) console.log('DEBUG: Výsledek Wikipedia search:', JSON.stringify(searchData, null, 2));

    const validPage = searchData.pages.find(
      (page) =>
        page.description &&
        !/disambiguation|Topics referred to by the same term/i.test(page.description)
    );

    if (!validPage) {
      return res.status(404).json({ error: 'Nenalezen vhodný článek (není disambiguace).' });
    }

    const bestMatchTitle = validPage.key;

    // 2. Wikipedia mobile-sections API
    if (DEBUG_MODE) console.log(`DEBUG: Načítám obsah článku: ${bestMatchTitle}`);
    const articleRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/mobile-sections/${encodeURIComponent(bestMatchTitle)}`
    );
    const articleData = await articleRes.json();

    if (DEBUG_MODE) console.log('DEBUG: Článek načten:', JSON.stringify(articleData.lead, null, 2));

    const leadText = articleData.lead?.sections?.map((s) => s.text).join('\n') || '';
    const remainingText = articleData.remaining?.sections?.map((s) => s.text).join('\n') || '';
    const fullText = leadText + '\n' + remainingText;

    if (!fullText) {
      return res.status(500).json({ error: 'Nepodařilo se načíst text článku z Wikipedie.' });
    }

    // 3. Groq API call
    if (DEBUG_MODE) console.log(`DEBUG: Volám Groq API pro shrnutí do ${delka} vět`);

    const prompt = `
Jsi AI sumarizátor. Shrň následující text do ${delka} vět. Použij čisté HTML bez <html> nebo <body> tagů. Text je z Wikipedie.

Text:
${fullText}
    `;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!groqRes.ok) {
      const errorBody = await groqRes.text();
      if (DEBUG_MODE) {
        console.error('DEBUG: Groq API error response:', errorBody);
        return res.status(groqRes.status).json({
          error: 'Groq API error',
          status: groqRes.status,
          body: errorBody,
        });
      } else {
        return res.status(500).json({ error: 'Chyba při volání Groq API' });
      }
    }

    const groqData = await groqRes.json();

    if (DEBUG_MODE) console.log('DEBUG: Groq API response:', JSON.stringify(groqData, null, 2));

    const htmlOutput = groqData.choices?.[0]?.message?.content;

    if (!htmlOutput) {
      return res.status(500).json({ error: 'Groq API nevrátilo odpověď.' });
    }

    // Odpovíme přímo HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlOutput);

  } catch (err) {
    console.error('Chyba:', err);

    if (DEBUG_MODE) {
      // Pokud je to fetch chyba s response:
      if (err.response) {
        try {
          const body = await err.response.text();
          console.error('DEBUG: Response body:', body);
          return res.status(500).json({
            error: 'Interní chyba serveru',
            detail: err.message,
            responseBody: body,
            stack: err.stack,
          });
        } catch {
          // ignore
        }
      }

      return res.status(500).json({
        error: 'Interní chyba serveru',
        detail: err.message,
        stack: err.stack,
      });
    } else {
      return res.status(500).json({ error: 'Interní chyba serveru' });
    }
  }
};
