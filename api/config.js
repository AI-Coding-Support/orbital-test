import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
    const { method, body } = req;

    try {
        // 1. GET: Fetch global settings
        if (method === 'GET') {
            const data = await redis.get('orbital_config');
            return res.status(200).json(data ? JSON.parse(data) : {
                baseSpeed: 0.025, visionDecay: 0.0009, arcMin: 1.2, arcMax: 3.5
            });
        }

        // 2. POST: Secure Update (THE TRUTH LIVES HERE)
        if (method === 'POST') {
            const { auth, newConfig } = body;

            // Strict check against Vercel Environment Variable
            if (!auth || auth !== process.env.ADMIN_PASSWORD) {
                console.error("Unauthorized attempt blocked.");
                return res.status(401).json({ error: "INVALID_CREDENTIALS" });
            }

            // Save to Redis Memory
            await redis.set('orbital_config', JSON.stringify(newConfig));
            return res.status(200).json({ success: true });
        }

        // 3. PATCH: Username Moderation
        if (method === 'PATCH') {
            const { username } = body;
            const banned = ['admin', 'mod', 'server', 'root', 'fuck', 'shit']; // Basic list
            const isClean = !banned.some(word => username.toLowerCase().includes(word));
            const isValid = /^[a-zA-Z0-9_]{3,12}$/.test(username);
            return res.status(200).json({ valid: isClean && isValid });
        }

    } catch (err) {
        return res.status(500).json({ error: "SERVER_ERROR" });
    }
}
