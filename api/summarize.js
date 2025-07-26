const axios = require('axios');

module.exports = async (req, res) => {
  const tema = req.query.tema;
  const delka = parseInt(req.query.delka) || 3;

  if (!tema) {
    return res.status(400).json({ error: 'Chybí parametr "tema"' });
  }

  try {
    // 1. Wikipedia search API
    const searchRes = await axios.get(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(tema)}&limit=5`
    );
    const searchData = searchRes.data;

    // Najdeme relevantní stránku, která není disambiguace
    const validPage = searchData.pages.find(
      (page) =>
        page.description &&
        !/disambiguation|Topics referred to by the same term/i.test(page.description)
    );

    if (!validPage) {
      return res.status(404).json({ error: 'Nenalezen vhodný článek (není disambiguace).' });
    }

    const bestMatchTitle = validPage.key;

    // 2. Wikipedia API - Extracts (plain text) - místo mobile-sections
    const extractRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        prop: 'extracts',
        explaintext: 1,
        format: 'json',
        titles: bestMatchTitle,
        redirects: 1,
      },
    });

    const pages = extractRes.data.query.pages;
    const pageId = Object.keys(pages)[0];
    const extractText = pages[pageId].extract;

    if (!extractText) {
      return res.status(500).json({ error: 'Nepodařilo se načíst text článku z Wikipedie.' });
    }

    // 3. Groq API call (AI sumarizace)
    const prompt = `
Jsi AI sumarizátor. Shrň následující text do ${delka} vět. Použij čisté HTML bez <html> nebo <body> tagů. Text je z Wikipedie.

Text:
${extractText}
    `;

    const groqRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const groqData = groqRes.data;
    const htmlOutput = groqData.choices?.[0]?.message?.content;

    if (!htmlOutput) {
      return res.status(500).json({ error: 'Groq API nevrátilo odpověď.' });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlOutput);

  } catch (err) {
    console.error('Chyba:', err);
    return res.status(500).json({ error: 'Interní chyba serveru' });
  }
};