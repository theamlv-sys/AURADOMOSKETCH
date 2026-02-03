import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const apiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_BACKUP].filter(Boolean);

async function testFailover() {
    console.log(`Detected ${apiKeys.length} keys.`);
    for (let i = 0; i < apiKeys.length; i++) {
        const key = apiKeys[i];
        console.log(`\n--- Attempt ${i + 1} (${key.slice(0, 8)}...) ---`);
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            const videoParams = {
                model: 'veo-3.1-fast-generate-preview',
                source: { prompt: 'A simple test video of a bird' },
                config: { aspectRatio: '16:9', resolution: '720p' }
            };

            console.log("Starting generation...");
            const operation = await ai.models.generateVideos(videoParams);
            console.log("Success! (Or at least started)");
            return;
        } catch (err) {
            console.log(`Caught Error: ${err.message}`);
            const isQuota = err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED');
            if (isQuota && i < apiKeys.length - 1) {
                console.warn("FAILOVER TRIGGERED!");
                continue;
            }
            console.error("FATAL ERROR or No More Keys.");
        }
    }
}

testFailover();
