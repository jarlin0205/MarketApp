const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rofrdxjvriirweyddxqw.supabase.co',
  'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function test() {
  console.log("Testing Login...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'carlosb@repartidor.local',
    password: 'Admin123*'
  });

  console.log("Data:", data);
  console.log("Error:", error);
}

test();
