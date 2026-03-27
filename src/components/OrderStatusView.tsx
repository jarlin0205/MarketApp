import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

interface OrderStatusViewProps {
  orderId: string;
}

const PHASES = [
  { id: 'Pendiente', label: 'Esperando Confirmación', icon: '⏳', description: 'Tu pedido ha sido enviado. El administrador lo confirmará pronto.' },
  { id: 'Preparación', label: 'Recibido y en Preparación', icon: '👨‍🍳', description: 'El administrador ha recibido tu pedido y está empacando tus productos.' },
  { id: 'Enviado', label: 'En Camino', icon: '🛵', description: 'Tu pedido está en manos del mensajero.' },
  { id: 'Entregado', label: 'Entregado físicamente', icon: '📦', description: 'El repartidor ya entregó tu paquete. Confirma el recibo para finalizar.' },
  { id: 'Confirmado', label: 'Recibido y Confirmado', icon: '✅', description: '¡Gracias por confirmar! Esperamos volver a verte pronto.' }
];

export default function OrderStatusView({ orderId }: OrderStatusViewProps) {
  const [currentStatus, setCurrentStatus] = useState('Pendiente');
  const [orderNotes, setOrderNotes] = useState<string | null>(null);
  const [repartidor, setRepartidor] = useState<any | null>(null);
  const [timestamps, setTimestamps] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    
    const subscription = supabase
      .channel(`order-view-${orderId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders',
        filter: `id=eq.${orderId}`
      }, (payload) => {
        if (payload.new) {
          if (payload.new.status) setCurrentStatus(payload.new.status);
          if (payload.new.notes !== undefined) setOrderNotes(payload.new.notes);
          if (payload.new.repartidor_id) {
            fetchRepartidor(payload.new.repartidor_id);
          }
          setTimestamps({
            Pendiente: payload.new.created_at,
            Preparación: payload.new.prepared_at,
            Enviado: payload.new.shipped_at,
            Entregado: payload.new.delivered_at,
            Confirmado: payload.new.client_confirmed_at
          });
          if (payload.new.client_confirmed_at) setCurrentStatus('Confirmado');
          else if (payload.new.status) setCurrentStatus(payload.new.status);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [orderId]);

  const fetchStatus = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('status, notes, created_at, prepared_at, shipped_at, delivered_at, client_confirmed_at, repartidor_id')
      .eq('id', orderId)
      .single();
    
    if (data) {
      setOrderNotes(data.notes);
      setTimestamps({
        Pendiente: data.created_at,
        Preparación: data.prepared_at,
        Enviado: data.shipped_at,
        Entregado: data.delivered_at,
        Confirmado: data.client_confirmed_at
      });
      if (data.client_confirmed_at) setCurrentStatus('Confirmado');
      else setCurrentStatus(data.status);

      if (data.repartidor_id) {
        fetchRepartidor(data.repartidor_id);
      }
    }
    setLoading(false);
  };
  
  const fetchRepartidor = async (repId: string) => {
    const { data } = await supabase.from('profiles').select('full_name, phone').eq('id', repId).single();
    if (data) setRepartidor(data);
  };

  const getPhaseIndex = (status: string) => {
    const idx = PHASES.findIndex(p => p.id === status);
    return idx === -1 ? 0 : idx;
  };

  const currentIdx = getPhaseIndex(currentStatus);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.orderCard}>
        <Text style={styles.orderLabel}>Pedido ID</Text>
        <Text style={styles.orderId}>#ORD-{orderId.substring(0, 8).toUpperCase()}</Text>
      </View>

      <View style={styles.phasesContainer}>
        {PHASES.map((phase, index) => {
          const isCompleted = index < currentIdx;
          const isCurrent = index === currentIdx;
          
          return (
            <View key={phase.id} style={styles.phaseRow}>
              <View style={styles.leftLineCol}>
                <View style={[
                  styles.circle, 
                  isCompleted && styles.circleCompleted, 
                  isCurrent && styles.circleCurrent
                ]}>
                  <Text style={styles.phaseIcon}>{phase.icon}</Text>
                </View>
                {index < PHASES.length - 1 ? (
                  <View style={[styles.line, index < currentIdx && styles.lineCompleted]} />
                ) : null}
              </View>
              
              <View style={styles.phaseInfo}>
                <View style={styles.labelRow}>
                  <Text style={[
                     styles.phaseLabel, 
                     (isCompleted || isCurrent) && styles.textActive
                  ]}>
                    {phase.label}
                  </Text>
                  {timestamps[phase.id] && (
                    <Text style={styles.timeLabel}>
                      {new Date(timestamps[phase.id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
                <Text style={styles.phaseDesc}>{phase.description}</Text>
              </View>

              {isCurrent ? (
                 <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Actual</Text>
                 </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {orderNotes ? (
        <View style={styles.notesAlert}>
          <Text style={styles.notesAlertTitle}>Información importante 📢</Text>
          <Text style={styles.notesAlertText}>{orderNotes}</Text>
        </View>
      ) : null}
      
      {repartidor && (currentIdx >= 2) && (
        <View style={styles.messengerCard}>
          <Text style={styles.messengerTitle}>🛵 Tu Mensajero en camino</Text>
          <View style={styles.messengerRow}>
             <View style={styles.messengerInfo}>
                <Text style={styles.messengerName}>{repartidor.full_name || 'Mensajero MarketApp'}</Text>
                <Text style={styles.messengerAction}>¡Está trayendo tu pedido!</Text>
             </View>
             {repartidor.phone && (
               <TouchableOpacity style={styles.callBtn} onPress={() => Alert.alert("Llamar", `¿Deseas llamar a ${repartidor.full_name}?`)}>
                  <Text style={styles.callBtnText}>📞 Llamar</Text>
               </TouchableOpacity>
             )}
          </View>
        </View>
      )}

      <View style={styles.paymentInfo}>
         <Text style={styles.paymentTitle}>💡 Información de Pago</Text>
         <Text style={styles.paymentText}>Recuerda que puedes pagar en **Efectivo** o vía **Transferencia** directamente al mensajero cuando recibas tu pedido.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { minHeight: 200, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 4 },
  orderCard: { backgroundColor: '#fff', padding: 20, borderRadius: 24, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  orderLabel: { fontSize: 13, color: '#64748b', fontWeight: '500', textTransform: 'uppercase' },
  orderId: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  phasesContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 20, elevation: 3 },
  phaseRow: { flexDirection: 'row', marginBottom: 20 },
  leftLineCol: { alignItems: 'center', marginRight: 15 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  circleCompleted: { backgroundColor: '#16a34a' },
  circleCurrent: { backgroundColor: '#0f172a', borderWidth: 2, borderColor: '#3b82f6' },
  phaseIcon: { fontSize: 18 },
  line: { width: 3, flex: 1, backgroundColor: '#f1f5f9', marginVertical: 4 },
  lineCompleted: { backgroundColor: '#16a34a' },
  phaseInfo: { flex: 1, paddingTop: 4 },
  phaseLabel: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  textActive: { color: '#0f172a' },
  phaseDesc: { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 16 },
  activeBadge: { backgroundColor: '#3b82f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, height: 20 },
  activeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  paymentInfo: { backgroundColor: '#fef3c7', padding: 16, borderRadius: 16, marginTop: 20, borderLeftWidth: 4, borderLeftColor: '#d97706' },
  paymentTitle: { fontSize: 15, fontWeight: '700', color: '#92400e', marginBottom: 4 },
  paymentText: { fontSize: 13, color: '#b45309', lineHeight: 18 },
  notesAlert: { backgroundColor: '#fff1f2', padding: 16, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: '#fecdd3' },
  notesAlertTitle: { fontSize: 15, fontWeight: '800', color: '#e11d48', marginBottom: 4 },
  notesAlertText: { fontSize: 13, color: '#9f1239', lineHeight: 18, fontWeight: '600' },
  messengerCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 24, marginTop: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  messengerTitle: { color: '#94a3b8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12 },
  messengerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messengerInfo: { flex: 1 },
  messengerName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  messengerAction: { color: '#16a34a', fontSize: 13, fontWeight: '700', marginTop: 2 },
  callBtn: { backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  callBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 }
});
