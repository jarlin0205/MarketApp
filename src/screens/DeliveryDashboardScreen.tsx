import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator, 
  Alert,
  RefreshControl,
  ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function DeliveryDashboardScreen({ onLogout }: { onLogout: () => void }) {
  const user = useAuthStore(state => state.user);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ pending: 0, delivered: 0, totalCollected: 0 });

  const fetchDeliveryData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      // 1. Obtener órdenes asignables (Enviado) o ya entregadas por este repartidor
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`status.eq.Enviado,repartidor_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOrders(data || []);

      // 2. Calcular estadísticas
      const pending = (data || []).filter(o => o.status === 'Enviado').length;
      const myDeliveries = (data || []).filter(o => o.repartidor_id === user.id && o.status === 'Entregado');
      const deliveredCount = myDeliveries.length;
      const collected = myDeliveries.reduce((acc, curr) => acc + parseFloat(curr.total), 0);
      
      setStats({ pending, delivered: deliveredCount, totalCollected: collected });

    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliveryData();
  }, [user]);

  const handleMarkAsDelivered = async (orderId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'Entregado', 
          repartidor_id: user.id,
          delivered_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (error) throw error;
      
      Alert.alert("¡Éxito!", "Pedido marcado como entregado correctamente.");
      fetchDeliveryData();
    } catch (err: any) {
      Alert.alert("Error", err.message);
      setLoading(false);
    }
  };

  const renderOrderItem = ({ item }: { item: any }) => (
    <View style={[styles.orderCard, item.status === 'Entregado' && styles.deliveredCard]}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>#ORD-{item.id.substring(0, 6).toUpperCase()}</Text>
        <Text style={[styles.statusTag, item.status === 'Entregado' ? styles.statusDelivered : styles.statusPending]}>
          {item.status}
        </Text>
      </View>
      
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>👤 {item.customer_name}</Text>
        <Text style={styles.address}>📍 {item.delivery_address}</Text>
        <Text style={styles.neighborhood}>{item.neighborhood}</Text>
        <Text style={styles.phone}>📞 {item.phone_number}</Text>
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.totalLabel}>A recaudar:</Text>
        <Text style={styles.totalAmount}>${parseFloat(item.total).toLocaleString()}</Text>
      </View>

      {item.status === 'Enviado' && (
        <TouchableOpacity 
          style={styles.deliverBtn} 
          onPress={() => handleMarkAsDelivered(item.id)}
        >
          <Text style={styles.deliverBtnText}>ENTREGAR PEDIDO ✅</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Hola, Repartidor 👋</Text>
          <Text style={styles.dateText}>{new Date().toLocaleDateString()}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>📦</Text>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>✅</Text>
          <Text style={styles.statValue}>{stats.delivered}</Text>
          <Text style={styles.statLabel}>Entregados</Text>
        </View>
        <View style={[styles.statBox, { flex: 1.5 }]}>
          <Text style={styles.statEmoji}>💰</Text>
          <Text style={styles.statValue}>${stats.totalCollected.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Recaudado</Text>
        </View>
      </View>

      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Pedidos en Ruta</Text>
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          renderItem={renderOrderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDeliveryData(); }} colors={["#16a34a"]} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay pedidos por entregar actualmente.</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingTop: 60, 
    paddingBottom: 24 
  },
  welcomeText: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  dateText: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  logoutText: { color: '#ef4444', fontWeight: '700' },
  
  statsContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginBottom: 30 },
  statBox: { 
    flex: 1, 
    backgroundColor: '#1e293b', 
    padding: 16, 
    borderRadius: 24, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  statEmoji: { fontSize: 20, marginBottom: 8 },
  statValue: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 },

  listSection: { flex: 1, backgroundColor: '#f8fafc', borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 24, paddingTop: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  listContent: { paddingBottom: 40 },
  
  orderCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 16, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 3 
  },
  deliveredCard: { opacity: 0.7, backgroundColor: '#f1f5f9' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  orderId: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, fontSize: 10, fontWeight: '800' },
  statusPending: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  statusDelivered: { backgroundColor: '#dcfce7', color: '#16a34a' },
  
  customerInfo: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 16, marginBottom: 16 },
  customerName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  address: { fontSize: 14, color: '#334155', fontWeight: '600' },
  neighborhood: { fontSize: 13, color: '#64748b', marginTop: 2 },
  phone: { fontSize: 13, color: '#16a34a', fontWeight: '700', marginTop: 8 },

  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  totalLabel: { fontSize: 14, color: '#64748b' },
  totalAmount: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  
  deliverBtn: { backgroundColor: '#0f172a', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  deliverBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' }
});
