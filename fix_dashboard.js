const fs = require('fs');
const path = 'c:\\Users\\LENOVO\\Desktop\\app_movil\\MarketApp\\src\\screens\\AdminDashboardScreen.tsx';

try {
  let content = fs.readFileSync(path, 'utf8');

  // Regex para capturar el botón de rechazar completo independientemente de espacios o saltos de línea
  const oldCodeRegex = /<TouchableOpacity\s+style=\{\[styles\.atenderBtn,\s+\{\s+backgroundColor:\s+'#ef4444'\s+\}\]\}\s+onPress=\{.*?Alert\.alert\(.*?Rechazar Pedido.*?updateOrderStatus\(order\.id,\s+'Cancelado'\);.*?if\s+\(pendingOrders\.length\s+===\s+1\)\s+\{.*?setNotifModalVisible\(false\);.*?\}\s+\}\}\s+\]\s+\);\s+\}\}\s+>\s+<Text\s+style=\{styles\.atenderBtnText\}>Rechazar\s+.*?<\/Text>\s+<\/TouchableOpacity>/s;

  const newCode = `<TouchableOpacity 
                             style={[styles.atenderBtn, { backgroundColor: '#ef4444' }]} 
                             onPress={() => {
                               const performReject = async () => {
                                 // 1. ACTUALIZACIÓN OPTIMISTA ⚡ (Inyección inmediata)
                                 const updatedPending = pendingOrders.filter(p => p.id !== order.id);
                                 setPendingOrders(updatedPending);
                                 setOrders(prev => prev.filter(o => o.id !== order.id));
                                 
                                 // 2. Lógica de cierre corregida
                                 if (updatedPending.length === 0) {
                                   setNotifModalVisible(false);
                                 }
                                 
                                 // 3. Ejecución en segundo plano
                                 try { 
                                   await updateOrderStatus(order.id, 'Cancelado'); 
                                 } catch (e) { 
                                   console.error('Error background reject:', e); 
                                 }
                               };

                               if (Platform.OS === 'web') {
                                 if (window.confirm(\`¿Rechazar pedido #ORD-\${order.id.substring(0,6).toUpperCase()}?\`)) {
                                   performReject();
                                 }
                               } else {
                                 Alert.alert(
                                   "Rechazar Pedido",
                                   "¿Estás seguro de que deseas rechazar este pedido?",
                                   [
                                     { text: "No", style: "cancel" },
                                     { text: "Sí", style: "destructive", onPress: performReject }
                                   ]
                                 );
                               }
                             }}
                           >
                              <Text style={styles.atenderBtnText}>Rechazar ✕</Text>
                           </TouchableOpacity>`;

  if (oldCodeRegex.test(content)) {
    const newContent = content.replace(oldCodeRegex, newCode);
    fs.writeFileSync(path, newContent, 'utf8');
    console.log('SUCCESS: Dashboard updated with Fluid Rejection fix.');
  } else {
    console.error('ERROR: Could not find the rejection button code to replace. Regex mismatch.');
    // Fallback: buscar una versión más simple si la compleja falló
    const simplerRegex = /onPress=\{\(\)\s+=>\s+\{\s+Alert\.alert\(\s+"Rechazar Pedido",\s+"¿Estás seguro de que deseas rechazar este pedido\?",.*?\}\);/s;
    if (simplerRegex.test(content)) {
        console.log('Found with simpler regex, attempting replacement...');
        // (Podría intentar otra inyección aquí si la primera falla)
    }
  }
} catch (err) {
  console.error('SYSTEM ERROR:', err.message);
}
