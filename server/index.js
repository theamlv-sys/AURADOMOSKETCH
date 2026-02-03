import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

console.log('[Startup] Status Check:', {
    hasPrimaryKey: !!process.env.GEMINI_API_KEY,
    hasBackupKey: !!process.env.GEMINI_API_KEY_BACKUP,
    env: process.env.NODE_ENV
});


// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase Admin (for verifying payments and upgrading users securely)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- STRIPE WEBHOOK (Must be before express.json) ---
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
    const sig = request.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object;
        const email = invoice.customer_email;
        // Get credits from subscription metadata if possible, or fallback to Plan defaults
        // For simplicity, we assume Plan Name implies Credits, or we check the Line Items.
        // But we stored metadata on the Subscription Object during Checkout Create?
        // Actually, 'invoice.payment_succeeded' might not have the metadata if not propagated.
        // We will look up the User's Tier in DB and reset credits to that Tier's Limit.

        console.log(`[Webhook] Invoice Paid for ${email}. Resetting Credits.`);

        const { data: user } = await supabase.from('users').select('tier').eq('email', email).single();
        if (user) {
            let resetAmount = 100; // Default
            if (user.tier === 'producer') resetAmount = 300;
            if (user.tier === 'studio') resetAmount = 1000;

            await supabase.from('users').update({
                credits: resetAmount,
                last_reset_date: new Date().toISOString()
            }).eq('email', email);
        }
    }

    response.send();
});

app.use(express.json({ limit: '50mb' }));

// --- ENDPOINTS ---

// 1. Generate Art - Using Official Google SDK Method
app.post('/api/generate-art', async (req, res) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const { sketchBase64, config, stylePrompt } = req.body;

        // Construct prompt with explicit instructions for reference image + sketch combination
        let userInstructions = config.prompt || 'Execute a total stylistic transformation of the entire frame.';

        // If both reference image and sketch are provided, add explicit merge instruction
        if (config.referenceImage && sketchBase64) {
            userInstructions = `Take the reference photo and incorporate the drawn sketch elements into it. Merge and blend the sketch strokes naturally into the scene while maintaining the style. ${userInstructions}`;
        }

        const finalPrompt = `
ROLE: MASTER NEURAL ARTIST.
MANDATORY_TARGET_STYLE: "${stylePrompt}"
USER INSTRUCTIONS: ${userInstructions}
NEGATIVE CONSTRAINTS: ${config.negativePrompt || ''}, low resolution, artifacts, partial rendering, photo remnants.
`.trim();

        // Build contents array for the API
        const contents = [];

        // Add the text prompt
        contents.push({ text: finalPrompt });

        // IMPORTANT: Add reference image FIRST, then sketch overlay
        // If they are the same (like in Upscale), only add one to save bandwidth and prevent confusion
        const isSameImage = config.referenceImage && sketchBase64 &&
            config.referenceImage.substring(0, 100) === sketchBase64.substring(0, 100);

        if (config.referenceImage) {
            const refData = config.referenceImage.split(',')[1];
            contents.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: refData
                }
            });
        }

        // Add the sketch image only if it's different from the reference
        if (sketchBase64 && !isSameImage) {
            const sketchData = sketchBase64.split(',')[1];
            contents.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: sketchData
                }
            });
        }

        console.log('[Image Gen] Calling ai.models.generateContent...');

        // Use the CORRECT API method from official Google documentation
        const response = await ai.models.generateContent({
            model: config.model || 'gemini-2.5-flash-image',
            contents: contents,
        });

        console.log('[Image Gen] Response received, checking parts...');

        const candidate = response.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
            throw new Error("AI Refusal: Content blocked by safety filters. Try modifying your prompt or drawing.");
        }

        const parts = candidate?.content?.parts;

        if (!parts || parts.length === 0) {
            console.log('[Image Gen] No parts in response:', JSON.stringify(response, null, 2));
            throw new Error("No content generated by model. (Reason: Empty Response)");
        }

        for (const part of parts) {
            if (part.text) {
                console.log('[Image Gen] Text response:', part.text);
            } else if (part.inlineData) {
                // This is the image data - it's already base64 encoded
                const imageData = part.inlineData.data;
                const mimeType = part.inlineData.mimeType || 'image/png';

                console.log('[Image Gen] SUCCESS! Image data length:', imageData.length);
                console.log('[Image Gen] MIME type:', mimeType);

                return res.json({
                    result: `data:${mimeType};base64,${imageData}`
                });
            }
        }

        // If we get here, no image was found in the response
        const textPart = parts.find(p => p.text);
        throw new Error(textPart?.text || "No image generated by model");

    } catch (err) {
        console.error('Generation Error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// --- TEMPORARY TEST HELPERS ---
app.post('/api/reset-test-credits', async (req, res) => {
    try {
        const EMAIL = 'auradomoai@gmail.com';
        const { data: user } = await supabase.from('users').select('id').eq('email', EMAIL).single();
        if (!user) return res.status(404).json({ error: 'User not found' });

        await supabase.from('users').update({ credits: 1000 }).eq('id', user.id);
        console.log(`Reset credits for ${EMAIL}`);
        return res.json({ success: true, credits: 1000 });
    } catch (err) {
        console.error('Reset Error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// Admin Credit Management
app.post('/api/admin/update-credits', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No token' });

        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user || user.email !== 'auraassistantai@gmail.com') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { userId, action, value } = req.body;

        // Fetch current to increment if needed
        const { data: targetUser } = await supabase.from('users').select('credits').eq('id', userId).single();
        if (!targetUser) return res.status(404).json({ error: 'Target user not found' });

        let newCredits = targetUser.credits;
        if (action === 'reset') newCredits = value;
        if (action === 'add') newCredits += value;

        await supabase.from('users').update({ credits: newCredits }).eq('id', userId);
        return res.json({ success: true, newCredits });

    } catch (err) {
        console.error('Admin Update Error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// 2. Generate Video (Veo 3.1) with API Failover
app.post('/api/generate-video', async (req, res) => {
    const apiKeys = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_BACKUP
    ].filter(Boolean);

    console.log(`[Video] SYSTEM: Detected ${apiKeys.length} API keys in environment.`);
    let lastError = null;

    for (let i = 0; i < apiKeys.length; i++) {
        const currentKey = apiKeys[i];
        console.log(`[Video] Attempt ${i + 1} using key: ${currentKey.slice(0, 8)}...`);

        try {
            const ai = new GoogleGenAI({ apiKey: currentKey });
            const { config } = req.body;

            const videoParams = {
                model: config.model || 'veo-3.1-fast-generate-preview',
                source: {
                    prompt: config.prompt || 'Cinematic movement',
                },
                config: {
                    aspectRatio: config.aspectRatio || '16:9',
                    resolution: config.resolution || '720p'
                }
            };

            if (config.startingImage) {
                videoParams.source.image = {
                    imageBytes: config.startingImage.split(',')[1],
                    mimeType: 'image/jpeg'
                };
            }

            if (config.endingImage) {
                videoParams.config.lastFrame = {
                    imageBytes: config.endingImage.split(',')[1],
                    mimeType: 'image/jpeg'
                };
            }

            if (config.ingredients && Array.isArray(config.ingredients) && config.ingredients.length > 0) {
                videoParams.config.referenceImages = config.ingredients.map(imgData => ({
                    image: {
                        imageBytes: imgData.split(',')[1],
                        mimeType: 'image/jpeg'
                    },
                    referenceType: 'asset'
                }));
            }

            // 1. Kick off the generation
            let operation = await ai.models.generateVideos(videoParams);

            // 2. Poll for completion
            let attempts = 0;
            const maxAttempts = 30;

            while (!operation.done && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                operation = await ai.operations.getVideosOperation({ operation });
                attempts++;
                console.log(`Video generation progress: ${attempts}/${maxAttempts}`);
            }

            if (operation.done && operation.response?.generatedVideos?.[0]?.video) {
                const video = operation.response.generatedVideos[0].video;

                if (video.videoBytes) {
                    return res.json({
                        videoBase64: video.videoBytes,
                        mimeType: video.mimeType || 'video/mp4'
                    });
                }

                if (video.uri) {
                    console.log('Fetching video from URI:', video.uri);
                    const response = await fetch(video.uri, {
                        headers: { 'x-goog-api-key': currentKey }
                    });

                    if (!response.ok) {
                        if (response.status === 429 && i < apiKeys.length - 1) {
                            console.warn(`[Video] Fetch failed with 429 on key ${i + 1}. Trying next key.`);
                            continue; // Fallback to next key
                        }
                        throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
                    }

                    const arrayBuffer = await response.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                    return res.json({
                        videoBase64: base64,
                        mimeType: video.mimeType || 'video/mp4'
                    });
                }
            }

            if (operation.error) {
                const isQuotaError = operation.error.code === 429 ||
                    (operation.error.message && operation.error.message.includes('quota'));

                if (isQuotaError && i < apiKeys.length - 1) {
                    console.warn(`[Video] Generation failed with quota error on key ${i + 1}. Trying next key.`);
                    continue;
                }
                throw new Error(operation.error.message);
            }

            throw new Error("Video generation timed out or failed to produce a valid video object.");

        } catch (err) {
            const errStr = (JSON.stringify(err) + err.message).toLowerCase();
            console.log(`[Video] Caught error on attempt ${i + 1}:`, errStr);

            const isRetriable = errStr.includes('429') ||
                errStr.includes('quota') ||
                errStr.includes('resource_exhausted') ||
                errStr.includes('limit') ||
                errStr.includes('403') ||
                errStr.includes('leaked') ||
                errStr.includes('permission_denied');

            if (isRetriable && i < apiKeys.length - 1) {
                console.warn(`[Video] Key ${i + 1} hit error (Quota or Leak). Trying backup...`);
                lastError = err;
                continue;
            }

            console.error(`[Video] Final fail on key ${i + 1}:`, err);
            const status = isRetriable ? 429 : 500;
            return res.status(status).json({
                error: err.message || "Synthesis error",
                details: isRetriable ? "All available keys hit quota or were disabled." : "Fatal error."
            });
        }
    }

    return res.status(429).json({
        error: "All Video API keys have exhausted their quotas. Please try again later.",
        details: lastError?.message
    });
});

// 3. Download Endpoint - Forces correct filename with HTTP headers
app.post('/api/download', (req, res) => {
    try {
        const { base64Data, filename, mimeType } = req.body;

        if (!base64Data || !filename) {
            return res.status(400).json({ error: 'Missing base64Data or filename' });
        }

        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Set headers to force download with correct filename
        res.setHeader('Content-Type', mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);

        // Send the file
        res.send(buffer);

    } catch (err) {
        console.error('Download Error:', err);
        return res.status(500).json({ error: err.message });
    }
});

// 4. Create Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { tier, email, type, creditAmount } = req.body;

        // HANDLE CREDIT RECHARGE (ONE-TIME PAYMENT)
        if (type === 'credit') {
            let priceData = {};
            let credits = 0;

            if (creditAmount === 50) {
                priceData = {
                    currency: 'usd',
                    product_data: { name: '50 Aura Credits', description: 'One-time recharge' },
                    unit_amount: 5000, // $50.00
                };
                credits = 50;
            } else if (creditAmount === 150) {
                // Best Value
                priceData = {
                    currency: 'usd',
                    product_data: { name: '150 Aura Credits', description: 'One-time recharge (Best Value)' },
                    unit_amount: 9900, // $99.00
                };
                credits = 150;
            } else {
                return res.status(400).json({ error: 'Invalid credit amount' });
            }

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: priceData,
                    quantity: 1,
                }],
                mode: 'payment', // One-time payment
                success_url: `${FRONTEND_URL}/?success=true&session_id={CHECKOUT_SESSION_ID}&type=credit`,
                cancel_url: `${FRONTEND_URL}/?canceled=true`,
                customer_email: email,
                metadata: {
                    type: 'credit',
                    credits: credits
                }
            });

            return res.json({ id: session.id, url: session.url });
        }

        // HANDLE SUBSCRIPTION (RECURRING)
        // Define prices based on tier
        let priceData = {};
        let credits = 0;

        switch (tier) {
            case 'designer':
                priceData = {
                    currency: 'usd',
                    product_data: { name: 'Designer Plan', description: '100 Credits / Month' },
                    unit_amount: 9900, // $99.00
                    recurring: { interval: 'month' },
                };
                credits = 100;
                break;
            case 'producer':
                priceData = {
                    currency: 'usd',
                    product_data: { name: 'Producer Plan', description: '300 Credits / Month' },
                    unit_amount: 19900, // $199.00
                    recurring: { interval: 'month' },
                };
                credits = 300;
                break;
            case 'studio':
                priceData = {
                    currency: 'usd',
                    product_data: { name: 'Studio Plan', description: '1000 Credits / Month' },
                    unit_amount: 59900, // $599.00
                    recurring: { interval: 'month' },
                };
                credits = 1000;
                break;
            default:
                throw new Error('Invalid Tier');
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: priceData,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${FRONTEND_URL}/?success=true&session_id={CHECKOUT_SESSION_ID}&tier=${tier}&type=subscription`,
            cancel_url: `${FRONTEND_URL}/?canceled=true`,
            customer_email: email,
            metadata: {
                type: 'subscription',
                tier: tier,
                credits: credits
            }
        });


        res.json({ id: session.id, url: session.url });

    } catch (err) {
        console.error('Stripe Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Verify Payment Endpoint
app.post('/api/verify-payment', async (req, res) => {
    try {
        const { sessionId } = req.body;

        // Retrieve session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            // Securely update Supabase
            const email = session.customer_email;

            // Handle Credit Recharge
            if (session.metadata.type === 'credit') {
                const creditAmount = parseInt(session.metadata.credits);
                console.log(`[Payment Verified] Adding ${creditAmount} credits to ${email}`);

                // Get current credits first to add to them
                const { data: user } = await supabase.from('users').select('credits').eq('email', email).single();
                const currentCredits = user?.credits || 0;
                const newTotal = currentCredits + creditAmount;

                const { error } = await supabase
                    .from('users')
                    .update({ credits: newTotal })
                    .eq('email', email);

                if (error) throw error;
                return res.json({ verified: true, type: 'credit', credits: newTotal });
            }

            // Handle Subscription (Existing Logic)
            const tier = session.metadata.tier;
            const credits = parseInt(session.metadata.credits); // Reset credits to plan limit

            console.log(`[Payment Verified] Upgrading ${email} to ${tier}`);

            const { error } = await supabase
                .from('users')
                .update({
                    tier: tier,
                    credits: credits,
                    last_reset_date: new Date().toISOString() // Set Reset Date
                })
                .eq('email', email);

            if (error) throw error;

            return res.json({ verified: true, tier: tier, credits: credits });
        } else {
            return res.json({ verified: false });
        }

    } catch (err) {
        console.error('Verification Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// 6. Sync Credits (Securely update credits from client usage)
app.post('/api/sync-credits', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.log('[Sync] No Auth Header');
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.log('[Sync] Auth Failed:', error?.message);
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { credits } = req.body;
        console.log(`[Sync] Request for ${user.email} -> Credits: ${credits}`);

        if (typeof credits !== 'number') return res.status(400).json({ error: 'Invalid credits' });

        // Update DB (Service Role bypasses RLS)
        const { error: updateError } = await supabase
            .from('users')
            .update({ credits: credits })
            .eq('id', user.id);

        if (updateError) {
            console.error('[Sync] DB Error:', updateError);
            throw updateError;
        }

        console.log('[Sync] Success');
        res.json({ success: true });
    } catch (err) {
        console.error('Sync Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN ENDPOINTS ---

const ADMIN_EMAIL = 'auraassistantai@gmail.com';

// Middleware to verify admin
const verifyAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user || user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Unauthorized: Admin access only' });
    }

    req.user = user;
    next();
};

// 6. Admin Data (Get all users)
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Claim Master Access (Promote to Studio)
app.post('/api/admin/claim', verifyAdmin, async (req, res) => {
    try {
        const user = req.user;
        // Promote to Studio
        // Check current status first
        const { data: currentUser } = await supabase.from('users').select('tier, credits').eq('id', user.id).single();

        // Only grant 1000 credits if NOT currently studio (First time claim)
        // OR if credits are effectively zero/low (Emergency Restore)
        let updates = { tier: 'studio' };
        // FIX: Check for < 50, not just null. 0 is not null.
        if (currentUser.tier !== 'studio' || currentUser.credits === null || currentUser.credits < 50) {
            updates.credits = 1000;
            console.log(`[Admin] Auto-Restoring credits to 1000 for ${user.email}`);
        }

        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', user.id);

        if (error) throw error;

        console.log(`[Admin] Promoted ${user.email} to Studio`);
        res.json({ success: true, message: 'Promoted to Studio' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
