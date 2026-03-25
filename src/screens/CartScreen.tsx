import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, StatusBar, Platform, ActivityIndicator, Alert } from 'react-native';
import { useCartStore } from '../store/useCartStore';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

interface CartScreenProps {
  onBack: () => void;
  onCheckout: () => void;
}

export default function CartScreen({ onBack, onCheckout }: CartScreenProps) {
  const { items, removeItem, updateQuantity, getCartTotal, clearCart } = useCartStore();
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = React.useState(false);

  const handleCheckout = async () => {
    if (!user) return Alert.alert("Inicio de Sesión Requerido", "Debes iniciar sesión para realizar una compra.");
    if (items.length === 0) return;

    setLoading(true);
    try {
      // 1. Crear el registro de la orden principal
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{ 
          user_id: user.id, 
          total: getCartTotal(),
          status: 'Pendiente'
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Crear los ítems de la orden (bulk insert)
      const orderItems = items.map(item => ({
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.quantity,
        price_at_purchase: item.priceValue
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      Alert.alert("¡Compra Exitosa!", "Tu pedido ha sido registrado correctamente.");
      clearCart();
      onBack(); // Regresar al Home
    } catch (error: any) {
      console.error('Error in checkout:', error);
      Alert.alert("Error en el pago", error.message || "No se pudo procesar la orden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
          <Text style={styles.iconEmoji}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Carrito</Text>
        <View style={{ width: 44 }} /> {/* Spacer */}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 60, marginBottom: 20 }}>🛍️</Text>
            <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
            <Text style={styles.emptySubtitle}>Descubre productos premium y añádelos aquí.</Text>
            <TouchableOpacity style={styles.startShoppingBtn} onPress={onBack}>
              <Text style={styles.startShoppingText}>Empezar a comprar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.cartItem}>
              <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
              <View style={styles.itemInfo}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                     <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemPrice}>{item.price}</Text>

                <View style={styles.quantityControl}>
                  <TouchableOpacity 
                     style={styles.qtyBtn} 
                     onPress={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity 
                     style={styles.qtyBtn} 
                     onPress={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Checkout Bar */}
      {items.length > 0 && (
        <View style={styles.bottomBar}>
           <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total ({items.reduce((acc, item) => acc + item.quantity, 0)} items)</Text>
              <Text style={styles.totalPrice}>${getCartTotal().toFixed(2)}</Text>
           </View>
           <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutBtnText}>Proceder al Pago →</Text>}
           </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'ios' ? 50 : 30 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  iconBtn: { backgroundColor: '#ffffff', padding: 12, borderRadius: 50, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  iconEmoji: { fontSize: 20 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', paddingHorizontal: 40, marginBottom: 30 },
  startShoppingBtn: { backgroundColor: '#16a34a', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  startShoppingText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  cartItem: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 20, padding: 12, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  itemImage: { width: 90, height: 90, borderRadius: 16 },
  itemInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1, marginRight: 10 },
  removeBtn: { padding: 4 },
  itemPrice: { fontSize: 16, fontWeight: '800', color: '#16a34a', marginTop: 4 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, alignSelf: 'flex-start', marginTop: 10 },
  qtyBtn: { backgroundColor: '#ffffff', width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  qtyBtnText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  qtyValue: { fontSize: 14, fontWeight: '700', color: '#0f172a', width: 32, textAlign: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', paddingHorizontal: 24, paddingVertical: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: -10 }, elevation: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  totalLabel: { fontSize: 15, color: '#64748b', fontWeight: '500' },
  totalPrice: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  checkoutBtn: { backgroundColor: '#0f172a', width: '100%', paddingVertical: 18, borderRadius: 20, alignItems: 'center' },
  checkoutBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
});
