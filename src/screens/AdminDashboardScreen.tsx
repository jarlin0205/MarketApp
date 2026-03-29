import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Image,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PieChart } from 'react-native-chart-kit';
import { FlashList } from '@shopify/flash-list';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { useAuthStore } from '../store/useAuthStore';

export default function AdminDashboardScreen({ onBack, onViewShop, adminUnreadCount = 0, onResetAdminUnread }: {
  onBack: () => void;
  onViewShop: () => void;
  adminUnreadCount?: number;
  onResetAdminUnread?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales' | 'orders' | 'categories' | 'repartidores' | 'settlements'>('inventory');
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [repartidores, setRepartidores] = useState<any[]>([]);
  const [stats, setStats] = useState({ today: 0, month: 0, rejectedTotal: 0 });
  const [salesPeriod, setSalesPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [analyticsDate, setAnalyticsDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAnalyticsRepartidor, setSelectedAnalyticsRepartidor] = useState<string>('all');
  const [activeChartMetric, setActiveChartMetric] = useState<'revenue' | 'volume' | 'time'>('revenue');
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States for Add/Edit Product
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('Alimentos');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // States for Category Management
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState('Todas');

  // Notification States
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  // Fulfillment Checklist States
  const [checkingOrder, setCheckingOrder] = useState<any | null>(null);
  const [checkingItems, setCheckingItems] = useState<any[]>([]);
  const [isChecklistModalVisible, setIsChecklistModalVisible] = useState(false);
  const [isSummaryModalVisible, setIsSummaryModalVisible] = useState(false);
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');

  // Phase 24: Repartidor Picker & Order Details
  const [isRepPickerVisible, setIsRepPickerVisible] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);
  const [viewingOrderItems, setViewingOrderItems] = useState<any[]>([]);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);

  // Repartidor Creation States
  const [repModalVisible, setRepModalVisible] = useState(false);
  const [repEmail, setRepEmail] = useState('');
  const [repName, setRepName] = useState('');
  const [repCountryCode, setRepCountryCode] = useState('+57');
  const [repPhone, setRepPhone] = useState('');
  const [repPassword, setRepPassword] = useState('');
  const [repSaving, setRepSaving] = useState(false);
  const [showRepPassword, setShowRepPassword] = useState(false);
  const [editingRepId, setEditingRepId] = useState<string | null>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<any | null>(null);
  const [settlementOrders, setSettlementOrders] = useState<any[]>([]);
  const [viewingSettlementDetails, setViewingSettlementDetails] = useState(false);

  // Phase 30: Custom Settlement Validation Modal
  const [isSettlementConfirmVisible, setIsSettlementConfirmVisible] = useState(false);
  const [confirmingData, setConfirmingData] = useState<{ rep: any, stats: any } | null>(null);
  const [closingJornada, setClosingJornada] = useState(false);
  const [realTimeStatus, setRealTimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const fetchInventory = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setInventory(data || []);
  };

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await supabase.from('orders').select('*, order_reviews(*)').order('created_at', { ascending: false });
      const ordersData = data || [];
      setOrders(ordersData);
      
      const pending = ordersData.filter((o: any) => o.status === 'Pendiente').sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setPendingOrders(pending);

      // --- MOTOR DE ANALÍTICA v7.3.1 ---
      const now = new Date();
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      if (salesPeriod === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (salesPeriod === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else if (salesPeriod === 'custom') {
        startDate = new Date(analyticsDate);
        startDate.setHours(0, 0, 0, 0);
      }

      const endDate = salesPeriod === 'custom' ? new Date(startDate) : new Date(now);
      if (salesPeriod === 'custom') endDate.setHours(23, 59, 59, 999);

      const filteredOrders = ordersData.filter((o: any) => {
        // --- LÓGICA DE FECHA INTELIGENTE v7.5 ---
        // Para ventas: Usamos fecha de confirmación o entrega
        // Para rechazos: Usamos fecha de rechazo cliente
        // Fallback: created_at
        const eventDateStr = o.status === 'No Recibido' 
          ? (o.client_rejected_at || o.created_at)
          : (o.client_confirmed_at || o.delivered_at || o.created_at);
          
        const orderDate = new Date(eventDateStr);
        return orderDate >= startDate && orderDate <= endDate;
      });

      let finalFiltered = filteredOrders;
      if (selectedAnalyticsRepartidor !== 'all') {
        finalFiltered = finalFiltered.filter((o: any) => o.repartidor_id === selectedAnalyticsRepartidor);
      }

      const successStates = ['Entregado', 'Confirmado', 'Liquidado'];
      const totalSales = finalFiltered
        .filter((o: any) => successStates.includes(o.status))
        .reduce((acc: number, o: any) => acc + parseFloat(o.total || 0), 0);

      const totalRejected = finalFiltered
        .filter((o: any) => o.status === 'No Recibido')
        .reduce((acc: number, o: any) => acc + parseFloat(o.total || 0), 0);

      setStats({
        today: totalSales, 
        month: ordersData.filter((o: any) => successStates.includes(o.status)).reduce((acc: number, o: any) => acc + parseFloat(o.total || 0), 0), 
        rejectedTotal: totalRejected 
      });

      // --- CENTRO DE ACTIVIDAD v7.3.1 ---
      const { data: revData } = await (supabase as any).from('order_reviews').select('*, orders(customer_name)').order('created_at', { ascending: false }).limit(5);
      const feedReviews = (revData || []).map((r: any) => ({ ...r, feedType: 'review', date: r.created_at }));
      
      const feedRejections = ordersData
        .filter((o: any) => o.status === 'No Recibido' && o.client_rejection_reason)
        .slice(0, 5)
        .map((o: any) => ({ ...o, feedType: 'rejection', date: o.client_rejected_at || o.created_at }));

      const combinedFeed = [...feedReviews, ...feedRejections]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
      
      setActivityFeed(combinedFeed);

    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchRepartidores = async () => {
    const { data: reps } = await supabase.from('profiles').select('*').eq('role', 'repartidor').order('full_name', { ascending: true });
    setRepartidores(reps || []);
    const { data: invites } = await supabase.from('staff_pre_auth').select('*');
    setPendingInvites(invites || []);
  };

  const fetchSettlements = async () => {
    const { data } = await (supabase as any).from('shift_settlements').select('*, profiles(full_name)').order('created_at', { ascending: false });
    setSettlements(data || []);
  };

  const fetchAuxiliar = async () => {
    const { data: revData } = await (supabase as any).from('order_reviews').select('*, orders(customer_name)').order('created_at', { ascending: false });
    setReviews(revData || []);
    const { data: catData } = await supabase.from('categories').select('*').order('name', { ascending: true });
    setCategories(catData || []);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      // Siempre refrescar órdenes primero para inyectar stats
      await fetchOrders(true);
      await Promise.all([
        fetchInventory(),
        fetchRepartidores(),
        fetchSettlements(),
        fetchAuxiliar()
      ]);
    } catch (error) {
      console.error('Error in fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchOrders(true);
  }, [salesPeriod, analyticsDate, selectedAnalyticsRepartidor]);

  React.useEffect(() => {
    // Carga inicial
    fetchData();

    // Sistema de Polling (Respaldo de seguridad cada 30s)
    const pollInterval = setInterval(() => fetchData(), 30000);

    // Suscripción Real-time de Ultra-Baja Latencia 🚀
    const subscription = supabase
      .channel('admin-live-orders-v3')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          console.log('🔔 Cambio detectado en pedido:', (payload.new as any).id, 'Status:', (payload.new as any).status);

          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new;
            // 1. INYECCIÓN DIRECTA (instantánea en segundos)
            setOrders(prev => [newOrder, ...prev]);
            if (newOrder.status === 'Pendiente') {
              setPendingOrders(prev => [...prev, newOrder].sort((a: any, b: any) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              ));
            }

            // 2. REFRESH LIGERO (solo órdenes, no toda la base de datos)
            fetchOrders(true);

            Alert.alert(
              "🔔 ¡Nuevo Pedido Entrante!",
              `Cliente: ${newOrder.customer_name || 'Desconocido'}\nMonto: $${parseFloat(newOrder.total).toLocaleString()}`,
              [{ text: "Ver Pedidos", onPress: () => { setNotifModalVisible(true); fetchOrders(true); } }]
            );
          } else {
            // Si el estado de la orden cambia, solo refrescamos órdenes
            fetchOrders(true);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status:', status);
        if (status === 'SUBSCRIBED') setRealTimeStatus('connected');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealTimeStatus('error');
      });

    return () => {
      clearInterval(pollInterval);
      subscription.unsubscribe();
    };
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const openForm = (prod: any = null) => {
    if (prod) {
      setEditingId(prod.id);
      setName(prod.name);
      setPrice(prod.price.toString());
      setStock(prod.stock.toString());
      setCategory(prod.category || 'Otros');
      setDescription(prod.description || '');
      setImage(prod.image_url);
    } else {
      setEditingId(null);
      setName('');
      setPrice('');
      setStock('');
      setCategory('Alimentos');
      setDescription('');
      setImage(null);
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !price || !stock) return Alert.alert("Error", "Completa todos los campos");
    setSaving(true);
    const productData = {
      name,
      price: parseFloat(price),
      stock: parseInt(stock),
      category,
      description,
      image_url: image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80'
    };
    let error;
    if (editingId) {
      const { error: err } = await supabase.from('products').update(productData).eq('id', editingId);
      error = err;
    } else {
      const { error: err } = await supabase.from('products').insert([productData]);
      error = err;
    }
    setSaving(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("¡Éxito!", editingId ? "Producto actualizado" : "Producto añadido");
      setModalVisible(false);
      fetchData();
    }
  };

  const updateOrderStatus = async (id: string, newStatus: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    // Blindaje: No permitir retroceder si ya está en estados finales
    const finalStates = ['Entregado', 'Confirmado', 'Cancelado'];
    if (finalStates.includes(order.status) && newStatus !== 'Cancelado') {
      return Alert.alert("Acción Bloqueada", "Este pedido ya ha sido finalizado.");
    }

    if (newStatus === 'Cancelado') {
      const { error } = await supabase.from('orders').update({ status: 'Cancelado', client_viewed_status: false }).eq('id', id);
      if (!error) {
        fetchOrders(true);
        return;
      }
    }

    // Si el administrador "Atiende", pasamos directo a Preparación
    const statusToUpdate = newStatus === 'Recibida' ? 'Preparación' : newStatus;

    // Al actualizar estado, marcamos que el cliente NO lo ha visto aún
    const { error } = await supabase
      .from('orders')
      .update({
        status: statusToUpdate,
        client_viewed_status: false,
        ...(statusToUpdate === 'Preparación' ? { prepared_at: new Date().toISOString() } : {})
      })
      .eq('id', id);
    if (error) Alert.alert("Error", error.message);
    else {
      if (newStatus === 'Recibida' || newStatus === 'Preparación') {
        startChecklist(id);
      }
      fetchOrders(true);
    }
  };

  const startChecklist = async (orderId: string) => {
    try {
      const { data: itemsData, error } = await supabase
        .from('order_items')
        .select('*, products(name)')
        .eq('order_id', orderId);
      if (error) throw error;
      const order = orders.find(o => o.id === orderId);
      setCheckingOrder(order);
      // Inicializar fulfilled_quantity con la cantidad solicitada (o la ya guardada)
      setCheckingItems(itemsData.map((it: any) => ({
        ...it,
        fulfilled_quantity: it.fulfilled_quantity !== null ? it.fulfilled_quantity : it.quantity
      })));
      setIsChecklistModalVisible(true);
    } catch (err: any) {
      Alert.alert("Error al cargar checklist", err.message);
    }
  };

  const finishChecklist = () => {
    const missingItems = checkingItems.filter(it => it.fulfilled_quantity < it.quantity);
    let notes = '';
    if (missingItems.length > 0) {
      const detailedNotes = missingItems.map(it => {
        if (it.fulfilled_quantity === 0) return `${it.products.name} (Agotado)`;
        return `${it.products.name} (${it.fulfilled_quantity} de ${it.quantity} despachados)`;
      }).join(", ");

      notes = "⚠️ Novedades en el pedido: " + detailedNotes + ". El resto ha sido preparado correctamente.";
    }
    setFulfillmentNotes(notes);
    setIsChecklistModalVisible(false);
    // En vez de ir directo al resumen, vamos a pedir el repartidor si está enviando
    setIsRepPickerVisible(true);
  };

  const handleDeleteRepartidor = (rep: any) => {
    Alert.alert(
      "Eliminar Repartidor 🗑️",
      `¿Estás seguro de que deseas revocar el acceso a ${rep.full_name || 'este repartidor'}?\n\nPerderá su acceso a la plataforma de envíos inmediatamente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from('profiles').update({ role: 'client' }).eq('id', rep.id);
            if (error) Alert.alert("Error", error.message);
            else {
              Alert.alert("Éxito", "El usuario ya no es repartidor.");
              fetchData();
            }
          }
        }
      ]
    );
  };

  const openEditRepForm = (rep: any) => {
    setEditingRepId(rep.id);
    setRepName(rep.full_name || '');

    // Extraer código de país +57 322...
    if (rep.phone && rep.phone.startsWith('+')) {
      const parts = rep.phone.split(' ');
      setRepCountryCode(parts[0]);
      setRepPhone(parts.slice(1).join(' '));
    } else {
      setRepCountryCode('+57');
      setRepPhone(rep.phone || '');
    }

    // Phase 41: Priorizar Username sobre Email (para rescatar legados)
    setRepEmail(rep.username || '');

    setRepPassword('');
    setRepModalVisible(true);
  };

  const handleStaffCreation = async () => {
    if (!repName || !repPhone || !repCountryCode || (!editingRepId && !repEmail)) {
      return Alert.alert("Error", "Completa nombre, teléfono y usuario.");
    }

    if (!editingRepId && !repPassword) {
      return Alert.alert("Error", "Debes asignar una contraseña para el nuevo repartidor.");
    }

    if (!editingRepId && repPassword.length < 6) {
      return Alert.alert("Error", "La contraseña debe tener mínimo 6 caracteres.");
    }

    setRepSaving(true);
    try {
      const fullPhone = `${repCountryCode.trim()} ${repPhone.trim()}`;

      if (editingRepId) {
        const updateData: any = {
          full_name: repName,
          phone: fullPhone
        };

        // Phase 41: Permitir setear username si no tenía
        const currentRep = repartidores.find(r => r.id === editingRepId);
        if (!currentRep?.username && repEmail) {
          updateData.username = repEmail.trim().toLowerCase();
        }

        // Permitir actualización de clave local
        if (repPassword && repPassword.length >= 6) {
          updateData.messenger_password = repPassword;
        }

        await supabase.from('profiles').update(updateData).eq('id', editingRepId);

        Alert.alert("Éxito", "Perfil y credenciales actualizados correctamente.");
      } else {
        // Phase 41: Creación Directa usando RPC Server-Side para evitar límites de correo (429)
        const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)('create_repartidor', {
          p_username: repEmail.trim().toLowerCase(),
          p_password: repPassword,
          p_full_name: repName,
          p_phone: fullPhone
        });

        if (rpcErr) throw rpcErr;

        if (rpcData && rpcData.error) {
          Alert.alert("Error", rpcData.error);
          return;
        }

        Alert.alert("¡Éxito!", `Repartidor creado exitosamente. Ya puede iniciar sesión con el usuario "${repEmail.trim().toLowerCase()}".`);
      }
      // <-- Cierre del else principal

      setRepModalVisible(false);
      setEditingRepId(null);
      setRepEmail('');
      setRepName('');
      setRepPhone('');
      setRepPassword('');
      fetchData();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setRepSaving(false);
    }
  };

  const handleFinalizeShipment = async () => {
    if (!selectedRepId) return Alert.alert("Error", "Debes seleccionar un repartidor.");
    try {
      setSaving(true);
      // 1. Actualizar el estado de cada ítem en la base de datos
      for (const item of checkingItems) {
        await supabase
          .from('order_items')
          .update({
            fulfilled_quantity: item.fulfilled_quantity,
            is_fulfilled: item.fulfilled_quantity > 0
          })
          .eq('id', item.id);
      }

      // 2. Actualizar el estado de la orden asignando al repartidor
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'Enviado',
          notes: fulfillmentNotes,
          shipped_at: new Date().toISOString(),
          repartidor_id: selectedRepId, // ASIGNACIÓN CRÍTICA
          client_viewed_status: false
        })
        .eq('id', checkingOrder.id);
      if (error) throw error;

      setIsSummaryModalVisible(false);
      setCheckingOrder(null);
      setSelectedRepId(null);
      Alert.alert("🚀 ¡Pedido Enviado!", "El pedido ha sido asignado y el cliente notificado.");
      fetchData();
    } catch (err: any) {
      Alert.alert("Error al finalizar", err.message);
    } finally {
      setSaving(false);
    }
  };

  const openOrderDetails = async (order: any) => {
    try {
      setLoading(true);
      const { data: items, error } = await supabase
        .from('order_items')
        .select('*, products(name)')
        .eq('order_id', order.id);
      if (error) throw error;

      // Buscar información del repartidor si tiene
      let repInfo = null;
      if (order.repartidor_id) {
        repInfo = repartidores.find(r => r.id === order.repartidor_id);
      }

      setViewingOrder({ ...order, repartidor: repInfo });
      setViewingOrderItems(items || []);
      setIsDetailsModalVisible(true);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Eliminar Producto", "¿Estás seguro de que quieres borrar este producto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          const { error } = await supabase.from('products').delete().eq('id', id);
          if (error) Alert.alert("Error", error.message);
          else fetchData();
        }
      }
    ]);
  };

  const renderInventory = () => (
    <View style={[styles.tabContent, { flex: 1, paddingBottom: 0 }]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mi Inventario</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openForm()}>
          <Text style={styles.addButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginBottom: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScrollAdmin}>
          {['Todas', ...categories.map(c => c.name)].map(cat => (
            <TouchableOpacity key={cat} onPress={() => setSelectedInventoryCategory(cat)}
              style={[styles.catPillSmall, selectedInventoryCategory === cat && styles.catPillSmallActive]}>
              <Text style={[styles.catTextSmall, selectedInventoryCategory === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={{ flex: 1 }}>
        {loading ? (
          <ActivityIndicator color="#16a34a" size="large" style={{ marginTop: 40 }} />
        ) : inventory.length === 0 ? (
          <Text style={styles.emptyText}>No hay productos registrados.</Text>
        ) : (
          <FlatList
            data={inventory.filter(item => selectedInventoryCategory === 'Todas' || item.category === selectedInventoryCategory)}
            keyExtractor={(item: any) => item.id}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            renderItem={({ item }: { item: any }) => (
              <View style={styles.itemCard}>
                <View style={styles.itemMainInfo}>
                  <Image source={{ uri: item.image_url }} style={styles.smallImage} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.itemCategory}>{item.category || 'Sin categoría'}</Text>
                    <Text style={styles.itemStock}>Stock: {item.stock}</Text>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <Text style={styles.itemPrice}>${parseFloat(item.price).toLocaleString()}</Text>
                  <View style={styles.actionBtns}>
                    <TouchableOpacity onPress={() => openForm(item)} style={styles.actionBtn}><Text style={{ fontSize: 16 }}>✏️</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}><Text style={{ fontSize: 16 }}>🗑️</Text></TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>
    </View>
  );

  const renderSales = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Análisis de Operación 📊</Text>
      <Text style={{ fontSize: 10, color: '#64748b', marginBottom: 15, fontWeight: '700' }}>
        ✓ Incluyendo datos de jornadas ya cerradas y liquidadas
      </Text>
      
      {/* Sistema de Filtros de Tiempo */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {[
          { id: 'today', label: 'Hoy' },
          { id: 'week', label: 'Semana' },
          { id: 'month', label: 'Mes' },
          { id: 'custom', label: 'Día Especial 📅' }
        ].map(p => (
          <TouchableOpacity 
            key={p.id} 
            style={[styles.filterChip, salesPeriod === p.id && styles.filterChipActive]}
            onPress={() => setSalesPeriod(p.id as any)}
          >
            <Text style={[styles.filterText, salesPeriod === p.id && styles.filterTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {salesPeriod === 'custom' && (
        <View style={styles.customDateBox}>
          <Text style={styles.label}>Ingresa la fecha (AAAA-MM-DD):</Text>
          <TextInput 
            style={styles.input} 
            value={analyticsDate} 
            onChangeText={setAnalyticsDate} 
            placeholder="2024-03-25"
          />
        </View>
      )}

      {/* Filtro por Repartidor */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterScroll, { marginTop: 10 }]}>
        <TouchableOpacity 
          style={[styles.filterChip, selectedAnalyticsRepartidor === 'all' && styles.filterChipActive, { backgroundColor: selectedAnalyticsRepartidor === 'all' ? '#1e293b' : '#f1f5f9' }]}
          onPress={() => setSelectedAnalyticsRepartidor('all')}
        >
          <Text style={[styles.filterText, selectedAnalyticsRepartidor === 'all' && styles.filterTextActive]}>Toda la Flota</Text>
        </TouchableOpacity>
        {repartidores.map(rep => (
          <TouchableOpacity 
            key={rep.id} 
            style={[styles.filterChip, selectedAnalyticsRepartidor === rep.id && styles.filterChipActive, { backgroundColor: selectedAnalyticsRepartidor === rep.id ? '#1e293b' : '#f1f5f9' }]}
            onPress={() => setSelectedAnalyticsRepartidor(rep.id)}
          >
            <Text style={[styles.filterText, selectedAnalyticsRepartidor === rep.id && styles.filterTextActive]}>{rep.full_name || rep.email}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: '#f0fdf4', borderColor: '#16a34a' }]}>
          <Text style={[styles.statLabel, { color: '#166534' }]}>Ventas Exitosas</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>${stats.today.toLocaleString()}</Text>
          <Text style={{ fontSize: 10, color: '#15803d', marginTop: 4 }}>{selectedAnalyticsRepartidor === 'all' ? 'Periodo seleccionado' : 'Filtrado por mensajero'}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#fff1f2', borderColor: '#ef4444' }]}>
          <Text style={[styles.statLabel, { color: '#991b1b' }]}>No Recibidos</Text>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>${stats.rejectedTotal.toLocaleString()}</Text>
          <Text style={{ fontSize: 10, color: '#991b1b', marginTop: 4 }}>Pérdida potencial</Text>
        </View>
      </View>

      {/* Gráfico de Torta v8.5 */}
      {(stats.today > 0 || stats.rejectedTotal > 0) && (
        <View style={{ marginTop: 20, alignItems: 'center', backgroundColor: '#fff', paddingVertical: 15, paddingHorizontal: 10, borderRadius: 20, elevation: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 5 }}>Balance General 🥧</Text>
          <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 15 }}>Distribución financiera del periodo</Text>
          <PieChart
            data={[
              {
                name: 'Exitosas',
                population: stats.today,
                color: '#16a34a',
                legendFontColor: '#334155',
                legendFontSize: 12,
              },
              {
                name: 'No Recibidos',
                population: stats.rejectedTotal,
                color: '#ef4444',
                legendFontColor: '#334155',
                legendFontSize: 12,
              }
            ]}
            width={Dimensions.get('window').width - 60}
            height={140}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={"0"}
            center={[15, 0]}
            absolute={false}
          />
        </View>
      )}

      {/* COMPONENTES DE GRÁFICAS - ANALÍTICA POR MENSAJERO */}
      <View style={{ marginTop: 25, backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 2 }}>
        <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 15 }]}>Comparativa de Rendimiento 📈</Text>
        
        {/* Lente de Métrica */}
        <View style={{ flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 12, padding: 4, marginBottom: 20 }}>
          <TouchableOpacity 
            style={[styles.tabButton, activeChartMetric === 'revenue' && { backgroundColor: '#fff', elevation: 1 }]}
            onPress={() => setActiveChartMetric('revenue')}
          >
            <Text style={[styles.tabText, { color: activeChartMetric === 'revenue' ? '#0f172a' : '#64748b' }]}>$ Recaudo</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeChartMetric === 'volume' && { backgroundColor: '#fff', elevation: 1 }]}
            onPress={() => setActiveChartMetric('volume')}
          >
            <Text style={[styles.tabText, { color: activeChartMetric === 'volume' ? '#0f172a' : '#64748b' }]}># Volumen</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeChartMetric === 'time' && { backgroundColor: '#fff', elevation: 1 }]}
            onPress={() => setActiveChartMetric('time')}
          >
            <Text style={[styles.tabText, { color: activeChartMetric === 'time' ? '#0f172a' : '#64748b' }]}>⚡ Tiempo</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Bars */}
        {(() => {
          const now = new Date();
          let startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          if (salesPeriod === 'week') startDate.setDate(now.getDate() - 7);
          else if (salesPeriod === 'month') startDate.setMonth(now.getMonth() - 1);
          else if (salesPeriod === 'custom') {
            startDate = new Date(analyticsDate);
            startDate.setHours(0, 0, 0, 0);
          }
          const endDate = salesPeriod === 'custom' ? new Date(startDate) : new Date(now);
          if (salesPeriod === 'custom') endDate.setHours(23, 59, 59, 999);

          const periodOrders = orders.filter(o => {
            const evDate = o.status === 'No Recibido' ? (o.client_rejected_at || o.created_at) : (o.client_confirmed_at || o.delivered_at || o.created_at);
            const d = new Date(evDate);
            return d >= startDate && d <= endDate;
          });

          const chartData = repartidores.map(rep => {
            const rOps = periodOrders.filter(o => o.repartidor_id === rep.id);
            const succ = rOps.filter(o => ['Entregado', 'Confirmado', 'Liquidado'].includes(o.status));
            const rejs = rOps.filter(o => o.status === 'No Recibido');
            const rev = succ.reduce((acc, o) => acc + parseFloat(o.total || 0), 0);
            const loss = rejs.reduce((acc, o) => acc + parseFloat(o.total || 0), 0);

            let tMins = 0, tDels = 0;
            succ.forEach(o => {
              if (o.shipped_at && o.delivered_at) {
                tMins += Math.max(0, (new Date(o.delivered_at).getTime() - new Date(o.shipped_at).getTime()) / 60000);
                tDels++;
              }
            });
            const time = tDels > 0 ? (tMins / tDels) : 0;

            return { id: rep.id, name: rep.full_name || rep.email, rev, loss, vol: succ.length, volL: rejs.length, time, totalVol: succ.length + rejs.length, totalRev: rev + loss };
          });

          if (chartData.filter(d => activeChartMetric === 'time' ? (d.time > 0) : (d.totalRev > 0 || d.totalVol > 0)).length === 0) {
            return <Text style={styles.emptyText}>Sin datos en este periodo.</Text>;
          }

          const displayData = selectedAnalyticsRepartidor === 'all' ? chartData : chartData.filter(d => d.id === selectedAnalyticsRepartidor);

          if (activeChartMetric === 'revenue') {
            const maxVal = Math.max(...displayData.map(d => d.totalRev), 1);
            return displayData.map(d => {
              if (selectedAnalyticsRepartidor === 'all' && d.totalRev === 0) return null;
              return (
                <View key={d.id} style={{ marginBottom: 15 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155' }}>{d.name}</Text>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>${d.rev.toLocaleString()} ✅   |   ${d.loss.toLocaleString()} ✕</Text>
                  </View>
                  <View style={{ flexDirection: 'row', height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                    <View style={{ width: `${(d.rev / maxVal) * 100}%`, backgroundColor: '#16a34a' }} />
                    <View style={{ width: `${(d.loss / maxVal) * 100}%`, backgroundColor: '#ef4444' }} />
                  </View>
                </View>
              )
            });
          }

          if (activeChartMetric === 'volume') {
            const maxVal = Math.max(...displayData.map(d => d.totalVol), 1);
            return displayData.map(d => {
              if (selectedAnalyticsRepartidor === 'all' && d.totalVol === 0) return null;
              return (
                <View key={d.id} style={{ marginBottom: 15 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155' }}>{d.name}</Text>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>{d.vol} Pedidos ✅   |   {d.volL} Fallos ✕</Text>
                  </View>
                  <View style={{ flexDirection: 'row', height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                    <View style={{ width: `${(d.vol / maxVal) * 100}%`, backgroundColor: '#2563eb' }} />
                    <View style={{ width: `${(d.volL / maxVal) * 100}%`, backgroundColor: '#ef4444' }} />
                  </View>
                </View>
              )
            });
          }

          if (activeChartMetric === 'time') {
            const maxVal = Math.max(...displayData.map(d => d.time), 1);
            return displayData.map(d => {
              if (selectedAnalyticsRepartidor === 'all' && d.time === 0) return null;
              return (
                <View key={d.id} style={{ marginBottom: 15 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155' }}>{d.name}</Text>
                    <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: 'bold' }}>{d.time.toFixed(1)} mins prom.</Text>
                  </View>
                  <View style={{ height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                    <View style={{ width: `${(d.time / maxVal) * 100}%`, backgroundColor: '#f59e0b', height: '100%', borderRadius: 6 }} />
                  </View>
                </View>
              );
            });
          }
        })()}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Centro de Actividad v7.3 ⭐</Text>
      {activityFeed.length === 0 ? (
        <Text style={styles.emptyText}>No hay actividad reciente.</Text>
      ) : (
        activityFeed.map((item, idx) => (
          <View key={idx} style={[styles.reviewCard, item.feedType === 'rejection' && { borderLeftColor: '#ef4444', borderLeftWidth: 4 }]}>
            <View style={styles.reviewHead}>
              <Text style={styles.reviewCustomer}>{item.orders?.customer_name || item.customer_name || 'Cliente'}</Text>
              {item.feedType === 'review' ? (
                <View style={styles.starsSmall}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Text key={s} style={{ fontSize: 10, opacity: s <= item.rating ? 1 : 0.2 }}>⭐</Text>
                  ))}
                </View>
              ) : (
                <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                   <Text style={{ fontSize: 9, color: '#ef4444', fontWeight: 'bold' }}>RECHAZO ✕</Text>
                </View>
              )}
            </View>
            <Text style={[styles.reviewComment, item.feedType === 'rejection' && { color: '#991b1b', fontWeight: '700' }]}>
              {item.feedType === 'review' ? `"${item.comment || 'Sin comentario'}"` : `Motivo: ${item.client_rejection_reason || 'No especificado'}`}
            </Text>
            <Text style={styles.reviewDate}>
              {new Date(item.date).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Rendimiento Acumulado 🛵</Text>
      <View style={styles.repStatContainer}>
        {repartidores.length === 0 ? (
          <Text style={styles.emptyText}>No hay repartidores para analizar.</Text>
        ) : (
          repartidores.map(rep => {
            const repOrders = orders.filter(o => o.repartidor_id === rep.id && (o.status === 'Entregado' || o.status === 'Confirmado'));
            const total = repOrders.reduce((acc, o) => acc + parseFloat(o.total), 0);
            return (
              <View key={rep.id} style={styles.repMiniStat}>
                <Text style={styles.repMiniName}>{rep.full_name || rep.email}</Text>
                <Text style={styles.repMiniValue}>${total.toLocaleString()} ({repOrders.length} ped.)</Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  const handleAddCategory = async () => {
    if (!newCatName) return;
    setSaving(true);
    const { error } = await supabase.from('categories').insert([{ name: newCatName }]);
    setSaving(false);
    if (error) Alert.alert("Error", error.message);
    else { setNewCatName(''); setCatModalVisible(false); fetchData(); }
  };

  const handleDeleteCategory = async (id: string) => {
    Alert.alert("Borrar Categoría", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: async () => { await supabase.from('categories').delete().eq('id', id); fetchData(); } }
    ]);
  };

  const renderCategories = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🏷️ Gestión de Categorías</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setCatModalVisible(true)}><Text style={styles.addButtonText}>+ Nueva</Text></TouchableOpacity>
      </View>
      {categories.map(cat => (
        <View key={cat.id} style={styles.categoryListItem}>
          <Text style={styles.categoryListItemText}>{cat.name}</Text>
          <TouchableOpacity onPress={() => handleDeleteCategory(cat.id)}><Text style={{ fontSize: 16 }}>🗑️</Text></TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const renderRepartidores = () => {
    const repartidorStats: { [key: string]: { entregas: number; pendientes: number; recaudado: number; total_tiempo: number; rechazados: number } } = {};

    orders.forEach(order => {
      // Solo sumamos a las estadísticas activas lo que NO ha sido liquidado
      if (order.repartidor_id && !order.is_settled) {
        if (!repartidorStats[order.repartidor_id]) {
          repartidorStats[order.repartidor_id] = { entregas: 0, pendientes: 0, recaudado: 0, total_tiempo: 0, rechazados: 0 };
        }

        const isDelivered = ['Entregado', 'Confirmado'].includes(order.status);
        const isPending = order.status === 'Enviado';
        const isRejected = order.status === 'No Recibido';

        if (isDelivered) {
          repartidorStats[order.repartidor_id].entregas += 1;
          repartidorStats[order.repartidor_id].recaudado += parseFloat(order.total || 0);

          if (order.delivered_at && order.shipped_at) {
            const diff = new Date(order.delivered_at).getTime() - new Date(order.shipped_at).getTime();
            const minutes = Math.max(0, diff / 1000 / 60);
            repartidorStats[order.repartidor_id].total_tiempo += minutes;
          }
        } else if (isPending) {
          repartidorStats[order.repartidor_id].pendientes += 1;
        } else if (isRejected) {
          repartidorStats[order.repartidor_id].rechazados += 1;
        }
      }
    });

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Gestión de Mensajeros 🛵</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setRepModalVisible(true)}>
            <Text style={styles.addButtonText}>+ Nuevo Mensajero</Text>
          </TouchableOpacity>
        </View>

        {repartidores.length === 0 && pendingInvites.length === 0 ? (
          <Text style={styles.emptyText}>No tienes repartidores registrados aún.</Text>
        ) : (
          <>
            {repartidores.map(rep => {
              const stats = repartidorStats[rep.id] || { entregas: 0, pendientes: 0, recaudado: 0, total_tiempo: 0 };
              const avgTime = stats.entregas > 0 ? (stats.total_tiempo / stats.entregas).toFixed(1) : '0';
              const isPendingClosure = rep.shift_status === 'pending_closure';
              return (
                <View key={rep.id} style={styles.repCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={styles.repInfo}>
                      <Text style={styles.repName}>{rep.full_name || 'Sin nombre'}</Text>
                      {rep.email && <Text style={styles.repEmail}>Usuario: {rep.email.replace('@repartidor.local', '')}</Text>}
                      {rep.phone && <Text style={styles.repEmail}>📞 {rep.phone}</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => openEditRepForm(rep)} style={{ padding: 5 }}>
                        <Text style={{ fontSize: 18 }}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteRepartidor(rep)} style={{ padding: 5 }}>
                        <Text style={{ fontSize: 18 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.repStatsRow}>
                    <View style={[styles.repStatItem, { backgroundColor: '#eff6ff', borderRadius: 12, paddingVertical: 10 }]}>
                      <Text style={[styles.repStatVal, { color: '#2563eb' }]}>{stats.pendientes}</Text>
                      <Text style={styles.repStatLab}>Ruta 🔵</Text>
                    </View>
                    <View style={[styles.repStatItem, { backgroundColor: '#f0fdf4', borderRadius: 12, paddingVertical: 10 }]}>
                      <Text style={[styles.repStatVal, { color: '#16a34a' }]}>{stats.entregas}</Text>
                      <Text style={styles.repStatLab}>Entr. ✅</Text>
                    </View>
                    <View style={[styles.repStatItem, { backgroundColor: '#fff1f2', borderRadius: 12, paddingVertical: 10 }]}>
                      <Text style={[styles.repStatVal, { color: '#ef4444' }]}>{stats.rechazados || 0}</Text>
                      <Text style={styles.repStatLab}>No Entregados ✕</Text>
                    </View>
                    <View style={[styles.repStatItem, { backgroundColor: '#fffbeb', borderRadius: 12, paddingVertical: 10 }]}>
                      <Text style={[styles.repStatVal, { color: '#d97706' }]}>${stats.recaudado.toLocaleString()}</Text>
                      <Text style={styles.repStatLab}>Caja 💰</Text>
                    </View>
                  </View>
                  <Text style={[styles.repStatLab, { textAlign: 'right', marginTop: 8, fontSize: 8, opacity: 0.6 }]}>
                    ⚡ TIEMPO PROM: {avgTime}m
                  </Text>

                  {isPendingClosure && (
                    <TouchableOpacity
                      style={styles.approveClosureBtn}
                      onPress={() => {
                        setConfirmingData({ rep, stats });
                        setIsSettlementConfirmVisible(true);
                      }}
                    >
                      <Text style={styles.approveClosureText}>VALIDAR $ Y CERRAR JORNADA ✅</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {pendingInvites.filter((invite: any) => invite.role === 'repartidor').length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 30, fontSize: 16 }]}>Invitaciones Pendientes (Lista Blanca) 📑</Text>
                {pendingInvites.filter((invite: any) => invite.role === 'repartidor').map((invite: any) => (
                  <View key={invite.email} style={[styles.repCard, { opacity: 0.7, borderStyle: 'dashed' }]}>
                    <View style={styles.repInfo}>
                      <Text style={styles.repName}>Pendiente de Registro</Text>
                      <Text style={styles.repEmail}>{invite.email}</Text>
                      {invite.phone && <Text style={styles.repStatLab}>📞 {invite.phone}</Text>}
                    </View>
                    <TouchableOpacity
                      style={{ padding: 8 }}
                      onPress={async () => {
                        await supabase.from('staff_pre_auth').delete().eq('email', invite.email);
                        fetchData();
                      }}
                    >
                      <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  const renderSettlements = () => {
    // Agrupar liquidaciones por fecha
    const grouped = settlements.reduce((acc: any, curr: any) => {
      const date = new Date(curr.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!acc[date]) acc[date] = [];
      acc[date].push(curr);
      return acc;
    }, {});

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Historial de Liquidaciones 📑</Text>
        </View>

        {Object.keys(grouped).length === 0 ? (
          <Text style={styles.emptyText}>No hay liquidaciones registradas aún.</Text>
        ) : Object.keys(grouped).map(date => (
          <View key={date}>
            <Text style={styles.settlementDateHeader}>{date}</Text>
            {grouped[date].map((sett: any) => (
              <TouchableOpacity key={sett.id} style={styles.settlementItem} onPress={() => openSettlementDetails(sett)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settlementUser}>🛵 {sett.profiles?.full_name || 'Desconocido'}</Text>
                  <Text style={styles.settlementOrders}>{sett.orders_count} pedidos liquidados</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View style={[styles.settlementBadge, { backgroundColor: sett.status === 'approved' ? '#dcfce7' : '#fef3c7', marginTop: 0 }]}>
                      <Text style={[styles.settlementBadgeText, { color: sett.status === 'approved' ? '#166534' : '#92400e' }]}>
                        {sett.status === 'approved' ? '✓ LIQUIDADO' : '⏳ PENDIENTE'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold' }}>
                      🗓️ {new Date(sett.created_at).toLocaleDateString()} - 🕒 {new Date(sett.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  {sett.status === 'approved' && (
                    <Text style={{ color: '#16a34a', fontSize: 10, fontWeight: '800', marginTop: 5 }}>
                      ✅ Cuadre de caja correcto perfectamente, jornada finalizada y cerrada
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.settlementAmount}>${parseFloat(sett.total_amount).toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const openSettlementDetails = async (settlement: any) => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('orders')
        .select('*, order_reviews(*)')
        .eq('settlement_id', settlement.id);
      if (error) throw error;
      setSelectedSettlement(settlement);
      setSettlementOrders(data || []);
      setViewingSettlementDetails(true);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderSettlementDetailsModal = () => (
    <Modal visible={viewingSettlementDetails} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { height: '85%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalle de Liquidación 📑</Text>
            <TouchableOpacity onPress={() => setViewingSettlementDetails(false)}>
              <Text style={{ fontSize: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {selectedSettlement && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.settlementDetailHeader}>
                <Text style={styles.settlementDetailUser}>Mensajero: {selectedSettlement.profiles?.full_name}</Text>
                <Text style={styles.settlementDetailTotal}>Total Recibido: ${parseFloat(selectedSettlement.total_amount).toLocaleString()}</Text>
                <Text style={styles.settlementDetailDate}>Fecha: {new Date(selectedSettlement.created_at).toLocaleString()}</Text>
              </View>

              <Text style={styles.sectionTitle}>Pedidos Incluidos</Text>
              {settlementOrders.map(order => (
                <View key={order.id} style={styles.settlementOrderCard}>
                  <View style={styles.settlementOrderHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settlementOrderTitle}>{order.customer_name}</Text>
                      {order.status === 'No Recibido' && (
                        <View style={[styles.settlementBadge, { backgroundColor: '#fee2e2', width: 100, marginTop: 4 }]}>
                          <Text style={[styles.settlementBadgeText, { color: '#ef4444', fontSize: 9 }]}>📦 DEVOLUCIÓN</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.settlementOrderPrice, order.status === 'No Recibido' && { color: '#94a3b8', textDecorationLine: 'line-through' }]}>
                      ${parseFloat(order.total).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.settlementOrderInfo}>📍 {order.delivery_address}</Text>
                  <Text style={styles.settlementOrderInfo}>🆔 #ORD-{order.id.substring(0, 6).toUpperCase()}</Text>

                  {order.status === 'No Recibido' ? (
                    <View style={styles.settlementRejectionBox}>
                      <Text style={styles.settlementRejectionLabel}>Motivo del Rechazo:</Text>
                      <Text style={styles.settlementRejectionReason}>"{order.client_rejection_reason || 'No especificado'}"</Text>
                      <Text style={styles.settlementRejectionDate}>Rechazado: {order.client_rejected_at ? new Date(order.client_rejected_at).toLocaleTimeString() : '--:--'}</Text>
                    </View>
                  ) : (
                    <Text style={styles.settlementOrderInfo}>🕒 Entregado: {order.delivered_at ? new Date(order.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</Text>
                  )}

                  {order.order_reviews && order.order_reviews.length > 0 && order.status !== 'No Recibido' && (
                    <View style={styles.settlementReviewBox}>
                      <Text style={styles.settlementReviewRating}>⭐ {order.order_reviews[0].rating}/5</Text>
                      <Text style={styles.settlementReviewComment}>"{order.order_reviews[0].comment || 'Sin comentario'}"</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderSettlementConfirmModal = () => (
    <Modal visible={isSettlementConfirmVisible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { minHeight: '40%', padding: 30, borderRadius: 32 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirmar Recaudo 💰</Text>
            <TouchableOpacity onPress={() => setIsSettlementConfirmVisible(false)}>
              <Text style={{ fontSize: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {confirmingData && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.confirmSubtitle}>¿Has recibido el dinero físico de manos del mensajero?</Text>

              <View style={styles.confirmDataBox}>
                <Text style={styles.confirmLabel}>Mensajero:</Text>
                <Text style={styles.confirmValue}>{confirmingData.rep.full_name}</Text>

                <View style={{ height: 15 }} />

                <Text style={styles.confirmLabel}>Monto a Recibir:</Text>
                <Text style={styles.confirmAmount}>${confirmingData.stats.recaudado.toLocaleString()}</Text>
              </View>

              {confirmingData.stats.pendientes > 0 && (
                <View style={[styles.warningNote, { backgroundColor: '#fff1f2', borderColor: '#ef4444' }]}>
                  <Text style={[styles.warningNoteText, { color: '#991b1b', fontWeight: 'bold' }]}>
                    ⚠️ ATENCIÓN: El mensajero tiene {confirmingData.stats.pendientes} pedido(s) sin finalizar (Pendiente/Ruta).
                  </Text>
                  <Text style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>
                    Al liquidar con el botón de abajo, estos pedidos se RECHAZARÁN automáticamente para cerrar el ciclo.
                  </Text>
                </View>
              )}

              <View style={styles.warningNote}>
                <Text style={styles.warningNoteText}>⚠️ Al confirmar, se archivarán los pedidos como "Liquidados" y se cerrará la jornada.</Text>
              </View>

              <View style={[styles.modalBtns, { marginTop: 30 }]}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setIsSettlementConfirmVisible(false)}
                >
                  <Text style={styles.modalBtnText}>No, después</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: confirmingData.stats.pendientes > 0 ? '#ef4444' : '#166534' }]}
                  onPress={async () => {
                    try {
                      setClosingJornada(true);
                      const { data: sett } = await (supabase as any)
                        .from('shift_settlements')
                        .select('id')
                        .eq('messenger_id', confirmingData.rep.id)
                        .eq('status', 'pending')
                        .single();

                      if (sett) {
                        // --- LÓGICA DE LIMPIEZA v7.7 ---
                        if (confirmingData.stats.pendientes > 0) {
                          const incompleteStatuses = ['Pendiente', 'Preparando', 'Enviado'];
                          await supabase
                            .from('orders')
                            .update({ 
                              status: 'No Recibido', 
                              client_rejection_reason: 'Rechazo Administrativo: Cierre de Jornada',
                              client_rejected_at: new Date().toISOString()
                            })
                            .eq('repartidor_id', confirmingData.rep.id)
                            .in('status', incompleteStatuses)
                            .eq('is_settled', false);
                        }

                        const { data: res } = await (supabase.rpc as any)('approve_shift_closure', { p_settlement_id: sett.id });
                        if (res?.success) {
                          setIsSettlementConfirmVisible(false);
                          Alert.alert("¡Éxito! ✅", "Jornada liquidada y ciclo de pedidos cerrado.");
                          fetchData();
                        } else {
                          Alert.alert("Error", res?.error || "Error al liquidar");
                        }
                      } else {
                        Alert.alert("Error", "No se encontró una solicitud pendiente.");
                      }
                    } catch (e: any) {
                      Alert.alert("Error", e.message);
                    } finally {
                      setClosingJornada(false);
                    }
                  }}
                >
                  {closingJornada ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                      {confirmingData.stats.pendientes > 0 ? '⚠️ RECHAZAR Y CERRAR' : 'SÍ, RECIBIDO ✅'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderOrders = () => {
    const rejectedOrders = orders.filter(o => o.status === 'No Recibido');
    const otherOrders = orders.filter(o => o.status !== 'No Recibido');

    return (
      <View style={styles.tabContent}>
        {rejectedOrders.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>⚠️ Pedidos No Recibidos ({rejectedOrders.length})</Text>
            {rejectedOrders.map(order => (
              <View key={order.id} style={[styles.orderCard, { borderColor: '#fecaca', borderLeftWidth: 6, borderLeftColor: '#ef4444' }]}>
                <View style={styles.orderHead}>
                  <View style={styles.orderActionsHeader}>
                    <Text style={[styles.orderId, { color: '#ef4444' }]}>#ORD-{order.id.substring(0, 6).toUpperCase()}</Text>
                    <TouchableOpacity onPress={() => openOrderDetails(order)} style={styles.detailsBtn}>
                      <Text style={styles.detailsBtnText}>👁️ Ver Detalles</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#fee2e2' }]}>
                    <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 10 }}>NO RECIBIDO ✕</Text>
                  </View>
                </View>
                <View style={styles.rejectionDetailBox}>
                  <Text style={styles.rejectionLabel}>Motivo del Rechazo:</Text>
                  <Text style={styles.rejectionReason}>"{order.client_rejection_reason || 'No especificó motivo'}"</Text>
                  <Text style={styles.rejectionDate}>Rechazado el: {new Date(order.client_rejected_at).toLocaleString()}</Text>
                </View>
                <View style={styles.orderBody}>
                  <Text style={styles.orderCustomer}>👥 Cliente: {order.customer_name}</Text>
                  <Text style={styles.orderTotal}>💰 Reclamación por: ${parseFloat(order.total).toLocaleString()}</Text>
                </View>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 }} />
          </>
        )}

        <Text style={styles.sectionTitle}>Órdenes Recientes</Text>
        {otherOrders.length === 0 && rejectedOrders.length === 0 ? (
          <Text style={styles.emptyText}>Aún no hay ventas registradas.</Text>
        ) : (
          otherOrders.map(order => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHead}>
                <View style={styles.orderActionsHeader}>
                  <Text style={styles.orderId}>#ORD-{order.id.substring(0, 6).toUpperCase()}</Text>
                  <TouchableOpacity onPress={() => openOrderDetails(order)} style={styles.detailsBtn}>
                    <Text style={styles.detailsBtnText}>👁️ Ver Detalle</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.statusBadge,
                order.status === 'Pendiente' ? styles.statusPending :
                  order.status === 'Recibida' ? styles.statusReceived :
                    order.status === 'Preparación' ? styles.statusPreparing :
                      order.status === 'Enviado' ? styles.statusShipped :
                        order.status === 'Cancelado' ? { backgroundColor: '#fee2e2', color: '#ef4444' } : styles.statusDone]}>
                  {order.status === 'Cancelado' ? 'No Disponible ✕' : order.status}
                </Text>
              </View>
              <View style={styles.orderBody}>
                <Text style={styles.orderCustomer}>👥 Cliente: {order.customer_name || 'N/A'}</Text>
                <View style={styles.deliveryInfoRow}>
                  <Text style={styles.deliveryLabel}>📍 Entrega:</Text>
                  <Text style={styles.deliveryText}>{order.delivery_address}, {order.neighborhood}</Text>
                </View>
                <Text style={styles.deliveryPhone}>📞 {order.phone_number}</Text>
                <Text style={styles.orderTotal}>💰 Total: ${parseFloat(order.total).toLocaleString()}</Text>
                <Text style={styles.orderDate}>⏰ {new Date(order.created_at).toLocaleString()}</Text>

                {order.status === 'Entregado' && order.order_reviews && order.order_reviews.length > 0 && (
                  <View style={styles.reviewSummaryBlock}>
                    <Text style={styles.reviewSummaryTitle}>Reseña del Cliente ⭐</Text>
                    <Text style={styles.reviewSummaryStars}>{'⭐'.repeat(order.order_reviews[0].rating)}</Text>
                    <Text style={styles.reviewSummaryText}>"{order.order_reviews[0].comment || 'Sin comentario'}"</Text>
                  </View>
                )}
              </View>
              <View style={styles.statusActions}>
                <Text style={styles.actionTitle}>Cambiar Estado:</Text>
                <View style={styles.actionRow}>
                  {['Preparación', 'Enviado'].map(st => {
                    const isPassed = (order.status === 'Enviado' && st === 'Preparación') ||
                      order.status === 'Entregado' ||
                      order.status === 'Confirmado' ||
                      order.status === 'Cancelado';
                    return (
                      <TouchableOpacity key={st}
                        onPress={() => !isPassed && updateOrderStatus(order.id, st)}
                        style={[styles.smallStatusBtn, order.status === st && styles.btnActive, isPassed && styles.btnDisabled]}>
                        <Text style={[styles.smallStatusText, order.status === st && styles.textWhite, isPassed && styles.textDisabled]}>{st}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {(order.status === 'Entregado' || order.status === 'Confirmado') && (
                    <View style={[styles.smallStatusBtn, styles.btnActive, { backgroundColor: '#16a34a', borderColor: '#16a34a' }]}>
                      <Text style={styles.textWhite}>✅ {order.status}</Text>
                    </View>
                  )}
                  {order.status === 'Cancelado' && (
                    <View style={[styles.smallStatusBtn, { backgroundColor: '#ef4444', borderColor: '#ef4444' }]}>
                      <Text style={styles.textWhite}>No Disponible ✕</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  const renderChecklistModal = () => (
    <Modal visible={isChecklistModalVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Preparación de Pedido 📋</Text>
            <TouchableOpacity onPress={() => setIsChecklistModalVisible(false)}><Text style={{ fontSize: 20 }}>✕</Text></TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Marca los productos que ya tienes listos para enviar:</Text>
          <ScrollView style={{ maxHeight: 400 }}>
            {checkingItems.map((item, idx) => (
              <View key={item.id} style={styles.checkItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.checkText, item.fulfilled_quantity === 0 && styles.textMuted]}>
                    {item.products.name}
                  </Text>
                  <Text style={styles.qtyLabel}>Solicitado: {item.quantity}</Text>
                </View>

                <View style={styles.qtySelector}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, item.fulfilled_quantity === 0 && styles.qtyBtnDisabled]}
                    onPress={() => {
                      if (item.fulfilled_quantity > 0) {
                        const newItems = [...checkingItems];
                        newItems[idx].fulfilled_quantity -= 1;
                        setCheckingItems(newItems);
                      }
                    }}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>

                  <View style={styles.qtyValueContainer}>
                    <Text style={[styles.qtyValue, item.fulfilled_quantity < item.quantity && { color: '#ef4444' }]}>
                      {item.fulfilled_quantity}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.qtyBtn, item.fulfilled_quantity >= item.quantity && styles.qtyBtnDisabled]}
                    onPress={() => {
                      if (item.fulfilled_quantity < item.quantity) {
                        const newItems = [...checkingItems];
                        newItems[idx].fulfilled_quantity += 1;
                        setCheckingItems(newItems);
                      }
                    }}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {item.fulfilled_quantity === item.quantity && (
                  <View style={styles.fullCheck}>
                    <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.saveButton} onPress={finishChecklist}>
            <Text style={styles.saveButtonText}>Confirmar Preparación →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderSummaryModal = () => (
    <Modal visible={isSummaryModalVisible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Resumen de Despacho 🚀</Text></View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Pedido vs Despacho:</Text>
            <View style={styles.summaryRow}><Text>Productos solicitados:</Text><Text style={{ fontWeight: 'bold' }}>{checkingItems.length}</Text></View>
            <View style={styles.summaryRow}><Text>Productos a enviar:</Text><Text style={{ fontWeight: 'bold', color: '#16a34a' }}>{checkingItems.filter(i => i.fulfilled_quantity > 0).length}</Text></View>
            {fulfillmentNotes ? (
              <View style={styles.warningNote}><Text style={styles.warningNoteText}>{fulfillmentNotes}</Text></View>
            ) : (
              <View style={styles.successNote}><Text style={styles.successNoteText}>✅ Todo el pedido está completo.</Text></View>
            )}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#f1f5f9' }]} onPress={() => { setIsSummaryModalVisible(false); setIsChecklistModalVisible(true); }}><Text style={{ color: '#64748b', fontWeight: 'bold' }}>Revisar</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#16a34a' }]} onPress={handleFinalizeShipment} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmar Envío</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Text style={styles.backText}>← Salir del Panel</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
          <View style={[
            styles.rtIndicator,
            { backgroundColor: realTimeStatus === 'connected' ? '#22c55e' : realTimeStatus === 'error' ? '#ef4444' : '#f59e0b' }
          ]} />
          <Text style={styles.headerTitle}>Admin Panel 💎</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.shopBtn} onPress={onViewShop}>
            <Text style={styles.shopBtnText}>🛒 Ver Tienda</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.notifBell}
            onPress={() => {
              if (onResetAdminUnread) onResetAdminUnread();
              setNotifModalVisible(true);
            }}
          >
            <Text style={{ fontSize: 24 }}>{adminUnreadCount > 0 ? '🔔' : '🔔'}</Text>
            {adminUnreadCount > 0 ? (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeTextShort}>{adminUnreadCount > 9 ? '+9' : adminUnreadCount}</Text>
              </View>
            ) : pendingOrders.length > 0 ? (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeTextShort}>{pendingOrders.length > 9 ? '+9' : pendingOrders.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContentContainer}
      >
        {[
          { id: 'inventory', label: 'Stock' },
          { id: 'sales', label: 'Ventas' },
          { id: 'orders', label: 'Pedidos' },
          { id: 'repartidores', label: 'Flota' },
          { id: 'settlements', label: 'Liquid.' },
          { id: 'categories', label: 'Tipos' }
        ].map((tab: any) => (
          <TouchableOpacity 
            key={tab.id} 
            style={[styles.tab, activeTab === tab.id && styles.activeTab]} 
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.content}>
        {activeTab === 'inventory' ? renderInventory() : null}
        {activeTab === 'sales' ? <ScrollView showsVerticalScrollIndicator={false}>{renderSales()}</ScrollView> : null}
        {activeTab === 'orders' ? <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>{renderOrders()}</ScrollView> : null}
        {activeTab === 'repartidores' ? renderRepartidores() : null}
        {activeTab === 'categories' ? <ScrollView showsVerticalScrollIndicator={false}>{renderCategories()}</ScrollView> : null}
        {activeTab === 'settlements' ? <ScrollView showsVerticalScrollIndicator={false}>{renderSettlements()}</ScrollView> : null}
      </View>

      {/* MODAL PARA PRODUCTO */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingId ? 'Editar Producto' : 'Nuevo Producto'} 📦</Text>
              <TouchableOpacity onPress={pickImage} style={styles.imagePickerBtn}>
                {image ? <Image source={{ uri: image }} style={styles.previewImage} /> : (
                  <View style={styles.placeholderImg}><Text style={{ fontSize: 30 }}>📷</Text><Text style={styles.placeholderText}>Foto</Text></View>
                )}
              </TouchableOpacity>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} />
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}><Text style={styles.label}>Precio</Text><TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><Text style={styles.label}>Stock</Text><TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="numeric" /></View>
              </View>
              <Text style={styles.label}>Categoría</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat.id} onPress={() => setCategory(cat.name)} style={[styles.catPill, category === cat.name && styles.catPillActive]}>
                    <Text style={[styles.catText, category === cat.name && styles.catTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.label}>Descripción</Text>
              <TextInput style={[styles.input, { minHeight: 80 }]} value={description} onChangeText={setDescription} multiline />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setModalVisible(false)}><Text style={styles.modalBtnText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL NOTIFICACIONES */}
      <Modal visible={notifModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { minHeight: '60%' }]}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Pedidos Nuevos 🔔</Text><TouchableOpacity onPress={() => setNotifModalVisible(false)}><Text style={{ fontSize: 24 }}>✕</Text></TouchableOpacity></View>
            <ScrollView style={{ flex: 1 }}>
              {pendingOrders.map(order => (
                <View key={order.id} style={styles.notifItem}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.notifId}>#ORD-{order.id.substring(0, 6).toUpperCase()}</Text>
                    <Text style={styles.notifCustomer}>{order.customer_name}</Text>
                    <Text style={styles.notifAddress} numberOfLines={1}>📍 {order.delivery_address}</Text>
                    <Text style={styles.atenderBtnText}>Total: ${parseFloat(order.total).toLocaleString()}</Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity
                      style={styles.atenderBtn}
                      onPress={() => {
                        updateOrderStatus(order.id, 'Recibida');
                        if (pendingOrders.length === 1) {
                          setNotifModalVisible(false);
                        }
                      }}
                    >
                      <Text style={styles.atenderBtnText}>Atender ✅</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
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
                          if (window.confirm(`¿Rechazar pedido #ORD-${order.id.substring(0, 6).toUpperCase()}?`)) {
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
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL CATEGORÍA */}
      <Modal visible={catModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { minHeight: '30%', justifyContent: 'center' }]}>
            <Text style={styles.modalTitle}>Nueva Categoría 🏷️</Text>
            <TextInput style={styles.input} value={newCatName} onChangeText={setNewCatName} autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setCatModalVisible(false)}><Text style={styles.modalBtnText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddCategory}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Añadir</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {renderChecklistModal()}
      {renderSummaryModal()}

      {/* MODAL SELECCIONAR REPARTIDOR */}
      <Modal visible={isRepPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { minHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Asignar Repartidor 🛵</Text>
              <TouchableOpacity onPress={() => setIsRepPickerVisible(false)}><Text style={{ fontSize: 24 }}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Selecciona quién llevará el pedido al cliente:</Text>

            <ScrollView style={{ flex: 1 }}>
              {repartidores.length === 0 ? (
                <Text style={styles.emptyText}>No tienes repartidores registrados.</Text>
              ) : repartidores.map(rep => (
                <TouchableOpacity
                  key={rep.id}
                  style={[styles.repPickerItem, selectedRepId === rep.id && styles.repPickerItemActive]}
                  onPress={() => setSelectedRepId(rep.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.repPickerName, selectedRepId === rep.id && styles.textWhite]}>{rep.full_name || 'Sin Nombre'}</Text>
                    {rep.phone && <Text style={[styles.repPickerEmail, selectedRepId === rep.id && styles.textWhite]}>📞 {rep.phone}</Text>}
                    <Text style={[styles.repPickerEmail, selectedRepId === rep.id && styles.textWhite]}>{rep.email}</Text>
                  </View>
                  {selectedRepId === rep.id && <Text style={{ color: '#fff', fontSize: 20 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, !selectedRepId && { opacity: 0.5 }]}
              disabled={!selectedRepId}
              onPress={() => {
                setIsRepPickerVisible(false);
                setIsSummaryModalVisible(true);
              }}
            >
              <Text style={styles.saveButtonText}>Siguiente: Resumen →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {renderSettlementDetailsModal()}
      {renderSettlementConfirmModal()}

      {/* MODAL DETALLES DEL PEDIDO (AUDITORÍA) */}
      <Modal visible={isDetailsModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle del Pedido 🧾</Text>
              <TouchableOpacity onPress={() => setIsDetailsModalVisible(false)}><Text style={{ fontSize: 24 }}>✕</Text></TouchableOpacity>
            </View>

            {viewingOrder && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeaderBlock}>
                  <Text style={styles.detailOrderId}>#{viewingOrder.id.substring(0, 8).toUpperCase()}</Text>
                  <Text style={[styles.statusBadge,
                  viewingOrder.status === 'Pendiente' ? styles.statusPending :
                    viewingOrder.status === 'Recibida' ? styles.statusReceived :
                      viewingOrder.status === 'Preparación' ? styles.statusPreparing :
                        viewingOrder.status === 'Enviado' ? styles.statusShipped : styles.statusDone]}>
                    {viewingOrder.status}
                  </Text>
                </View>

                <Text style={styles.detailSectionTitle}>🕒 Auditoría de Tiempos</Text>
                <View style={styles.timelineContainer}>
                  <View style={styles.timelineItem}><Text>📅 Solicitado:</Text><Text style={styles.timelineVal}>{new Date(viewingOrder.created_at).toLocaleString()}</Text></View>
                  {viewingOrder.prepared_at && <View style={styles.timelineItem}><Text>🥣 Preparado:</Text><Text style={styles.timelineVal}>{new Date(viewingOrder.prepared_at).toLocaleString()}</Text></View>}
                  {viewingOrder.shipped_at && <View style={styles.timelineItem}><Text>🚀 Enviado:</Text><Text style={styles.timelineVal}>{new Date(viewingOrder.shipped_at).toLocaleString()}</Text></View>}
                  {viewingOrder.delivered_at && <View style={styles.timelineItem}><Text>📦 Entregado:</Text><Text style={styles.timelineVal}>{new Date(viewingOrder.delivered_at).toLocaleString()}</Text></View>}
                  {viewingOrder.client_confirmed_at && <View style={styles.timelineItem}><Text>✅ Confirmado:</Text><Text style={styles.timelineVal}>{new Date(viewingOrder.client_confirmed_at).toLocaleString()}</Text></View>}
                </View>

                <Text style={styles.detailSectionTitle}>🛒 Productos (Pedido vs Enviado)</Text>
                <View style={styles.itemsTable}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableCol, { flex: 2 }]}>Producto</Text>
                    <Text style={styles.tableCol}>Ped.</Text>
                    <Text style={styles.tableCol}>Env.</Text>
                  </View>
                  {viewingOrderItems.map(item => (
                    <View key={item.id} style={styles.tableRow}>
                      <Text style={[styles.tableCol, { flex: 2 }]}>{item.products?.name || 'Producto'}</Text>
                      <Text style={styles.tableCol}>{item.quantity}</Text>
                      <Text style={[styles.tableCol, item.fulfilled_quantity < item.quantity && { color: '#ef4444', fontWeight: 'bold' }]}>
                        {item.fulfilled_quantity ?? '--'}
                      </Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.detailSectionTitle}>🛵 Logística</Text>
                <View style={styles.logisticBox}>
                  <Text style={styles.logisticLabel}>Repartidor Asignado:</Text>
                  <Text style={styles.logisticVal}>{viewingOrder.repartidor?.full_name || 'No asignado'}</Text>
                  <Text style={styles.logisticEmail}>{viewingOrder.repartidor?.email || '--'}</Text>
                  {viewingOrder.repartidor?.phone && (
                    <Text style={styles.logisticPhone}>📞 {viewingOrder.repartidor.phone}</Text>
                  )}
                </View>

                {viewingOrder.notes && (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Novedades de preparación:</Text>
                    <Text style={styles.notesText}>{viewingOrder.notes}</Text>
                  </View>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL CREAR/EDITAR REPARTIDOR */}
      <Modal visible={repModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingRepId ? 'Editar Mensajero ✏️' : 'Nuevo Mensajero 🛵'}</Text>
              <TouchableOpacity onPress={() => { setRepModalVisible(false); setEditingRepId(null); setRepEmail(''); setRepName(''); setRepPhone(''); setRepPassword(''); }}><Text style={{ fontSize: 24 }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.form}>
                <Text style={styles.label}>Nombre Completo</Text>
                <TextInput style={styles.input} placeholder="Nombre del trabajador" value={repName} onChangeText={setRepName} />

                <Text style={styles.label}>Teléfono de Contacto</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    style={[styles.input, { width: 80 }]}
                    placeholder="+57"
                    value={repCountryCode}
                    onChangeText={setRepCountryCode}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="3101234567"
                    value={repPhone}
                    onChangeText={setRepPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                <Text style={styles.label}>Nombre de Usuario (Login)</Text>
                <TextInput
                  style={[styles.input, (editingRepId && repEmail) ? { backgroundColor: '#e2e8f0', color: '#64748b' } : {}]}
                  placeholder="ej: carlos123"
                  value={repEmail}
                  onChangeText={setRepEmail}
                  autoCapitalize="none"
                  editable={!editingRepId || !repEmail}
                />

                <Text style={styles.label}>
                  {editingRepId ? 'Nueva Contraseña (Opcional)' : 'Contraseña Temporal'}
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                    placeholder={editingRepId ? "Dejar vacío para no cambiar" : "Asigna una clave (mín. 6)"}
                    value={repPassword}
                    onChangeText={setRepPassword}
                    secureTextEntry={!showRepPassword}
                  />
                  <TouchableOpacity onPress={() => setShowRepPassword(!showRepPassword)} style={styles.eyeBtn}>
                    <Text style={styles.eyeText}>{showRepPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.saveButton, { marginTop: 20 }]} onPress={handleStaffCreation} disabled={repSaving}>
                  {repSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{editingRepId ? 'Actualizar Datos' : 'Guardar y Crear Repartidor'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'ios' ? 20 : 10 },
  header: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 13, fontWeight: '900', color: '#0f172a', flex: 1, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4, width: 70 },
  backText: { color: '#ef4444', fontWeight: '700', fontSize: 11 },
  shopBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  shopBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 10 },
  tabsScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', maxHeight: 42, minHeight: 42 },
  tabsContentContainer: { paddingHorizontal: 12, alignItems: 'center' },
  tab: { paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', borderRadius: 20, marginRight: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
  activeTab: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  tabText: { color: '#64748b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
  activeTabText: { color: '#fff' },
  filterScroll: { marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  filterText: { color: '#64748b', fontWeight: 'bold', fontSize: 11 },
  filterTextActive: { color: '#fff' },
  customDateBox: { marginBottom: 12, backgroundColor: '#f8fafc', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  repStatContainer: { marginTop: 8 },
  content: { flex: 1 },
  tabContent: { padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  addButton: { backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  itemCard: { backgroundColor: '#fff', padding: 12, borderRadius: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  itemName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  itemStock: { color: '#64748b', fontSize: 13, marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#16a34a' },
  orderCard: { backgroundColor: '#fff', padding: 12, borderRadius: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#0f172a' },
  orderHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderBody: { paddingVertical: 6 },
  orderId: { fontWeight: 'bold', color: '#0f172a', fontSize: 14 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontWeight: 'bold', overflow: 'hidden' },
  // ... rest stay the same for brevity or I can skip them if not requested
  statusShipped: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  statusDone: { backgroundColor: '#dcfce7', color: '#16a34a' },
  rejectionDetailBox: {
    backgroundColor: '#fff1f2',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ef4444',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  rejectionReason: {
    fontSize: 13,
    color: '#7f1d1d',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  rejectionDate: {
    fontSize: 9,
    color: '#991b1b',
    marginTop: 6,
    fontWeight: '600',
  },
  statusPending: { backgroundColor: '#e2e8f0', color: '#64748b' },
  statusPreparing: { backgroundColor: '#fef3c7', color: '#d97706' },
  statusReceived: { backgroundColor: '#dcfce7', color: '#16a34a' },
  orderCustomer: { color: '#64748b', marginBottom: 2, fontSize: 12 },
  orderDate: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  orderTotal: { fontWeight: '700', fontSize: 14, color: '#16a34a', marginTop: 2 },
  statusActions: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  actionRow: { flexDirection: 'row', gap: 6 },
  smallStatusBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  btnActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  smallStatusText: { fontSize: 10, fontWeight: '600', color: '#64748b' },
  textWhite: { color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabel: { color: '#64748b', fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  mockChart: { height: 140, backgroundColor: '#f1f5f9', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
  itemMainInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  checkItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  qtyLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  qtySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  qtyBtn: { width: 32, height: 32, backgroundColor: '#fff', borderRadius: 8, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  qtyBtnDisabled: { opacity: 0.5, backgroundColor: '#f1f5f9' },
  qtyBtnText: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  qtyValueContainer: { paddingHorizontal: 12, minWidth: 40, alignItems: 'center' },
  qtyValue: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  fullCheck: { marginLeft: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center' },
  reviewCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewCustomer: { fontWeight: 'bold', color: '#0f172a' },
  starsSmall: { flexDirection: 'row' },
  reviewComment: { color: '#475569', fontSize: 13, fontStyle: 'italic' },
  reviewDate: { color: '#94a3b8', fontSize: 11, marginTop: 8 },
  reviewSummaryBlock: { marginTop: 12, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  reviewSummaryTitle: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  reviewSummaryStars: { fontSize: 12, marginBottom: 4 },
  reviewSummaryText: { fontSize: 13, color: '#0f172a', fontStyle: 'italic' },
  smallImage: { width: 44, height: 44, borderRadius: 8 },
  itemCategory: { color: '#94a3b8', fontSize: 12 },
  itemActions: { alignItems: 'flex-end' },
  actionBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { padding: 4, backgroundColor: '#f8fafc', borderRadius: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  approveClosureBtn: { backgroundColor: '#16a34a', padding: 12, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  approveClosureText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  settlementDateHeader: { fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 12, paddingHorizontal: 4 },
  settlementItem: { backgroundColor: '#fff', padding: 20, borderRadius: 24, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  settlementUser: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  settlementOrders: { fontSize: 12, color: '#64748b', marginTop: 2 },
  settlementBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  settlementBadgeText: { fontSize: 10, fontWeight: '800' },
  settlementAmount: { fontSize: 20, fontWeight: '900', color: '#16a34a' },
  settlementDetailHeader: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 24, marginBottom: 20 },
  settlementDetailUser: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  settlementDetailTotal: { fontSize: 24, fontWeight: '900', color: '#16a34a', marginVertical: 4 },
  settlementDetailDate: { fontSize: 12, color: '#64748b' },
  settlementOrderCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  settlementOrderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  settlementOrderTitle: { fontWeight: '800', color: '#0f172a' },
  settlementOrderPrice: { fontWeight: '900', color: '#16a34a' },
  settlementOrderInfo: { fontSize: 12, color: '#64748b' },
  settlementReviewBox: { padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#fbbf24' },
  settlementReviewRating: { fontSize: 13, fontWeight: 'bold', color: '#fbbf24' },
  settlementReviewComment: { fontSize: 13, color: '#475569', fontStyle: 'italic', marginTop: 4 },
  settlementRejectionBox: { backgroundColor: '#fff1f2', padding: 12, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: '#fecaca' },
  settlementRejectionLabel: { fontSize: 10, fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', marginBottom: 2 },
  settlementRejectionReason: { fontSize: 13, color: '#991b1b', fontStyle: 'italic' },
  settlementRejectionDate: { fontSize: 10, color: '#991b1b', marginTop: 6, opacity: 0.8 },
  checkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#e2e8f0', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  checkText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  textMuted: { color: '#94a3b8', textDecorationLine: 'line-through' },
  saveButton: { backgroundColor: '#0f172a', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  summaryBox: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 24, marginBottom: 20 },
  summaryLabel: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  warningNote: { backgroundColor: '#fff7ed', padding: 12, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: '#ffedd5' },
  warningNoteText: { color: '#c2410c', fontSize: 13, fontWeight: '600' },
  successNote: { backgroundColor: '#f0fdf4', padding: 12, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: '#dcfce7' },
  successNoteText: { color: '#15803d', fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalActionBtn: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
  notifItem: { flexDirection: 'row', padding: 16, backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 12 },
  notifId: { fontWeight: 'bold' },
  notifCustomer: { fontSize: 14, fontWeight: '600' },
  notifAddress: { fontSize: 12, color: '#64748b' },
  atenderBtn: { backgroundColor: '#16a34a', padding: 10, borderRadius: 10, justifyContent: 'center' },
  atenderBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  deliveryInfoRow: { marginVertical: 4 },
  deliveryLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  deliveryText: { fontSize: 13 },
  deliveryPhone: { fontSize: 13, color: '#2563eb', fontWeight: 'bold' },
  notifBell: { position: 'relative' },
  notifBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  placeholderImg: { alignItems: 'center' },
  placeholderText: { fontSize: 12, color: '#94a3b8' },
  imagePickerBtn: { width: '100%', height: 120, backgroundColor: '#f1f5f9', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  previewImage: { width: '100%', height: '100%', borderRadius: 16 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginTop: 10 },
  form: { marginTop: 10 },
  input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  catScroll: { marginVertical: 10 },
  catPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#eee', marginRight: 10 },
  catPillActive: { backgroundColor: '#16a34a' },
  catText: { fontSize: 12 },
  catTextActive: { color: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#eee' },
  saveBtn: { backgroundColor: '#16a34a' },
  modalBtnText: { fontWeight: 'bold' },
  notifBadgeTextShort: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  categoryListItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  categoryListItemText: { fontSize: 16 },
  catScrollAdmin: { marginBottom: 10 },
  catPillSmall: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#eee', borderRadius: 10, marginRight: 10 },
  catPillSmallActive: { backgroundColor: '#0f172a' },
  catTextSmall: { fontSize: 12 },
  repMiniStat: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  repMiniName: { fontWeight: '700', color: '#0f172a' },
  repMiniValue: { color: '#16a34a', fontWeight: '800' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  repCard: { backgroundColor: '#fff', padding: 18, borderRadius: 24, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  repInfo: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10, marginBottom: 12 },
  repName: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  repEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  repStatsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  repStatItem: { alignItems: 'center', flex: 1 },
  repStatVal: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  repStatLab: { fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', marginTop: 2, fontWeight: '700', textAlign: 'center' },
  orderActionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flex: 1 },
  detailsBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  detailsBtnText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  btnDisabled: { opacity: 0.5, backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  textDisabled: { color: '#94a3b8' },
  repPickerItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  repPickerItemActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  repPickerName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  repPickerEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  detailHeaderBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 20 },
  detailOrderId: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  detailSectionTitle: { fontSize: 14, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  timelineContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  timelineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  timelineVal: { fontWeight: '600', color: '#0f172a', fontSize: 13 },
  itemsTable: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableCol: { flex: 1, fontSize: 13, color: '#0f172a' },
  logisticBox: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#dcfce7' },
  logisticLabel: { fontSize: 11, color: '#15803d', fontWeight: '800', textTransform: 'uppercase' },
  logisticVal: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  logisticEmail: { fontSize: 13, color: '#16a34a', marginTop: 2 },
  logisticPhone: { fontSize: 13, color: '#2563eb', marginTop: 4, fontWeight: '700' },
  notesBox: { backgroundColor: '#fff7ed', padding: 16, borderRadius: 16, marginTop: 15, borderWidth: 1, borderColor: '#ffedd5' },
  notesLabel: { fontSize: 11, color: '#c2410c', fontWeight: '800', textTransform: 'uppercase' },
  notesText: { fontSize: 13, color: '#9a3412', marginTop: 4 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4 },
  eyeBtn: { padding: 12, justifyContent: 'center', alignItems: 'center' },
  eyeText: { fontSize: 18 },
  confirmSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  confirmDataBox: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  confirmLabel: { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' },
  confirmValue: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  confirmAmount: { fontSize: 32, fontWeight: '900', color: '#166534', marginTop: 4 },
  rtIndicator: { width: 8, height: 8, borderRadius: 4 },
});
