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
  Modal,
  ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function DeliveryDashboardScreen({ onLogout }: { onLogout: () => void }) {
  const user = useAuthStore(state => state.user);
  const password = useAuthStore(state => state.password);

  // ESTADOS PRINCIPALES
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ pending: 0, delivered: 0, rejected: 0, totalOrders: 0, totalCollected: 0, avgTime: 0 });
  const [shiftStatus, setShiftStatus] = useState<'active' | 'pending_closure'>('active');

  // ESTADOS DE MODALES
  const [showEndOfDayModal, setShowEndOfDayModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  // ESTADOS DE DATOS SECUNDARIOS
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<any | null>(null);
  const [settlementOrders, setSettlementOrders] = useState<any[]>([]);

  // NUEVOS ESTADOS DE LOGÍSTICA V6.2 🛵🔐
  const [activeTab, setActiveTab] = useState<'in_route' | 'delivered' | 'rejected'>('in_route');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);

  const DELIVERED_STATUSES = ['Entregado', 'Confirmado'];

  const fetchDeliveryData = async () => {
    if (!user || !password) return;
    try {
      const { data: ordersData, error: ordersError } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('repartidor_id', user.id)
        .order('shipped_at', { ascending: true });

      if (ordersError) throw new Error(ordersError.message || "Error al conectar con el servidor.");

      const ordersArray = Array.isArray(ordersData) ? ordersData : [];
      const currentOrders = ordersArray.filter((o: any) => !o.is_settled);
      setOrders(currentOrders);

      // Obtener estado del turno
      const { data: profData } = await (supabase as any).from('profiles').select('shift_status').eq('id', user.id).single();
      if (profData) setShiftStatus(profData.shift_status);

      const incompleteStatuses = ['Pendiente', 'Preparando', 'Enviado'];
      const pendingCount = currentOrders.filter((o: any) => incompleteStatuses.includes(o.status)).length;
      const myDeliveries = currentOrders.filter((o: any) => DELIVERED_STATUSES.includes(o.status));
      const rejectedOrders = currentOrders.filter((o: any) => o.status === 'No Recibido');
      const deliveredCount = myDeliveries.length;
      const rejectedCount = rejectedOrders.length;

      const collected = myDeliveries.reduce((acc: number, curr: any) => {
        const value = typeof curr.total === 'string'
          ? parseFloat(curr.total.replace(/[^0-9.]/g, ''))
          : parseFloat(curr.total || 0);
        return acc + (isNaN(value) ? 0 : value);
      }, 0);

      let totalMinutes = 0;
      let timedDeliveries = 0;
      myDeliveries.forEach((order: any) => {
        if (order.shipped_at && order.delivered_at) {
          const diff = new Date(order.delivered_at).getTime() - new Date(order.shipped_at).getTime();
          const minutes = Math.max(0, diff / 1000 / 60);
          totalMinutes += minutes;
          timedDeliveries += 1;
        }
      });
      const avgTime = timedDeliveries > 0 ? (totalMinutes / timedDeliveries) : 0;

      const totalOrders = pendingCount + deliveredCount + rejectedCount;

      setStats({ pending: pendingCount, delivered: deliveredCount, rejected: rejectedCount, totalOrders, totalCollected: collected, avgTime });

    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliveryData();

    if (!user) return;

    // Configuración de Tiempo Real ⚡
    console.log('📡 Activando Realtime para repartidor:', user.id);
    const channel = supabase
      .channel(`delivery_orders_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `repartidor_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log('🔔 Cambio detectado en pedido:', (payload.new as any).id, 'Status:', (payload.new as any).status);
          fetchDeliveryData();
        }
      )
      .subscribe();

    return () => {
      console.log('📴 Limpiando suscripción Realtime del repartidor');
      supabase.removeChannel(channel);
    };
  }, [user, password]);

  const handleMarkAsDelivered = async (orderId: string) => {
    if (!user) {
      Alert.alert("Error de Sesión", "No se detectó usuario activo.");
      return;
    }
    try {
      setIsDelivering(true);
      setDeliveryStatus("Conectando con el servidor...");
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('update_order_status_messenger', {
        p_order_id: orderId,
        p_new_status: 'Entregado',
        p_messenger_id: user.id,
        p_messenger_password: password || 'bypass'
      });
      if (rpcError) throw new Error(rpcError.message);
      if (rpcData?.error) throw new Error(rpcData.error);
      if (rpcData?.success) {
        setDeliveryStatus("ÉXITO: Pedido entregado correctamente ✅");
        await fetchDeliveryData();
      }
    } catch (err: any) {
      setDeliveryStatus(`ERROR: ${err.message}`);
    } finally {
      setIsDelivering(false);
    }
  };

  const openDeliveryConfirm = (order: any) => {
    setSelectedOrder(order);
    setDeliveryStatus(null);
    setConfirmModalVisible(true);
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await (supabase as any)
        .from('shift_settlements')
        .select('*')
        .eq('messenger_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
      setShowHistoryModal(true);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const viewSettlementDetails = async (settlement: any) => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('orders')
        .select('*, order_reviews(*)')
        .eq('settlement_id', settlement.id);
      if (error) throw error;
      setSelectedSettlement(settlement);
      setSettlementOrders(data || []);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      return '';
    }
  };

  // RENDER HELPERS
  const renderEndOfDayModal = () => (
    <Modal visible={showEndOfDayModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.eodModal}>
          <View style={styles.eodHeader}>
            <Text style={styles.eodTitle}>🌙 Cierre de Jornada</Text>
            <TouchableOpacity onPress={() => setShowEndOfDayModal(false)}>
              <Text style={styles.eodClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.eodSubtitle}>{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {stats.pending > 0 && (
              <View style={[styles.eodNote, { backgroundColor: '#fff7ed', borderColor: '#f97316', marginBottom: 15 }]}>
                <Text style={[styles.eodNoteText, { color: '#c2410c', fontWeight: 'bold' }]}>⚠️ Tienes {stats.pending} pedido(s) sin finalizar.</Text>
                <Text style={{ fontSize: 10, color: '#f97316', marginTop: 4 }}>
                  Debes entregarlos o reportarlos antes de solicitar el cierre oficial.
                </Text>
              </View>
            )}
            <View style={styles.eodRecaudoCard}>
              <Text style={styles.eodRecaudoLabel}>💰 Total a Entregar</Text>
              <Text style={styles.eodRecaudoValue}>${stats.totalCollected.toLocaleString('es-CO')}</Text>
            </View>
            <View style={styles.eodStatsRow}>
              <View style={[styles.eodStatBox, { borderColor: '#16a34a' }]}><Text style={styles.eodStatEmoji}>✅</Text><Text style={[styles.eodStatNum, { color: '#16a34a' }]}>{stats.delivered}</Text><Text style={styles.eodStatLbl}>Entregados</Text></View>
              <View style={[styles.eodStatBox, { borderColor: '#ef4444' }]}><Text style={styles.eodStatEmoji}>📦</Text><Text style={[styles.eodStatNum, { color: '#ef4444' }]}>{stats.rejected}</Text><Text style={styles.eodStatLbl}>Devoluciones</Text></View>
            </View>
            <View style={styles.eodNote}><Text style={styles.eodNoteText}>📋 Presenta este resumen al entregar el dinero.</Text></View>
          </ScrollView>
          <TouchableOpacity
            style={[styles.confirmEodBtn, (stats.delivered === 0 && stats.rejected === 0) && { opacity: 0.5 }]}
            disabled={(stats.delivered === 0 && stats.rejected === 0)}
            onPress={async () => {
              try {
                setLoading(true);
                const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)('request_shift_closure', {
                  p_messenger_id: user.id,
                  p_total_amount: stats.totalCollected,
                  p_orders_count: stats.delivered + stats.rejected
                });
                if (rpcErr) throw rpcErr;
                if (rpcRes?.success) {
                  Alert.alert("✅ Solicitud Enviada", "Entregue el dinero al administrador.");
                  setShowEndOfDayModal(false);
                  fetchDeliveryData();
                }
              } catch (e: any) { Alert.alert("Error", e.message); } finally { setLoading(false); }
            }}
          >
            <Text style={styles.confirmEodText}>{shiftStatus === 'active' ? 'SOLICITAR CIERRE 🛵' : 'ESPERANDO VALIDACIÓN... ⏳'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderHistoryModal = () => (
    <Modal visible={showHistoryModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { height: '85%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Historial 📑</Text>
            <TouchableOpacity onPress={() => { setShowHistoryModal(false); setSelectedSettlement(null); }}><Text style={{ fontSize: 24, color: '#0f172a' }}>✕</Text></TouchableOpacity>
          </View>
          {selectedSettlement ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity onPress={() => setSelectedSettlement(null)}><Text style={styles.backLinkText}>← Volver</Text></TouchableOpacity>
              <View style={styles.settlementSummaryBox}>
                <Text style={styles.summaryLabel}>Total: ${parseFloat(selectedSettlement.total_amount).toLocaleString()}</Text>
              </View>
              {settlementOrders.map(order => (
                <View key={order.id} style={styles.historyOrderCard}>
                  <Text style={styles.historyOrderClient}>{order.customer_name}</Text>
                  <Text style={styles.historyOrderAddress}>📍 {order.delivery_address}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <FlatList data={history} keyExtractor={item => item.id} renderItem={({ item }) => (
              <TouchableOpacity style={styles.historyItem} onPress={() => viewSettlementDetails(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>🗓️ {new Date(item.created_at).toLocaleDateString('es-CO')} - 🕒 {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  {item.status === 'approved' && (
                    <Text style={{ color: '#16a34a', fontSize: 10, fontWeight: '800', marginTop: 4 }}>✅ Cuadre de caja correcto perfectamente, jornada finalizada y cerrada</Text>
                  )}
                  {item.status === 'pending' && (
                    <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '800', marginTop: 4 }}>⏳ Esperando validación del administrador</Text>
                  )}
                </View>
                <Text style={styles.historyAmount}>${parseFloat(item.total_amount).toLocaleString()}</Text>
              </TouchableOpacity>
            )} />
          )}
        </View>
      </View>
    </Modal>
  );

  const renderOrderItem = ({ item }: { item: any }) => (
    <View style={[styles.orderCard, DELIVERED_STATUSES.includes(item.status) && styles.deliveredCard]}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>#ORD-{item.id.substring(0, 6).toUpperCase()}</Text>
        <View style={[styles.statusTag, item.status === 'Confirmado' ? styles.statusConfirmed : DELIVERED_STATUSES.includes(item.status) ? styles.statusDelivered : styles.statusPending]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>👤 {item.customer_name}</Text>
        <Text style={styles.address}>📍 {item.delivery_address}</Text>
        <Text style={styles.phone}>📞 {item.phone_number}</Text>
      </View>
      <View style={styles.orderFooter}>
        <Text style={styles.totalAmount}>${parseFloat(item.total).toLocaleString()}</Text>
        {item.status === 'Enviado' && item.shipped_at && (
          <Text style={{ fontSize: 11, color: '#4338ca', fontWeight: '800' }}>🚀 DESPACHADO: {formatTime(item.shipped_at)}</Text>
        )}
        {(item.status === 'Entregado' || item.status === 'Confirmado') && item.delivered_at && (
          <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '800' }}>✅ ENTREGADO: {formatTime(item.delivered_at)}</Text>
        )}
      </View>

      {item.status === 'No Recibido' && (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionLabel}>Motivo del Cliente ✕</Text>
          <Text style={styles.rejectionText}>"{item.client_rejection_reason || 'Sin motivo especificado'}"</Text>
          <Text style={styles.rejectionTime}>{formatTime(item.client_rejected_at)}</Text>
        </View>
      )}

      {item.status === 'Enviado' && (
        <TouchableOpacity style={styles.deliverBtn} onPress={() => openDeliveryConfirm(item)}><Text style={styles.deliverBtnText}>ENTREGAR ✅</Text></TouchableOpacity>
      )}
    </View>
  );

  const renderDeliveryConfirmModal = () => (
    <Modal visible={confirmModalVisible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.confirmDialog}>
          <Text style={styles.confirmIcon}>{isDelivering ? '⏳' : (deliveryStatus?.includes('ÉXITO') ? '✅' : '📦')}</Text>
          <Text style={styles.confirmTitle}>{isDelivering ? 'PROCESANDO...' : (deliveryStatus?.includes('ÉXITO') ? '¡CONFIRMADO!' : '¿CONFIRMAR ENTREGA? (v6.3)')}</Text>
          {deliveryStatus && <Text style={[styles.confirmSubtitle, { color: deliveryStatus.includes('ERROR') ? '#f43f5e' : '#22c55e', fontWeight: 'bold' }]}>{deliveryStatus}</Text>}
          {!deliveryStatus && <Text style={styles.confirmSubtitle}>Marcar pedido de {selectedOrder?.customer_name} como entregado.</Text>}
          <View style={styles.confirmActions}>
            {!isDelivering && !deliveryStatus?.includes('ÉXITO') && (
              <>
                <TouchableOpacity style={styles.cancelConfirmBtn} onPress={() => setConfirmModalVisible(false)}><Text style={styles.cancelConfirmText}>Cerrar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.confirmActionBtn, { backgroundColor: '#22c55e' }]} onPress={() => handleMarkAsDelivered(selectedOrder?.id)}><Text style={styles.confirmActionText}>Sí, Entregar</Text></TouchableOpacity>
              </>
            )}
            {deliveryStatus?.includes('ÉXITO') && (
              <TouchableOpacity style={[styles.confirmActionBtn, { backgroundColor: '#10b981', flex: 1 }]} onPress={() => { setConfirmModalVisible(false); setDeliveryStatus(null); }}><Text style={styles.confirmActionText}>ENTENDIDO ✅</Text></TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  // MAIN RETURN
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Hola, {user?.full_name || 'Repartidor'} 👋</Text>
          <TouchableOpacity onPress={fetchHistory}><Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: 'bold' }}>📜 VER HISTORIAL</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}><Text style={styles.logoutText}>Salir</Text></TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statBox, { width: '23%' }]}><Text style={styles.statValue}>{stats.totalOrders}</Text><Text style={styles.statLabel}>Total</Text></View>
        <View style={[styles.statBox, { width: '23%' }]}><Text style={[styles.statValue, { color: '#fbbf24' }]}>{stats.pending}</Text><Text style={styles.statLabel}>Ruta</Text></View>
        <View style={[styles.statBox, { width: '23%', borderColor: '#10b981', borderWidth: 1 }]}><Text style={[styles.statValue, { color: '#10b981' }]}>{stats.delivered}</Text><Text style={styles.statLabel}>Listo</Text></View>
        <View style={[styles.statBox, { width: '23%', borderColor: '#f43f5e', borderWidth: 1 }]}><Text style={[styles.statValue, { color: '#f43f5e' }]}>{stats.rejected}</Text><Text style={styles.statLabel}>Rechazados</Text></View>
      </View>

      <View style={[styles.statsContainer, { marginTop: -10 }]}>
        <View style={[styles.statBox, { width: '48%', flexDirection: 'column', gap: 2 }]}>
          <Text style={styles.statLabel}>💰 RECAUDO</Text>
          <Text style={[styles.statValue, { fontSize: 18, color: '#f59e0b' }]}>${stats.totalCollected.toLocaleString()}</Text>
        </View>
        <View style={[styles.statBox, { width: '48%', flexDirection: 'column', gap: 2 }]}>
          <Text style={styles.statLabel}>⚡ TIEMPO PROM.</Text>
          <Text style={[styles.statValue, { fontSize: 18, color: '#fbbf24' }]}>{Math.round(stats.avgTime)} min</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.endOfDayBtn} onPress={() => setShowEndOfDayModal(true)}>
        <Text style={styles.endOfDayEmoji}>🌙</Text>
        <Text style={styles.endOfDayText}>{shiftStatus === 'pending_closure' ? 'PENDIENTE DE VALIDACIÓN' : 'FINALIZAR JORNADA'}</Text>
      </TouchableOpacity>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'in_route' && styles.tabButtonActive]} onPress={() => setActiveTab('in_route')}><Text style={[styles.tabText, activeTab === 'in_route' && styles.tabTextActive]}>RUTA</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'delivered' && styles.tabButtonActive]} onPress={() => setActiveTab('delivered')}><Text style={[styles.tabText, activeTab === 'delivered' && styles.tabTextActive]}>LISTO</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'rejected' && styles.tabButtonActive]} onPress={() => setActiveTab('rejected')}><Text style={[styles.tabText, activeTab === 'rejected' && styles.tabTextActive]}>NO RECIBIDOS ✕</Text></TouchableOpacity>
      </View>

      <View style={styles.listSection}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDeliveryData} colors={["#16a34a"]} />}>
          {orders.filter(o => {
            if (activeTab === 'in_route') return o.status === 'Enviado';
            if (activeTab === 'delivered') return DELIVERED_STATUSES.includes(o.status);
            if (activeTab === 'rejected') return o.status === 'No Recibido';
            return false;
          }).map(order => (
            <View key={order.id}>{renderOrderItem({ item: order })}</View>
          ))}
        </ScrollView>
      </View>

      {renderEndOfDayModal()}
      {renderHistoryModal()}
      {renderDeliveryConfirmModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  welcomeText: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  logoutText: { color: '#ef4444', fontWeight: '700' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 20 },
  statBox: { width: '31%', backgroundColor: '#1e293b', padding: 15, borderRadius: 20, alignItems: 'center' },
  statValue: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 10, fontWeight: '600' },
  endOfDayBtn: { marginHorizontal: 24, marginBottom: 20, backgroundColor: '#1e293b', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f59e0b' },
  endOfDayEmoji: { fontSize: 20, marginRight: 10 },
  endOfDayText: { color: '#f59e0b', fontWeight: '900', fontSize: 13 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#1e293b', marginHorizontal: 24, borderRadius: 16, padding: 4, marginBottom: 16 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabButtonActive: { backgroundColor: '#0f172a' },
  tabText: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: '#ffffff' },
  listSection: { flex: 1, backgroundColor: '#f8fafc', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 24 },
  orderCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  orderId: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  statusPending: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  statusDelivered: { backgroundColor: '#dcfce7', color: '#16a34a' },
  statusConfirmed: { backgroundColor: '#bbf7d0', color: '#14532d' },
  statusRejected: { backgroundColor: '#fee2e2', color: '#ef4444' },
  rejectionBox: { backgroundColor: '#fff1f2', padding: 12, borderRadius: 16, marginTop: 10, borderWidth: 1, borderColor: '#fecaca' },
  rejectionLabel: { fontSize: 10, fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', marginBottom: 4 },
  rejectionText: { fontSize: 14, color: '#7f1d1d', fontStyle: 'italic', lineHeight: 18 },
  rejectionTime: { fontSize: 10, color: '#94a3b8', marginTop: 8, textAlign: 'right' },
  customerInfo: { marginBottom: 16 },
  customerName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  address: { fontSize: 13, color: '#64748b' },
  phone: { fontSize: 13, color: '#16a34a', fontWeight: 'bold' },
  orderFooter: { marginBottom: 16 },
  totalAmount: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  deliverBtn: { backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  deliverBtnText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' },
  confirmDialog: { backgroundColor: '#fff', marginHorizontal: 32, padding: 32, borderRadius: 32, alignItems: 'center' },
  confirmIcon: { fontSize: 40, marginBottom: 16 },
  confirmTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  confirmSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginVertical: 16 },
  confirmActions: { flexDirection: 'row', gap: 12 },
  confirmActionBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  confirmActionText: { color: '#fff', fontWeight: 'bold' },
  cancelConfirmBtn: { paddingVertical: 12 },
  cancelConfirmText: { color: '#94a3b8' },
  modalContent: { backgroundColor: '#fff', borderRadius: 32, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  settlementSummaryBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, marginBottom: 16 },
  summaryLabel: { fontSize: 16, fontWeight: 'bold' },
  historyItem: { padding: 16, backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 12 },
  historyDate: { fontWeight: 'bold', color: '#0f172a' },
  historyAmount: { color: '#16a34a', fontWeight: 'bold' },
  historyOrderCard: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  historyOrderClient: { fontWeight: 'bold', color: '#0f172a' },
  historyOrderAddress: { fontSize: 12, color: '#64748b' },
  backLinkText: { color: '#2563eb', fontWeight: 'bold', marginBottom: 15 },
  deliveredCard: { opacity: 0.8, backgroundColor: '#f8fafc' },
  eodModal: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 32, padding: 24, maxHeight: '80%' },
  eodHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  eodTitle: { fontSize: 22, fontWeight: 'bold' },
  eodClose: { fontSize: 20 },
  eodSubtitle: { color: '#64748b', marginBottom: 20 },
  eodRecaudoCard: { backgroundColor: '#f59e0b', padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 16 },
  eodRecaudoLabel: { color: '#fff', fontWeight: 'bold' },
  eodRecaudoValue: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  eodStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  eodStatBox: { width: '48%', borderWidth: 1, borderRadius: 16, padding: 10, alignItems: 'center' },
  eodStatEmoji: { fontSize: 20 },
  eodStatNum: { fontSize: 24, fontWeight: 'bold' },
  eodStatLbl: { fontSize: 12 },
  eodNote: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 12 },
  eodNoteText: { fontSize: 12, color: '#92400e' },
  confirmEodBtn: { backgroundColor: '#16a34a', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  confirmEodText: { color: '#fff', fontWeight: 'bold' }
});
