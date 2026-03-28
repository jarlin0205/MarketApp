import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar, 
  Platform, 
  ActivityIndicator, 
  RefreshControl,
  Modal,
  TextInput,
  Alert
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import OrderStatusView from '../components/OrderStatusView';

interface MyOrdersScreenProps {
  onBack: () => void;
  onEnterScreen?: () => void;
}

export default function MyOrdersScreen({ onBack, onEnterScreen }: MyOrdersScreenProps) {
  const user = useAuthStore(state => state.user);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal States
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderDetails, setOrderDetails] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // Estados para evaluación
  const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewOrder, setReviewOrder] = useState<any>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [activeModal, setActiveModal] = useState<'details' | 'status' | null>(null);
  const [dismissedReviewId, setDismissedReviewId] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Incluimos check de reviews para no repetir el modal
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_reviews(id)')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // ORDENAMIENTO INTELIGENTE v6.4.1 🚚📈
      // Jerarquía: 
      // 1. Entregado (Pendiente de firma del cliente)
      // 2. Enviado (En ruta)
      // 3. Otros por fecha desc
      const sortedOrders = (data || []).sort((a: any, b: any) => {
        const isEntregadoA = a.status === 'Entregado' && !a.client_confirmed_at;
        const isEntregadoB = b.status === 'Entregado' && !b.client_confirmed_at;
        
        if (isEntregadoA && !isEntregadoB) return -1;
        if (!isEntregadoA && isEntregadoB) return 1;
        
        if (a.status === 'Enviado' && b.status !== 'Enviado') return -1;
        if (a.status !== 'Enviado' && b.status === 'Enviado') return 1;
        
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setOrders(sortedOrders);
    } catch (error) {
      console.error('Error fetching my orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    try {
      setDetailsLoading(true);
      const { data, error } = await supabase
        .from('order_items')
        .select('*, products(name, image_url)')
        .eq('order_id', orderId);
      
      if (error) throw error;
      setOrderDetails(data || []);
    } catch (err) {
      console.error("Error fetching items:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    if (onEnterScreen) onEnterScreen();

    if (!user) return;

    // Suscripción en tiempo real de Alta Velocidad (v4 - Filtro Cliente) 🚀
    const channel = supabase
      .channel(`client-live-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
          // Filtro removido de aquí para evitar pérdida de señal por Replica Identity
        },
        (payload) => {
          const updatedOrder = payload.new as any;
          
          // FILTRO MANUAL: Solo procesar si el pedido pertenece a este usuario
          if (updatedOrder && updatedOrder.user_id !== user.id) return;

          console.log('📱 Cambio en pedido detectado para cliente:', payload.eventType, 'Status:', updatedOrder?.status);
          
          if (payload.eventType === 'INSERT') {
             setOrders(current => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
             setOrders(current =>
               current.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)
             );

             // Notificación centralizada en App.tsx. ✨
             if (updatedOrder.status === 'Cancelado') {
                console.log('🚫 Info: Pedido Cancelado detectado (Alerta manejada por App.tsx)');
             }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const markAsSeen = async (orderId: string) => {
    try {
      await supabase
        .from('orders')
        .update({ client_viewed_status: true })
        .eq('id', orderId);
      
      // Actualizar estado local para quitar el badge inmediatamente
      setOrders(current => current.map(o => o.id === orderId ? { ...o, client_viewed_status: true } : o));
    } catch (err) {
      console.error("Error marking as seen:", err);
    }
  };

  const handleOpenDetails = (order: any) => {
    setSelectedOrder(order);
    fetchOrderItems(order.id);
    setActiveModal('details');
    if (!order.client_viewed_status) {
      markAsSeen(order.id);
    }
  };

  const handleOpenStatus = (order: any) => {
    setSelectedOrder(order);
    setActiveModal('status');
    if (!order.client_viewed_status) {
      markAsSeen(order.id);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Pendiente': return styles.statusPending;
      case 'Recibida': return styles.statusReceived;
      case 'Preparación': return styles.statusPreparing;
      case 'Enviado': return styles.statusShipped;
      case 'Entregado': return selectedOrder?.client_confirmed_at ? styles.statusConfirmed : styles.statusDone;
      default: return styles.statusPending;
    }
  };

  const renderDetailsModal = () => (
    <Modal visible={activeModal === 'details'} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
         <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>Detalles del Pedido 🧾</Text>
               <TouchableOpacity onPress={() => setActiveModal(null)}><Text style={{ fontSize: 24 }}>✕</Text></TouchableOpacity>
            </View>
            
            {detailsLoading ? (
              <ActivityIndicator color="#16a34a" size="large" style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.orderSummaryStrip}>
                   <Text style={styles.summaryLabel}>Estado Actual:</Text>
                   <Text style={[styles.statusBadge, getStatusStyle(selectedOrder?.status)]}>{selectedOrder?.status}</Text>
                </View>

                <Text style={styles.sectionHeading}>
                  {selectedOrder?.status === 'Pendiente' ? 'Productos Solicitados' : 'Preparación del Pedido'}
                </Text>

                {orderDetails.map((item) => (
                  <View key={item.id} style={styles.detailItemRow}>
                    <View style={{ flex: 1 }}>
                       <Text style={styles.detailItemName}>
                          {item.fulfilled_quantity}x {item.products?.name}
                       </Text>
                       {item.fulfilled_quantity < item.quantity && (
                          <Text style={styles.originalQty}>Solicitado original: {item.quantity}</Text>
                       )}
                       <Text style={styles.detailItemPrice}>
                          ${(parseFloat(item.price) * item.fulfilled_quantity).toLocaleString()}
                       </Text>
                    </View>
                    
                    {selectedOrder?.status !== 'Pendiente' ? (
                       <View style={[
                         styles.fulfillmentBadge, 
                         item.fulfilled_quantity === item.quantity ? styles.fulfilledBg : (item.fulfilled_quantity > 0 ? styles.partialBg : styles.missingBg)
                       ]}>
                          <Text style={item.fulfilled_quantity === item.quantity ? styles.fulfilledText : (item.fulfilled_quantity > 0 ? styles.partialText : styles.missingText)}>
                             {item.fulfilled_quantity === item.quantity ? '✅ Despachado' : (item.fulfilled_quantity > 0 ? `⚠️ Parcial (${item.fulfilled_quantity})` : '❌ Agotado')}
                          </Text>
                       </View>
                    ) : null}
                  </View>
                ))}

                <View style={styles.deliveryInfoBlock}>
                   <Text style={styles.sectionHeading}>Dirección de Entrega 📍</Text>
                   <Text style={styles.deliveryText}>{selectedOrder?.delivery_address}</Text>
                   <Text style={styles.deliverySubtext}>{selectedOrder?.neighborhood}</Text>
                   <Text style={styles.deliverySubtext}>Tel: {selectedOrder?.phone_number}</Text>
                </View>

                {selectedOrder?.notes ? (
                  <View style={styles.adminNotesBlock}>
                     <Text style={styles.adminNotesTitle}>Nota del Administrador:</Text>
                     <Text style={styles.adminNotesText}>{selectedOrder.notes}</Text>
                  </View>
                ) : null}

                <View style={styles.modalTotalRow}>
                   <Text style={styles.modalTotalLabel}>Total Pagado</Text>
                   <Text style={styles.modalTotalValue}>${parseFloat(selectedOrder?.total || 0).toLocaleString()}</Text>
                </View>
              </ScrollView>
            )}
            
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setActiveModal(null)}>
               <Text style={styles.closeModalBtnText}>Cerrar</Text>
            </TouchableOpacity>
         </View>
      </View>
    </Modal>
  );

  const saveReview = async () => {
    if (!user || !reviewOrder) return;
    try {
      setSavingReview(true);
      
      // 1. Guardar la reseña
      const { error: revError } = await supabase
        .from('order_reviews')
        .insert({
          order_id: reviewOrder.id,
          user_id: user.id,
          rating: rating,
          comment: comment
        });
      if (revError) throw revError;

      // 2. IMPORTANTE: Guardar confirmación del cliente y pasar a estado terminal "Confirmado"
      const { error: ordError } = await supabase
        .from('orders')
        .update({ 
          status: 'Confirmado',
          client_confirmed_at: new Date().toISOString(),
          client_viewed_status: true 
        })
        .eq('id', reviewOrder.id);
      if (ordError) throw ordError;
      
      Alert.alert("¡Pedido Confirmado!", "Gracias por confirmar la recepción. Tu opinión nos ayuda a mejorar.");
      setIsReviewModalVisible(false);
      fetchOrders();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSavingReview(false);
    }
  };

  const renderReviewModal = () => (
    <Modal visible={isReviewModalVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
         <View style={[styles.reviewModalContent]}>
            <View style={styles.reviewModalHeader}>
               <View style={{ width: 24 }} /> 
               <Text style={styles.reviewModalTitle}>📦 ¿Recibiste tu pedido?</Text>
               <TouchableOpacity onPress={() => { setDismissedReviewId(reviewOrder?.id); setIsReviewModalVisible(false); }}>
                  <Text style={{ fontSize: 24, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
               </TouchableOpacity>
            </View>
            <Text style={styles.reviewModalSubtitle}>Confirma que ya tienes tus productos y califica nuestro servicio:</Text>
            
            <View style={styles.starsRow}>
               {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setRating(s)}>
                     <Text style={[styles.starIcon, rating >= s ? styles.starActive : styles.starInactive]}>
                        ⭐
                     </Text>
                  </TouchableOpacity>
               ))}
            </View>

            <TextInput
               style={styles.commentInput}
               placeholder="Cuéntanos más... (opcional)"
               multiline
               numberOfLines={4}
               value={comment}
               onChangeText={setComment}
            />

            <TouchableOpacity 
               style={[styles.submitReviewBtn, savingReview && styles.btnDisabled]} 
               onPress={saveReview}
               disabled={savingReview}
            >
               {savingReview ? (
                 <ActivityIndicator color="#fff" />
               ) : (
                 <Text style={styles.submitReviewText}>Confirmar Recibido y Evaluar</Text>
               )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => setIsReviewModalVisible(false)}>
               <Text style={styles.skipBtnText}>Ahora no</Text>
            </TouchableOpacity>
         </View>
      </View>
    </Modal>
  );

  const renderStatusModal = () => (
    <Modal visible={activeModal === 'status'} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
         <View style={[styles.modalContent, { height: '85%' }]}>
            <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>Seguimiento en Vivo 🛵</Text>
               <TouchableOpacity onPress={() => setActiveModal(null)}><Text style={{ fontSize: 24 }}>✕</Text></TouchableOpacity>
            </View>
            <OrderStatusView orderId={selectedOrder?.id} />
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setActiveModal(null)}>
               <Text style={styles.closeModalBtnText}>Entendido</Text>
            </TouchableOpacity>
         </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
          <Text style={styles.iconEmoji}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Pedidos</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#16a34a"]} />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 100 }} />
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 60, marginBottom: 20 }}>📦</Text>
            <Text style={styles.emptyTitle}>Aún no tienes pedidos</Text>
            <Text style={styles.emptySubtitle}>Cuando realices una compra, aparecerá aquí para que puedas seguirla en tiempo real.</Text>
            <TouchableOpacity style={styles.startShoppingBtn} onPress={onBack}>
              <Text style={styles.startShoppingText}>Ir a la tienda</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={[styles.orderCard, !order.client_viewed_status && styles.orderCardUnread]}>
              {!order.client_viewed_status ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>¡ACTUALIZADO!</Text>
                </View>
              ) : null}
              <View style={styles.orderMain}>
                 <View>
                    <Text style={styles.orderId}>#ORD-{order.id.substring(0, 6).toUpperCase()}</Text>
                    {order.customer_name ? (
                       <Text style={styles.customerName}>👤 {order.customer_name}</Text>
                    ) : null}
                    <Text style={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                 </View>
                 <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.statusBadge, getStatusStyle(order.status === 'Entregado' && order.client_confirmed_at ? 'Confirmado' : order.status)]}>
                       {order.status === 'Entregado' && order.client_confirmed_at ? 'Confirmado ✅' : order.status}
                    </Text>
                    {order.client_confirmed_at && (
                       <Text style={styles.confirmedDate}>Recibido el {new Date(order.client_confirmed_at).toLocaleDateString()}</Text>
                    )}
                 </View>
              </View>
              
              <View style={styles.orderFooter}>
                 <Text style={styles.totalLabel}>Total del pedido</Text>
                 <Text style={styles.totalValue}>${parseFloat(order.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>

              <View style={styles.cardActions}>
                 <TouchableOpacity style={styles.detailBtn} onPress={() => handleOpenDetails(order)}>
                    <Text style={styles.detailBtnText}>Ver Detalles</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.statusBtn} onPress={() => handleOpenStatus(order)}>
                    <Text style={styles.statusBtnText}>Estado de Pedido</Text>
                 </TouchableOpacity>
              </View>

              {order.status === 'Entregado' && !order.client_confirmed_at && (
                <TouchableOpacity 
                   style={styles.manualReviewBtn} 
                   onPress={() => { setReviewOrder(order); setIsReviewModalVisible(true); }}
                >
                   <Text style={styles.manualReviewBtnText}>⭐ Calificar mi Pedido</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {renderDetailsModal()}
      {renderStatusModal()}
      {renderReviewModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'ios' ? 50 : 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  iconBtn: { backgroundColor: '#ffffff', padding: 12, borderRadius: 50, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  iconEmoji: { fontSize: 20 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', paddingHorizontal: 40, marginBottom: 30 },
  startShoppingBtn: { backgroundColor: '#16a34a', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  startShoppingText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  orderCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, position: 'relative' },
  orderCardUnread: { borderColor: '#3b82f6', borderWidth: 2, backgroundColor: '#f0f7ff' },
  unreadBadge: { position: 'absolute', top: -10, right: 20, backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, zIndex: 10 },
  unreadBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  orderMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  orderDate: { fontSize: 13, color: '#64748b', marginTop: 4 },
  customerName: { fontSize: 14, fontWeight: '700', color: '#16a34a', marginTop: 2, marginBottom: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  statusPending: { backgroundColor: '#e2e8f0', color: '#64748b' },
  statusReceived: { backgroundColor: '#dcfce7', color: '#16a34a' },
  statusPreparing: { backgroundColor: '#fef3c7', color: '#d97706' },
  statusShipped: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  statusDone: { backgroundColor: '#fef2f2', color: '#dc2626' }, // Entregado por repartidor (esperando cliente)
  statusConfirmed: { backgroundColor: '#dcfce7', color: '#16a34a' }, // Final
  confirmedDate: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  partialBg: { backgroundColor: '#fff7ed' },
  partialText: { color: '#c2410c' },
  originalQty: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  totalLabel: { fontSize: 14, color: '#64748b' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  detailBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  detailBtnText: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  statusBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#0f172a', alignItems: 'center' },
  statusBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  reviewModalContent: { backgroundColor: '#ffffff', borderRadius: 32, padding: 30, width: '90%', alignItems: 'center', alignSelf: 'center', marginBottom: '20%' },
  reviewModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 },
  reviewModalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'center', flex: 1 },
  reviewModalSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 25 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  starIcon: { fontSize: 40 },
  starActive: { opacity: 1 },
  starInactive: { opacity: 0.3 },
  commentInput: { width: '100%', backgroundColor: '#f8fafc', borderRadius: 16, padding: 15, fontSize: 14, color: '#0f172a', minHeight: 100, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  submitReviewBtn: { width: '100%', backgroundColor: '#16a34a', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  submitReviewText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  skipBtn: { marginTop: 15 },
  skipBtnText: { color: '#94a3b8', fontWeight: '600' },
  btnDisabled: { opacity: 0.7 },
  orderSummaryStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, backgroundColor: '#f8fafc', padding: 15, borderRadius: 16 },
  summaryLabel: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  sectionHeading: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginVertical: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailItemName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  detailItemPrice: { fontSize: 13, color: '#64748b', marginTop: 2 },
  fulfillmentBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  fulfilledBg: { backgroundColor: '#dcfce7' },
  missingBg: { backgroundColor: '#fff1f2' },
  fulfilledText: { color: '#16a34a', fontSize: 11, fontWeight: '700' },
  missingText: { color: '#e11d48', fontSize: 11, fontWeight: '700' },
  deliveryInfoBlock: { marginTop: 20, padding: 15, backgroundColor: '#f8fafc', borderRadius: 16 },
  deliveryText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  deliverySubtext: { fontSize: 13, color: '#64748b', marginTop: 4 },
  adminNotesBlock: { marginTop: 20, padding: 15, backgroundColor: '#fffbeb', borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  adminNotesTitle: { fontSize: 13, fontWeight: '800', color: '#b45309', marginBottom: 4 },
  adminNotesText: { fontSize: 13, color: '#d97706', fontStyle: 'italic' },
  modalTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, paddingTop: 20, borderTopWidth: 2, borderTopColor: '#f1f5f9' },
  modalTotalLabel: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  modalTotalValue: { fontSize: 24, fontWeight: '900', color: '#16a34a' },
  closeModalBtn: { backgroundColor: '#0f172a', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 30 },
  closeModalBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  manualReviewBtn: { backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  manualReviewBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 }
});
