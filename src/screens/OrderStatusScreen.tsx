import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform } from 'react-native';
import OrderStatusView from '../components/OrderStatusView';

interface OrderStatusScreenProps {
  orderId: string;
  onBack: () => void;
}

export default function OrderStatusScreen({ orderId, onBack }: OrderStatusScreenProps) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seguimiento</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={{ flex: 1, padding: 16 }}>
        <OrderStatusView orderId={orderId} />
      </View>

      <TouchableOpacity style={styles.homeBtn} onPress={onBack}>
         <Text style={styles.homeBtnText}>Ir al Inicio</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'ios' ? 50 : 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  backBtn: { padding: 8 },
  backText: { color: '#64748b', fontWeight: '600' },
  homeBtn: { backgroundColor: '#0f172a', paddingVertical: 18, borderRadius: 20, margin: 20, marginBottom: 40, alignItems: 'center' },
  homeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});
