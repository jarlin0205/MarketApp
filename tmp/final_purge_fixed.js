const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rofrdxjvriirweyddxqw.supabase.co', 'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR');

const TODAY_REF = '2026-03-28';

async function finalPurge() {
  console.log('--- PURGA DEFINITIVA v7.11 ---');
  
  const { data: allOrders } = await supabase.from('orders').select('id, customer_name, total, created_at');

  const toDelete = allOrders.filter(o => {
    const isYesterday = !o.created_at.startsWith(TODAY_REF);
    const isFakeLuca = o.customer_name === 'LUCA MODRI' && parseFloat(o.total) > 60000;
    return isYesterday || isFakeLuca;
  });

  console.log(`Borrando ${toDelete.length} pedidos detectados.`);

  for (const o of toDelete) {
    console.log(`Eliminando: ${o.customer_name} | $${o.total} | ${o.created_at}...`);
    await supabase.from('order_reviews').delete().eq('order_id', o.id);
    await supabase.from('order_items').delete().eq('order_id', o.id);
    await supabase.from('orders').delete().eq('id', o.id);
  }

  console.log('--- PURGA COMPLETADA ---');
}

finalPurge();
