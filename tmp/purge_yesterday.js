const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rofrdxjvriirweyddxqw.supabase.co', 'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR');

const TODAY_START = '2026-03-28T00:00:00Z';

async function purgePast() {
  console.log('--- INICIANDO PURGA DE AYER Y ANTERIORES (< 28/03) ---');
  
  // 1. Buscar todos los pedidos creados antes del 28 de marzo
  const { data: pastOrders } = await supabase
    .from('orders')
    .select('id, customer_name, total, created_at')
    .lt('created_at', TODAY_START);

  // 2. Buscar también a Luca Modri (prueba de hoy)
  const { data: testToday } = await supabase
    .from('orders')
    .select('id, customer_name, total')
    .eq('customer_name', 'LUCA MODRI');

  const toDelete = [...(pastOrders || []), ...(testToday || [])];

  if (toDelete.length === 0) {
    console.log('No se encontraron pedidos antiguos ni de prueba para borrar.');
    return;
  }

  console.log(`Detectados ${toDelete.length} pedidos para eliminar.`);

  for (const o of toDelete) {
    console.log(`Borrando: ${o.customer_name} | $${o.total} | Creado: ${o.created_at || 'Hoy'}...`);
    await supabase.from('order_reviews').delete().eq('order_id', o.id);
    await supabase.from('order_items').delete().eq('order_id', o.id);
    await supabase.from('orders').delete().eq('id', o.id);
  }

  console.log('--- PURGA COMPLETADA CON ÉXITO ---');
}

purgePast();
