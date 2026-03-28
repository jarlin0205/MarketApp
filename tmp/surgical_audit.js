const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rofrdxjvriirweyddxqw.supabase.co', 'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR');

const TODAY_REF = '2026-03-28';

async function fullAudit() {
  console.log('--- AUDITORÍA QUIRÚRGICA DE ÓRDENES ---');
  const { data: allOrders, error } = await supabase
    .from('orders')
    .select('id, customer_name, total, created_at, status');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('ID Corto | Cliente | Total | Creado | Status');
  console.log('--------------------------------------------------');
  
  allOrders.forEach(o => {
    const isYesterday = !o.created_at.startsWith(TODAY_REF);
    const isTestLuca = o.customer_name === 'LUCA MODRI' && parseFloat(o.total) > 60000;
    
    if (isYesterday || isTestLuca || o.customer_name === 'Correa' || o.customer_name === 'rechazar') {
      console.log(`${o.id.slice(0,8)} | ${o.customer_name.padEnd(10)} | $${o.total.toString().padEnd(8)} | ${o.created_at} | ${o.status}`);
    }
  });
}

fullAudit();
