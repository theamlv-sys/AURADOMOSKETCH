import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const EMAIL = 'auradomoai@gmail.com';
const CREDITS = 1000;

const resetCredits = async () => {
    console.log(`Resetting credits for ${EMAIL}...`);

    // 1. Get User ID
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, credits')
        .eq('email', EMAIL)
        .single();

    if (userError || !user) {
        console.error('User not found:', userError);
        return;
    }

    console.log(`Current Credits: ${user.credits}`);

    // 2. Update Credits
    const { error: updateError } = await supabase
        .from('users')
        .update({ credits: CREDITS })
        .eq('id', user.id);

    if (updateError) {
        console.error('Update failed:', updateError);
    } else {
        console.log(`SUCCESS: Credits reset to ${CREDITS} for ${EMAIL}`);
    }
};

resetCredits();
