const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rofrdxjvriirweyddxqw.supabase.co', 'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR');

const TARGET_ORDER_IDS = []; // I'll fetch them first by name

async function purge() {
  console.log('--- INICIANDO PURGA QUIRÚRGICA ---');
  
  // Buscar pedidos de Tatiana o Luis
  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('id, customer_name, total')
    .or('customer_name.eq.Tatiana,customer_name.eq.Luis');

  if (fetchError) {
    console.error('Error buscando pedidos:', fetchError);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log('No se encontraron pedidos de Tatiana o Luis.');
    return;
  }

  console.log(`Encontrados ${orders.length} pedidos para eliminar.`);

  for (const order of orders) {
    console.log(`Borrando Pedido de ${order.customer_name} ID: ${order.id}...`);
    
    // 1. Borrar reseñas
    await supabase.from('order_reviews').delete().eq('order_id', order.id);
    
    // 2. Borrar items
    await supabase.from('order_items').delete().eq('order_id', order.id);
    
    // 3. Borrar pedido
    const { error: delError } = await supabase.from('orders').delete().eq('id', order.id);
    
    if (delError) {
      console.error(`Error borrando pedido ${order.id}:`, delError);
    } else {
      console.log(`✅ Pedido ${order.id} borrado de la base de datos.`);
    }
  }

  console.log('--- PURGA COMPLETADA CON ÉXITO ---');
}

purge();
