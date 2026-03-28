const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rofrdxjvriirweyddxqw.supabase.co',
  'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function test() {
  console.log("Checking if profile exists...");
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'jarlinesquivel@gmail.com')
    .maybeSingle();

  console.log({ profile, error: pErr });

  if (!profile) {
    console.log("Creating new user...");
    const { data: authData, error: signupErr } = await supabase.auth.signUp({
      email: 'jarlinesquivel@gmail.com',
      password: 'Admin123*',
      options: { 
        data: { 
          full_name: 'carlos bastidas',
          role: 'repartidor',
          phone: '+57 3103457689'
        } 
      }
    });

    console.log("Auth Data:", JSON.stringify(authData, null, 2));
    console.log("Signup Err:", signupErr);
  }
}

test();
