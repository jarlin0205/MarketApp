const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rofrdxjvriirweyddxqw.supabase.co',
  'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function test() {
  console.log("Testing RPC...");
  const { data: rpcData, error: rpcErr } = await supabase.rpc('create_repartidor', {
    p_username: 'carlosb_test',
    p_password: 'Admin123*',
    p_full_name: 'Carlos B Test',
    p_phone: '+57 3000000000'
  });

  console.log({ rpcData, rpcErr });
}

test();
