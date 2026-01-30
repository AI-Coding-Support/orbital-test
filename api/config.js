import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // 1. When the game starts, it calls this to get the difficulty
    if (req.method === 'GET') {
        try {
            const config = await kv.get('orbital_config');
            return res.status(200).json(config || {
                baseSpeed: 0.025,
                visionDecay: 0.0009,
                arcMin: 1.2,
                arcMax: 3.5
            });
        } catch (error) {
            return res.status(500).json({ error: "Failed to fetch from KV" });
        }
    }

    // 2. When you use the Admin Dashboard, it calls this to save
    if (req.method === 'POST') {
        const { auth, newConfig } = req.body;

        // Matches the ADMIN_PASSWORD you set in Vercel Environment Variables
        if (auth !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'UNAUTHORIZED_ACCESS' });
        }

        try {
            await kv.set('orbital_config', newConfig);
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: "Failed to save to KV" });
        }
    }
}
