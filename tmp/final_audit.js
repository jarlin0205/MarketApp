const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rofrdxjvriirweyddxqw.supabase.co', 'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR');

async function audit() {
  console.log('--- INVENTARIO TOTAL DE PEDIDOS ---');
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customer_name, total, created_at, status');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const results = orders
    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
    .map(o => `${o.id.slice(0, 8)} | ${o.customer_name.padEnd(15)} | $${o.total.toString().padEnd(10)} | ${o.status.padEnd(12)} | ${o.created_at}`);

  console.log('ID       | CLIENTE         | TOTAL       | STATUS       | FECHA');
  results.forEach(r => console.log(r));
}

audit();
