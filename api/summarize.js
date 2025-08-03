export default async function handler(req, res) {
    const topic = req.query.topic;
    const sentenceCount = parseInt(req.query.length) || 3;

    if (!topic) {
      res.status(400).json({ error: 'Missing parameter "topic"' });
      return;
    }

    try {
      // 1. MediaWiki Search API (less prone to blocking)
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json`,
        {
          headers: {
            'User-Agent': 'QuickWiki/1.0',
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
        res.status(404).json({ error: 'No suitable article found.' });
        return;
      }

      const bestMatchTitle = searchResults[0].title;

      // 2. Get article extract (plain text)
      const extractRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(bestMatchTitle)}&redirects=1`,
        {
          headers: {
            'User-Agent': 'QuickWiki/1.0',
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
        res.status(500).json({ error: 'Failed to load article text from Wikipedia.' });
        return;
      }

      // 3. Groq API call (summarization)
      const systemPrompt = `You are an AI summarizer. Summarize the following text in ${sentenceCount} sentences (aim for 15-25 words per sentence) using ONLY the provided information. Return clean HTML without <html> or <body> tags. No additional commentary. Text: ${inputText}`;
      
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: extractText }
          ],
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
        res.status(500).json({ error: 'Groq API did not return a response.' });
        return;
      }

      const originalUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(bestMatchTitle.replace(/ /g, '_'))}`;
      res.status(200).json({ summary: htmlOutput, originalUrl });

    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
  }
  