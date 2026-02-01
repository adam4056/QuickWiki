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

      // 3. Truncate text to stay within Groq API TPM limits (approx 1000 tokens)
      const truncatedText = extractText.slice(0, 4000);

      // 4. Groq API call (summarization)
      const systemPrompt = `You are a concise AI summarizer. Create exactly ${sentenceCount} short sentences (maximum 12 words each) summarizing the key points. Use simple, direct language. Return clean HTML without <html> or <body> tags. Be brief and factual only.`;
      
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: truncatedText }
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        
        // Handle rate limiting specifically
        if (groqRes.status === 429) {
          const errorData = JSON.parse(errText);
          const retryAfter = errorData.error?.retry_after || 5;
          res.status(429).json({ 
            error: 'Rate limit exceeded. Please try again in a few seconds.',
            retryAfter: retryAfter,
            detail: 'The AI service is temporarily overloaded.'
          });
          return;
        }
        
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
  