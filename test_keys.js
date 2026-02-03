import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP
].filter(Boolean);

console.log(`Testing ${keys.length} keys...`);

for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    console.log(`Key ${i + 1}: ${key.slice(0, 8)}...`);
    const ai = new GoogleGenAI({ apiKey: key });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ text: 'hi' }]
        });
        console.log(`  - Key ${i + 1} Connectivity/Quota: OK`);
    } catch (err) {
        console.log(`  - Key ${i + 1} Error:`, err.message);
    }
}
