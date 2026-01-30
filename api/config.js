// api/config.js (Update)
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
    // ... keep your GET and existing POST logic ...

    // ADD THIS MODERATION LOGIC
    if (req.method === 'PATCH') {
        const { username } = req.body;
        const banned = ['badword1', 'badword2', 'offensiveTerm']; // Add your list
        const isClean = !banned.some(word => username.toLowerCase().includes(word));
        const isValid = /^[a-zA-Z0-9_]{3,12}$/.test(username);
        
        return res.status(200).json({ valid: isClean && isValid });
    }
}
