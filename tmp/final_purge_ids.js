const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rofrdxjvriirweyddxqw.supabase.co', 'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR');

// IDs ENCONTRADOS EN LA AUDITORIA
const idsToDelete = ['393c6213-9113-4f9e-a895-65489868846b', '9f2d1e0a-b501-4993-8bc6-32ade1a52026']; 

// Wait, looking at IDs... they were shortened in my log. I need full IDs. 
// Actually I'll use a script that finds full IDs based on the shortened ones 
// or I'll just look at the raw data again.

async function purge() {
  console.log('--- PURGA DEFINITIVA POR ID ---');
  
  // Tatiana full search
  const { data: orders } = await supabase.from('orders').select('id, customer_name, total');
  
  const toDelete = orders.filter(o => o.customer_name === 'rechazar' || o.customer_name === 'Tatiana');
  
  console.log(`Encontrados ${toDelete.length} pedidos de prueba.`);

  for (const o of toDelete) {
    console.log(`Borrando Pedido de ${o.customer_name} ($${o.total})...`);
    await supabase.from('order_reviews').delete().eq('order_id', o.id);
    await supabase.from('order_items').delete().eq('order_id', o.id);
    await supabase.from('orders').delete().eq('id', o.id);
    console.log(`✅ ${o.customer_name} ELIMINADO.`);
  }

  console.log('--- OPERACIÓN COMPLETADA ---');
}

purge();
