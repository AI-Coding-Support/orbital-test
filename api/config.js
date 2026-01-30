import Redis from 'ioredis';

// Connect using the environment variable Vercel provided
const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
    const defaultSettings = {
        baseSpeed: 0.025,
        visionDecay: 0.0009,
        arcMin: 1.2,
        arcMax: 3.5
    };

    if (req.method === 'GET') {
        try {
            const data = await redis.get('orbital_config');
            return res.status(200).json(data ? JSON.parse(data) : defaultSettings);
        } catch (error) {
            console.error("Redis Error:", error);
            return res.status(200).json(defaultSettings);
        }
    }

    if (req.method === 'POST') {
        const { auth, newConfig } = req.body;

        if (auth !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'UNAUTHORIZED' });
        }

        try {
            // Redis stores strings, so we stringify the object
            await redis.set('orbital_config', JSON.stringify(newConfig));
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: "Failed to save to Redis" });
        }
    }
}
