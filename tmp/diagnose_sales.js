const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rofrdxjvriirweyddxqw.supabase.co', 'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR');

const TODAY = '2026-03-28';

async function diagnose() {
  console.log('--- DIAGNÓSTICO DE VENTAS 28/03/2026 ---');
  
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_name, total, status, created_at, delivered_at, client_confirmed_at')
    .or(`created_at.gte.${TODAY}T00:00:00,delivered_at.gte.${TODAY}T00:00:00,client_confirmed_at.gte.${TODAY}T00:00:00`);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const successStates = ['Entregado', 'Confirmado', 'Liquidado'];
  
  console.log('PEDIDOS ENCONTRADOS (POTENCIALES HOY):', data.length);
  
  const results = data.map(o => {
    const isTodayCreated = o.created_at.startsWith(TODAY);
    const isTodayDelivered = o.delivered_at?.startsWith(TODAY);
    const isTodayConfirmed = o.client_confirmed_at?.startsWith(TODAY);
    const isSuccess = successStates.includes(o.status);
    
    return {
      id: o.id.slice(0, 8),
      cliente: o.customer_name,
      monto: o.total,
      status: o.status,
      hoy_created: isTodayCreated,
      hoy_delivered: isTodayDelivered,
      hoy_confirmed: isTodayConfirmed,
      es_exito: isSuccess
    };
  });

  console.table(results);

  const totalCalculado = results
    .filter(r => r.es_exito && (r.hoy_confirmed || r.hoy_delivered))
    .reduce((acc, r) => acc + parseFloat(r.monto), 0);

  console.log('\n--- RESUMEN ---');
  console.log('Total Confirmado/Entregado HOY:', totalCalculado);
}

diagnose();
