
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetUsers() {
    console.log('Resetting all users to NO TIER...');

    // Update all users to have tier = null
    // We filter by ID is not null to select all rows
    const { data, error } = await supabase
        .from('users')
        .update({ tier: null })
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
        console.error('Error resetting users:', error);
    } else {
        console.log('Success! All users reset. They will now see the Subscription Screen.');
    }
}

resetUsers();
