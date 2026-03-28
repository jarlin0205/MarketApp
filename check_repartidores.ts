import { supabase } from './src/lib/supabase';

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').eq('role', 'repartidor');
  console.log("=== LISTA DE REPARTIDORES EN BASE DE DATOS ===");
  if (error) {
    console.error("ERROR:", error);
  } else if (!data || data.length === 0) {
    console.log("No hay ningún usuario registrado con el rol de 'repartidor'.");
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
