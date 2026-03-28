const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rofrdxjvriirweyddxqw.supabase.co', 'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR');

async function cleanup() {
  console.log('--- BUSCANDO PEDIDO TATIANA ($50.000) ---');
  const { data: found } = await supabase
    .from('orders')
    .select('id')
    .eq('customer_name', 'Tatiana')
    .eq('total', 50000);

  if (!found || found.length === 0) {
    console.log('No se encontró el pedido.');
    return;
  }

  const id = found[0].id;
  console.log(`ID Encontrado: ${id}. Eliminando...`);
  
  await supabase.from('order_items').delete().eq('order_id', id);
  await supabase.from('order_reviews').delete().eq('order_id', id);
  await supabase.from('orders').delete().eq('id', id);
  
  console.log('--- PEDIDO ELIMINADO CORRECTAMENTE ---');
}

cleanup();
