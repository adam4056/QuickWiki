const axios = require('axios');
const { parse } = require('node-html-parser');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { url, grokApiKey } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!grokApiKey) {
      return res.status(400).json({ error: 'Grok API key is required' });
    }

    // Extract Wikipedia article title from URL
    const wikiMatch = url.match(/wikipedia\.org\/wiki\/(.+)/);
    if (!wikiMatch) {
      return res.status(400).json({ error: 'Invalid Wikipedia URL' });
    }

    const articleTitle = decodeURIComponent(wikiMatch[1]);

    // Fetch Wikipedia article content
    const wikiResponse = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${articleTitle}`);
    
    if (wikiResponse.data.extract) {
      // If we have an extract, use it (it's already summarized)
      const summary = wikiResponse.data.extract;
      
      // Format as HTML
      const htmlSummary = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            ${wikiResponse.data.title}
          </h1>
          <p style="line-height: 1.6; color: #555; font-size: 16px;">
            ${summary}
          </p>
          <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              <strong>Source:</strong> <a href="${url}" target="_blank">Wikipedia</a>
            </p>
          </div>
        </div>
      `;

      return res.status(200).json({
        success: true,
        title: wikiResponse.data.title,
        summary: summary,
        html: htmlSummary
      });
    }

    // If no extract available, fetch full article content
    const fullArticleResponse = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/html/${articleTitle}`);
    
    if (fullArticleResponse.status !== 200) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Parse HTML and extract text content
    const root = parse(fullArticleResponse.data);
    
    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 
      '.mw-editsection', '.mw-references', '.reflist',
      '.thumb', '.infobox', '.metadata', '.ambox'
    ];
    
    unwantedSelectors.forEach(selector => {
      root.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Extract main content
    const mainContent = root.querySelector('main') || root.querySelector('body');
    if (!mainContent) {
      return res.status(500).json({ error: 'Could not extract article content' });
    }

    // Get text content and clean it up
    let textContent = mainContent.text;
    
    // Clean up the text
    textContent = textContent
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .trim();

    // Limit content size to avoid API limits (keep it under 50KB)
    if (textContent.length > 45000) {
      textContent = textContent.substring(0, 45000) + '...';
    }

    // Send to Grok API for summarization
    const grokResponse = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: 'grok-beta',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes Wikipedia articles. Provide a concise, well-structured summary in HTML format with proper formatting, headings, and paragraphs. Keep the summary informative but concise.'
        },
        {
          role: 'user',
          content: `Please summarize this Wikipedia article about "${wikiResponse.data.title}":\n\n${textContent}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const grokSummary = grokResponse.data.choices[0].message.content;

    // Format the response as HTML
    const htmlSummary = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          ${wikiResponse.data.title}
        </h1>
        <div style="line-height: 1.6; color: #555; font-size: 16px;">
          ${grokSummary}
        </div>
        <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            <strong>Source:</strong> <a href="${url}" target="_blank">Wikipedia</a>
          </p>
        </div>
      </div>
    `;

    return res.status(200).json({
      success: true,
      title: wikiResponse.data.title,
      summary: grokSummary,
      html: htmlSummary
    });

  } catch (error) {
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    return res.status(500).json({ 
      error: 'Failed to process the request',
      details: error.message 
    });
  }
};
