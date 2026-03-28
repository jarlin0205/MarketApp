const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rofrdxjvriirweyddxqw.supabase.co', 'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR');

const TODAY = '2026-03-28';

async function audit() {
  console.log('--- RE-AUDITORÍA DE VENTAS 28/03/2026 ---');
  
  const { data: allOrders, error } = await supabase
    .from('orders')
    .select('id, customer_name, total, status, created_at');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const successStates = ['Entregado', 'Confirmado', 'Liquidado'];
  
  const todaySuccess = allOrders.filter(o => 
    o.created_at.startsWith(TODAY) && 
    successStates.includes(o.status)
  );

  console.log('PEDIDOS CON ÉXITO CREADOS HOY:');
  todaySuccess.forEach(o => {
    console.log(`- ID: ${o.id.slice(0,8)} | CLIENTE: ${o.customer_name.padEnd(15)} | MONTO: $${o.total}`);
  });

  const total = todaySuccess.reduce((acc, o) => acc + parseFloat(o.total), 0);
  console.log('\nTOTAL CALCULADO:', total);
  
  if (total !== 133500) {
    console.log('\n--- ALERTA: DISCREPANCIA DETECTADA ---');
    console.log('Buscando pedidos "extra" que no deberían estar...');
  }
}

audit();
