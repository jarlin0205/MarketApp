import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import LandingScreen from './src/screens/LandingScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import CartScreen from './src/screens/CartScreen';
import { Product } from './src/store/useCartStore';

import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import OrderStatusScreen from './src/screens/OrderStatusScreen';
import MyOrdersScreen from './src/screens/MyOrdersScreen';
import DeliveryDashboardScreen from './src/screens/DeliveryDashboardScreen';

import { supabase } from './src/lib/supabase';
import { useAuthStore } from './src/store/useAuthStore';
import { Audio } from 'expo-av';
import * as SecureStore from 'expo-secure-store';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Landing');
  const [selectedProduct, setSelectedProduct] = useState<Product| null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const role = useAuthStore(state => state.role);
  const setUser = useAuthStore(state => state.setUser);
  const [sessionRestored, setSessionRestored] = useState(false);

  // 🔄 RESTAURAR SESIÓN AL ABRIR LA APP
  useEffect(() => {
    const restoreSession = async () => {
      // 1. Intentar restaurar sesión de Supabase Auth (Admin/Cliente)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          const userRole = profile.role === 'admin' ? 'admin' : 'client';
          setUser({ ...session.user, ...profile }, userRole);
          setCurrentScreen(userRole === 'admin' ? 'AdminDashboard' : 'Home');
          setSessionRestored(true);
          return;
        }
      }

      // 2. Intentar restaurar sesión de Repartidor (SecureStore)
      try {
        const savedSession = await SecureStore.getItemAsync('repartidor_session');
        if (savedSession) {
          const { userData, savedRole, savedPassword } = JSON.parse(savedSession);
          // Verificar que el repartidor sigue activo en BD
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userData.id)
            .single();
          if (profile && profile.role === 'repartidor') {
            setUser({ ...userData, ...profile }, 'repartidor', savedPassword);
            setCurrentScreen('DeliveryDashboard');
          } else {
            // Repartidor ya no existe o fue removido, limpiar sesión
            await SecureStore.deleteItemAsync('repartidor_session');
          }
        }
      } catch (e) {
        console.log('No hay sesión de repartidor guardada');
      }

      setSessionRestored(true);
    };

    restoreSession();

    // Escuchar cambios de sesión de Supabase (login/logout automático)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        // No deslogueamos automáticamente, solo si el usuario toca "Salir"
        return;
      }
    });

    return () => subscription.unsubscribe();
  }, []);
  
  // Estados para la Notificación Global (Cliente)
  const [notifVisible, setNotifVisible] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [notifData, setNotifData] = useState<{ title: string, body: string, status: string } | null>(null);
  const [notifOrder, setNotifOrder] = useState<any>(null);
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Estados para Rechazo de Pedido v6.6 📦❌
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Estado para Badge Persistente del Admin 🛡️🔴
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);

  // Función de Sonido Premium 🔊
  const playNotifSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
        { shouldPlay: true }
      );
      await sound.playAsync();
    } catch (e) {
      console.log('Error playing sound:', e);
    }
  };

  // Consultar detalles del pedido para el modal
  const fetchOrderItems = async (orderId: string) => {
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          quantity,
          products (
            name,
            price
          )
        `)
        .eq('order_id', orderId);
      
      if (error) throw error;
      setNotifItems(data || []);
    } catch (e) {
      console.error('Error fetching notif items:', e);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!notifOrder) return;
    try {
       const { error } = await supabase
         .from('orders')
         .update({ status: 'Confirmado' })
         .eq('id', notifOrder.id);
       
       if (error) throw error;
       setNotifVisible(false);
       // Si estamos en MyOrders, el listener local de esa pantalla refrescará la lista
    } catch (e) {
       console.error('Error confirming receipt:', e);
    }
  };

  const handleRejectReceipt = async () => {
    if (!notifOrder || !rejectionReason.trim()) {
      const msg = "Por favor, indica el motivo del rechazo.";
      return Platform.OS === 'web' ? window.alert(msg) : Alert.alert("Error", msg);
    }
    
    try {
      setIsRejecting(true);
      console.log('📦 Reportando rechazo global para orden:', notifOrder.id);
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'No Recibido',
          client_rejection_reason: rejectionReason,
          client_rejected_at: new Date().toISOString(),
          client_viewed_status: true 
        })
        .eq('id', notifOrder.id);
      
      if (error) throw error;
      
      const successMsg = "El administrador ha sido notificado del motivo de tu rechazo.";
      if (Platform.OS === 'web') window.alert("Rechazo Registrado: " + successMsg);
      else Alert.alert("Rechazo Registrado", successMsg);

      setNotifVisible(false);
      setShowRejectionInput(false);
      setRejectionReason('');
    } catch (e: any) {
      console.error('❌ Error en handleRejectReceipt:', e);
      const errMsg = e.message || "No se pudo registrar el rechazo.";
      if (Platform.OS === 'web') window.alert("Error: " + errMsg);
      else Alert.alert("Error", errMsg);
    } finally {
      setIsRejecting(false);
    }
  };

  // NOTIFICACIONES GLOBALES EN TIEMPO REAL ⚡🌍
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-order-updates-v65')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updatedOrder = payload.new as any;
          
          if (!updatedOrder) return;

          // Solo notificar al cliente dueño del pedido
          if (updatedOrder.user_id !== user.id) return;

          // Definir mensajes según el nuevo estado
          const messages: { [key: string]: { title: string, body: string } } = {
            'Recibida': { title: "Pedido Aceptado ✅", body: "¡Buenas noticias! Tu pedido ha sido aceptado y ya se está procesando." },
            'Preparación': { title: "En Preparación 👨‍🍳", body: "Tu pedido ya se está empacando/preparando con cuidado." },
            'Enviado': { title: "¡Pedido en camino! 🛵🚀", body: "El repartidor ya lleva tu pedido. Prepárate para recibirlo." },
            'Entregado': { title: "¡Pedido Entregado! 📦✅", body: "Tu pedido ha llegado. Por favor, verifica el detalle abajo y confirma el recibido." },
            'Cancelado': { title: "Pedido No Disponible ❌", body: "Lo sentimos, tu pedido ha sido rechazado o no se puede procesar en este momento." },
          };

          const msg = messages[updatedOrder.status];
          if (msg) {
             setNotifData({ ...msg, status: updatedOrder.status });
             setNotifOrder(updatedOrder);
             setShowBanner(true);
             setUnreadCount(prev => prev + 1);
             playNotifSound();
             setTimeout(() => setShowBanner(false), 8000);
             if (updatedOrder.status === 'Entregado') {
                fetchOrderItems(updatedOrder.id);
             } else {
                setNotifItems([]);
             }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          // 🛡️ RADAR ADMIN: Solo el administrador recibe alertas de nuevas solicitudes
          if (role !== 'admin') return;

          const newOrder = payload.new as any;
          if (!newOrder) return;

          const adminMsg = {
            title: '🛒 ¡Nueva Solicitud Entrante!',
            body: `Cliente: ${newOrder.customer_name || 'Desconocido'} • $${parseFloat(newOrder.total || 0).toLocaleString()}`,
            status: 'admin_new_order'
          };

          setNotifData(adminMsg);
          setNotifOrder(newOrder);
          setShowBanner(true);
          setAdminUnreadCount(prev => prev + 1);
          playNotifSound();
          setTimeout(() => setShowBanner(false), 8000);
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado de Suscripción Realtime v6.5:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  return (
    <View style={{ flex: 1 }}>
      {/* BANNER DE NOTIFICACIÓN NO INTRUSIVO 🎈 */}
      {showBanner && (
        <TouchableOpacity 
          style={styles.floatingBanner} 
          onPress={() => { setShowBanner(false); setNotifVisible(true); }}
          activeOpacity={0.9}
        >
          <View style={styles.bannerIcon}>
            <Text style={{ fontSize: 20 }}>{notifData?.status === 'Cancelado' ? '❌' : '🔔'}</Text>
          </View>
          <View style={styles.bannerTextContent}>
            <Text style={styles.bannerTitle}>{notifData?.title}</Text>
            <Text style={styles.bannerBody} numberOfLines={1}>Toca para ver detalles...</Text>
          </View>
        </TouchableOpacity>
      )}

      {currentScreen === 'Landing' ? (
        <LandingScreen onNavigate={setCurrentScreen} />
      ) : null}
      
      {currentScreen === 'Home' ? (
        <HomeScreen 
          onProductPress={(p) => { setSelectedProduct(p); setCurrentScreen('ProductDetail'); }} 
          onNavigateToCart={() => setCurrentScreen('Cart')} 
          onNavigateToLanding={() => setCurrentScreen('Landing')}
          onNavigateToAdmin={() => setCurrentScreen('AdminDashboard')}
          onNavigate={setCurrentScreen}
          unreadCount={unreadCount}
          onResetUnread={() => setUnreadCount(0)}
        />
      ) : null}

      {currentScreen === 'AdminDashboard' ? (
        <AdminDashboardScreen 
           onBack={() => setCurrentScreen('Landing')} 
           onViewShop={() => setCurrentScreen('Home')}
           adminUnreadCount={adminUnreadCount}
           onResetAdminUnread={() => setAdminUnreadCount(0)}
        />
      ) : null}

      {currentScreen === 'DeliveryDashboard' ? (
        <DeliveryDashboardScreen onLogout={() => setCurrentScreen('Landing')} />
      ) : null}

      {currentScreen === 'MyOrders' ? (
        <MyOrdersScreen 
          onBack={() => setCurrentScreen('Home')}
          onEnterScreen={() => setUnreadCount(0)}
        />
      ) : null}
      
      {currentScreen === 'ProductDetail' ? (
        selectedProduct ? (
          <ProductDetailScreen 
            product={selectedProduct} 
            onBack={() => setCurrentScreen('Home')}
            onNavigateToCart={() => setCurrentScreen('Cart')}
          />
        ) : null
      ) : null}

      {currentScreen === 'Cart' ? (
        <CartScreen 
          onBack={() => setCurrentScreen('Home')}
          onOrderSuccess={(id) => {
            setLastOrderId(id);
            setCurrentScreen('OrderStatus');
          }}
        />
      ) : null}

      {currentScreen === 'OrderStatus' ? (
        lastOrderId ? (
          <OrderStatusScreen 
            orderId={lastOrderId} 
            onBack={() => setCurrentScreen('Home')} 
          />
        ) : null
      ) : null}
      
      {/* MODAL DE NOTIFICACIÓN GLOBAL 📢 */}
      <Modal visible={notifVisible} transparent animationType="fade">
        <View style={styles.notifOverlay}>
          <View style={styles.notifContent}>
            <Text style={styles.notifTitle}>{notifData?.title}</Text>
            <Text style={styles.notifBody}>{notifData?.body}</Text>

            {notifData?.status === 'Entregado' && (
              <View style={notifItems.length > 0 ? styles.detailBox : { padding: 10 }}>
                <Text style={styles.detailTitle}>Detalles del Pedido:</Text>
                {loadingItems ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : (
                  <ScrollView style={{ maxHeight: 200 }}>
                    {notifItems.map((item, idx) => (
                      <View key={idx} style={styles.detailItem}>
                        <Text style={styles.itemName}>{item.quantity}x {item.products?.name}</Text>
                        <Text style={styles.itemPrice}>${item.products?.price}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
                
                {!showRejectionInput ? (
                  <>
                    <TouchableOpacity style={styles.confirmNotifBtn} onPress={handleConfirmReceipt}>
                      <Text style={styles.confirmNotifBtnText}>Confirmar Recibido ✅</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.confirmNotifBtn, { backgroundColor: '#ef4444', marginTop: 10 }]} 
                      onPress={() => setShowRejectionInput(true)}
                    >
                      <Text style={styles.confirmNotifBtnText}>No Recibí el Pedido ❌</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ width: '100%', marginTop: 10 }}>
                    <Text style={[styles.detailTitle, { color: '#ef4444' }]}>Motivo del Rechazo:</Text>
                    <TextInput 
                      style={styles.rejectionInput}
                      placeholder="Ej: El pedido llegó incompleto, en mal estado..."
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                      <TouchableOpacity 
                        style={[styles.smallBtn, { flex: 1, backgroundColor: '#f1f5f9' }]} 
                        onPress={() => setShowRejectionInput(false)}
                      >
                        <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Volver</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.smallBtn, { flex: 2, backgroundColor: '#ef4444' }]} 
                        onPress={handleRejectReceipt}
                        disabled={isRejecting}
                      >
                        {isRejecting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Enviar Rechazo ✕</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity 
              style={styles.closeNotifBtn} 
              onPress={() => {
                setNotifVisible(false);
                setShowRejectionInput(false);
                setRejectionReason('');
              }}
            >
              <Text style={styles.closeNotifText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      <StatusBar style={currentScreen === 'Landing' ? "light" : "dark"} />
    </View>
  );
}

const styles = StyleSheet.create({
  notifOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  notifContent: { backgroundColor: '#fff', width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  notifTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 12, textAlign: 'center' },
  notifBody: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  detailBox: { width: '100%', backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  detailTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 },
  detailItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  itemPrice: { fontSize: 14, color: '#64748b' },
  confirmNotifBtn: { backgroundColor: '#16a34a', width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  confirmNotifBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  closeNotifBtn: { paddingVertical: 10 },
  closeNotifText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  
  // Estilos del Banner Flotante ✨
  floatingBanner: { 
    position: 'absolute', 
    top: 50, 
    left: 20, 
    right: 20, 
    backgroundColor: '#0f172a', 
    borderRadius: 20, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  bannerIcon: { width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bannerTextContent: { flex: 1 },
  bannerTitle: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  bannerBody: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  rejectionInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#fee2e2', borderRadius: 12, padding: 12, color: '#0f172a', textAlignVertical: 'top', minHeight: 80 },
  smallBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }
});