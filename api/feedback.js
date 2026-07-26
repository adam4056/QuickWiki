module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const timestamp = new Date().toISOString();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referer = req.headers['referer'] || 'unknown';

    console.log('--- QuickWiki Feedback ---');
    console.log(`Timestamp: ${timestamp}`);
    console.log(`IP: ${ip}`);
    console.log(`User-Agent: ${userAgent}`);
    console.log(`Referer: ${referer}`);
    console.log('Feedback: User wants QuickWiki to continue');
    console.log('-------------------------');

    res.status(200).json({
        success: true,
        message: 'Thank you! Your feedback has been recorded.'
    });
};
