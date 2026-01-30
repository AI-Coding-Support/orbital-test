// api/config.js
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
    try {
        // 1. MODERATION CHECK (PATCH)
        if (req.method === 'PATCH') {
            const { username } = req.body;
            // Industry Standard: If no username, don't hang
            if (!username) return res.status(400).json({ valid: false });

            const banned = ['badword1', 'badword2', 'admin', 'root']; 
            const isClean = !banned.some(word => username.toLowerCase().includes(word));
            const isValid = /^[a-zA-Z0-9_]{3,12}$/.test(username);
            
            return res.status(200).json({ valid: isClean && isValid });
        }

        // 2. GET CONFIG
        if (req.method === 'GET') {
            const data = await redis.get('orbital_config');
            return res.status(200).json(data ? JSON.parse(data) : {
                baseSpeed: 0.025, visionDecay: 0.0009, arcMin: 1.2, arcMax: 3.5
            });
        }

        // 3. POST CONFIG (ADMIN)
        if (req.method === 'POST') {
            const { auth, newConfig } = req.body;
            if (auth !== process.env.ADMIN_PASSWORD) {
                return res.status(401).json({ error: 'UNAUTHORIZED' });
            }
            await redis.set('orbital_config', JSON.stringify(newConfig));
            return res.status(200).json({ success: true });
        }

    } catch (error) {
        console.error("API ERROR:", error);
        // Fallback so the frontend doesn't get stuck
        return res.status(500).json({ error: "Internal Server Error", valid: true });
    }
}
