const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE env vars.');
}
const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = supabase;
