import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, StatusBar, Platform, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { useCartStore } from '../store/useCartStore';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

interface CartScreenProps {
  onBack: () => void;
  onOrderSuccess: (orderId: string) => void;
}

const COUNTRIES = [
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+52', flag: '🇲🇽', name: 'México' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+51', flag: '🇵🇪', name: 'Perú' },
  { code: '+1', flag: '🇺🇸', name: 'USA' },
];

export default function CartScreen({ onBack, onOrderSuccess }: CartScreenProps) {
  const { items, removeItem, updateQuantity, getCartTotal, clearCart } = useCartStore();
  const user = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(false);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isDeliveryModalVisible, setIsDeliveryModalVisible] = useState(false);
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);

  // Delivery Form State
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);

  // Refs para mover el foco entre campos automáticamente
  const addressRef = useRef<TextInput>(null);
  const neighborhoodRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const handleOpenDelivery = () => {
    if (!user) return Alert.alert("Inicio de Sesión Requerido", "Debes iniciar sesión para realizar una compra.");
    if (items.length === 0) return;
    setIsDeliveryModalVisible(true);
  };

  const handleProceedToConfirmation = () => {
    if (!customerName || !address || !neighborhood || !phoneNumber) {
      return Alert.alert("Campos Obligatorios", "Por favor completa toda la información de entrega.");
    }
    if (phoneNumber.length < 7) {
      return Alert.alert("Teléfono Inválido", "Por favor ingresa un número de teléfono válido.");
    }
    setIsDeliveryModalVisible(false);
    setIsConfirmModalVisible(true);
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const fullPhone = `${selectedCountry.code}${phoneNumber}`;
      
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{ 
          user_id: user?.id, 
          total: getCartTotal(),
          status: 'Pendiente',
          customer_name: customerName,
          delivery_address: address,
          neighborhood: neighborhood,
          phone_number: fullPhone
        }])
        .select()
        .single();

      if (orderError) throw orderError;

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

      setIsConfirmModalVisible(false);
      clearCart();
      onOrderSuccess(orderData.id);
    } catch (error: any) {
      console.error('Error in checkout:', error);
      Alert.alert("Error en el pedido", error.message || "No se pudo procesar la orden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
          <Text style={styles.iconEmoji}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Carrito</Text>
        <View style={{ width: 44 }} />
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
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}>
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, item.quantity + 1)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {items.length > 0 ? (
        <View style={styles.bottomBar}>
           <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total ({items.reduce((acc, item) => acc + item.quantity, 0)} items)</Text>
              <Text style={styles.totalPrice}>${getCartTotal().toFixed(2)}</Text>
           </View>
           <TouchableOpacity style={styles.checkoutBtn} onPress={handleOpenDelivery} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutBtnText}>Hacer Pedido →</Text>}
           </TouchableOpacity>
        </View>
      ) : null}

      {/* MODAL 1: FORMULARIO DE ENTREGA */}
      <Modal visible={isDeliveryModalVisible} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '92%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Datos de Entrega 🚚</Text>
                <TouchableOpacity onPress={() => setIsDeliveryModalVisible(false)} style={styles.closeBtn}>
                  <Text style={{ fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                <Text style={styles.formLabel}>Nombre de quien recibe</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder="Ej: Juan Pérez" 
                  value={customerName} 
                  onChangeText={setCustomerName}
                  returnKeyType="next"
                  onSubmitEditing={() => addressRef.current?.focus()}
                  blurOnSubmit={false}
                />

                <Text style={styles.formLabel}>Dirección de la casa</Text>
                <TextInput 
                  ref={addressRef}
                  style={styles.formInput} 
                  placeholder="Calle 123 #45-67" 
                  value={address} 
                  onChangeText={setAddress}
                  returnKeyType="next"
                  onSubmitEditing={() => neighborhoodRef.current?.focus()}
                  blurOnSubmit={false}
                />

                <Text style={styles.formLabel}>Barrio</Text>
                <TextInput 
                  ref={neighborhoodRef}
                  style={styles.formInput} 
                  placeholder="Ej: El Poblado" 
                  value={neighborhood} 
                  onChangeText={setNeighborhood}
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  blurOnSubmit={false}
                />

                <Text style={styles.formLabel}>Teléfono de contacto (WhatsApp)</Text>
                <View style={styles.phoneInputRow}>
                  <TouchableOpacity 
                    style={styles.countrySelector} 
                    onPress={() => setIsCountryModalVisible(true)}
                  >
                    <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>▼</Text>
                  </TouchableOpacity>
                  <TextInput 
                    ref={phoneRef}
                    style={[styles.formInput, { flex: 1, marginTop: 0 }]} 
                    placeholder="300 123 4567" 
                    value={phoneNumber} 
                    onChangeText={setPhoneNumber} 
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={handleProceedToConfirmation}
                  />
                </View>

                <TouchableOpacity style={[styles.checkoutBtn, { marginTop: 30 }]} onPress={handleProceedToConfirmation}>
                  <Text style={styles.checkoutBtnText}>Continuar →</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 2: CONFIRMACIÓN FINAL */}
      <Modal visible={isConfirmModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>Confirmar Pedido 🏠</Text>
                 <TouchableOpacity onPress={() => setIsConfirmModalVisible(false)} style={styles.closeBtn}>
                    <Text style={{ fontSize: 20 }}>✕</Text>
                 </TouchableOpacity>
              </View>
              <ScrollView style={styles.receiptScroll}>
                 <View style={styles.deliverySummary}>
                    <Text style={styles.deliverySummaryTitle}>Entregar a:</Text>
                    <Text style={styles.deliverySummaryText}>{customerName}</Text>
                    <Text style={styles.deliverySummaryText}>{address}, {neighborhood}</Text>
                    <Text style={styles.deliverySummaryText}>📞 {selectedCountry.code} {phoneNumber}</Text>
                 </View>

                 <Text style={styles.receiptTitle}>Resumen de Productos</Text>
                 {items.map(item => (
                    <View key={item.id} style={styles.receiptRow}>
                       <Text style={styles.receiptItemName}>{item.quantity}x {item.name}</Text>
                       <Text style={styles.receiptItemPrice}>${(item.priceValue * item.quantity).toLocaleString()}</Text>
                    </View>
                 ))}
                 <View style={styles.receiptDivider} />
                 <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Total a Pagar</Text>
                    <Text style={styles.receiptTotalValue}>${getCartTotal().toLocaleString()}</Text>
                 </View>
                 <View style={styles.paymentNote}>
                    <Text style={styles.paymentNoteTitle}>⚠️ Información de Pago</Text>
                    <Text style={styles.paymentNoteText}>El pago se podrá realizar en **Efectivo** o **Transferencia** directamente al mensajero al momento de la entrega.</Text>
                 </View>
                 <Text style={styles.confirmationQuestion}>¿Estás seguro de realizar este pedido?</Text>
              </ScrollView>
              <View style={styles.modalActions}>
                 <TouchableOpacity style={[styles.modalActionBtn, styles.cancelBtn]} onPress={() => { setIsConfirmModalVisible(false); setIsDeliveryModalVisible(true); }}>
                    <Text style={styles.cancelBtnText}>Editar Datos</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={[styles.modalActionBtn, styles.confirmBtn]} onPress={handleCheckout} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirmar</Text>}
                 </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>

      {/* MODAL 3: SELECTOR DE PAÍS */}
      <Modal visible={isCountryModalVisible} animationType="fade" transparent>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsCountryModalVisible(false)}
        >
          <View style={styles.countryModalContent}>
            <Text style={styles.modalTitle}>Selecciona tu país</Text>
            {COUNTRIES.map(c => (
              <TouchableOpacity 
                key={c.code} 
                style={styles.countryOption} 
                onPress={() => { setSelectedCountry(c); setIsCountryModalVisible(false); }}
              >
                <Text style={styles.countryOptionFlag}>{c.flag}</Text>
                <Text style={styles.countryOptionName}>{c.name}</Text>
                <Text style={styles.countryOptionCode}>{c.code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'ios' ? 50 : 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
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
  checkoutBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  closeBtn: { padding: 4 },
  receiptScroll: { marginBottom: 20 },
  receiptTitle: { fontSize: 16, fontWeight: '700', color: '#64748b', marginBottom: 16, marginTop: 10 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  receiptItemName: { fontSize: 15, color: '#0f172a', flex: 1 },
  receiptItemPrice: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginLeft: 10 },
  receiptDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  receiptTotalLabel: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  receiptTotalValue: { fontSize: 24, fontWeight: '800', color: '#16a34a' },
  paymentNote: { backgroundColor: '#fef3c7', padding: 16, borderRadius: 16, marginBottom: 20 },
  paymentNoteTitle: { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 4 },
  paymentNoteText: { fontSize: 13, color: '#b45309', lineHeight: 18 },
  confirmationQuestion: { fontSize: 15, textAlign: 'center', color: '#64748b', marginBottom: 10, fontWeight: '500' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalActionBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  cancelBtnText: { color: '#64748b', fontWeight: '700' },
  confirmBtn: { backgroundColor: '#16a34a' },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
  // Form Styles
  formLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 16, marginBottom: 6 },
  formInput: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a', fontSize: 15 },
  phoneInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 6 },
  countrySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  countryFlag: { fontSize: 20 },
  countryCode: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  deliverySummary: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  deliverySummaryTitle: { fontSize: 12, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  deliverySummaryText: { fontSize: 14, color: '#0f172a', fontWeight: '600', marginBottom: 2 },
  countryModalContent: { backgroundColor: '#fff', margin: 20, borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  countryOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  countryOptionFlag: { fontSize: 24, marginRight: 12 },
  countryOptionName: { flex: 1, fontSize: 16, color: '#0f172a', fontWeight: '500' },
  countryOptionCode: { fontSize: 16, fontWeight: '700', color: '#64748b' }
});
