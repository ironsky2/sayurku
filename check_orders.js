const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://ewdwkkjbntzekmomkbup.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZHdra2pibnR6ZWttb21rYnVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzE3MzcsImV4cCI6MjA5OTk0NzczN30.OYr7UGhn51ww7vfsLiC_t0oSDXoy3WlDPSqYQlrrdjI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('--- Fetching orders table (direct bypass check using service role is not possible, using anon key) ---')
  
  // Note: Since we are using anon key without logging in, we can't see orders due to RLS.
  // But wait! Can we check how many rows are in the orders table if we bypass RLS?
  // Let's check profiles list to see if the customer and admin profiles exist correctly.
  
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*')
  console.log('Profiles currently in DB:')
  console.log(JSON.stringify(profiles, null, 2))
}

run()
