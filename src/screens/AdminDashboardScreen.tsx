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
  Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

export default function AdminDashboardScreen({ onBack, onViewShop }: { onBack: () => void, onViewShop: () => void }) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales' | 'orders' | 'categories' | 'repartidores'>('inventory');
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [repartidores, setRepartidores] = useState<any[]>([]);
  const [stats, setStats] = useState({ today: 0, month: 0 });
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
  const [repPhone, setRepPhone] = useState('');
  const [repSaving, setRepSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: invData } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      setInventory(invData || []);

      const { data: ordData } = await supabase.from('orders').select('*, order_reviews(*)').order('created_at', { ascending: false });
      setOrders(ordData || []);

      const { data: revData } = await supabase.from('order_reviews').select('*, orders(customer_name)').order('created_at', { ascending: false });
      setReviews(revData || []);

      const { data: catData } = await supabase.from('categories').select('*').order('name', { ascending: true });
      setCategories(catData || []);

      const recOrders = ordData ? ordData.filter((o: any) => o.status === 'Pendiente').sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : [];
      setPendingOrders(recOrders);

      // 3. Repartidores (Profiles with role = 'repartidor')
      const { data: reps } = await supabase.from('profiles').select('*').eq('role', 'repartidor').order('full_name', { ascending: true });
      setRepartidores(reps || []);

      // 4. Invitaciones Pendientes (Lista Blanca)
      const { data: invites } = await supabase.from('staff_pre_auth').select('*');
      setPendingInvites(invites || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
    const subscription = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchData();
        if (payload.eventType === 'INSERT') {
           Alert.alert("🔔 ¡Nuevo Pedido!", "Se ha recibido un nuevo pedido en la tienda.");
        }
      })
      .subscribe();

    return () => {
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
    const finalStates = ['Entregado', 'Confirmado'];
    if (finalStates.includes(order.status)) {
      return Alert.alert("Acción Bloqueada", "Este pedido ya ha sido finalizado y no puede volver a estados anteriores.");
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
      fetchData();
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

  const handleStaffCreation = async () => {
    if (!repEmail || !repName || !repPhone) return Alert.alert("Error", "Completa nombre, correo y teléfono.");
    if (!repEmail.includes('@')) return Alert.alert("Error", "Correo inválido.");
    
    setRepSaving(true);
    try {
      // 1. Verificar si ya existe para evitar duplicados
      const { data: profile, error: userErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', repEmail)
          .maybeSingle();

      if (profile) {
        await supabase.from('profiles').update({ role: 'repartidor', full_name: repName, phone: repPhone }).eq('email', repEmail);
        Alert.alert("Éxito", "Usuario actualizado a repartidor.");
      } else {
        // Phase 26/27: Pre-autorización en Lista Blanca con Teléfono
        const { error: inviteError } = await supabase
          .from('staff_pre_auth')
          .upsert({ email: repEmail, role: 'repartidor', phone: repPhone });
        
        if (inviteError) throw inviteError;
        Alert.alert("Lista Blanca", "Mensajero pre-autorizado. Recibirá su rol y teléfono automático al registrarse.");
      }
      setRepModalVisible(false);
      setRepEmail('');
      setRepName('');
      setRepPhone('');
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
      { text: "Eliminar", style: "destructive", onPress: async () => {
          const { error } = await supabase.from('products').delete().eq('id', id);
          if (error) Alert.alert("Error", error.message);
          else fetchData();
        } 
      }
    ]);
  };

  const renderInventory = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mi Inventario</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openForm()}>
          <Text style={styles.addButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScrollAdmin}>
        {['Todas', ...categories.map(c => c.name)].map(cat => (
          <TouchableOpacity key={cat} onPress={() => setSelectedInventoryCategory(cat)}
            style={[styles.catPillSmall, selectedInventoryCategory === cat && styles.catPillSmallActive]}>
            <Text style={[styles.catTextSmall, selectedInventoryCategory === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading ? (
        <ActivityIndicator color="#16a34a" size="large" style={{ marginTop: 40 }} />
      ) : inventory.length === 0 ? (
        <Text style={styles.emptyText}>No hay productos registrados.</Text>
      ) : (
        inventory.filter(item => selectedInventoryCategory === 'Todas' || item.category === selectedInventoryCategory).map((item) => (
          <View key={item.id} style={styles.itemCard}>
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
        ))
      )}
    </View>
  );

  const renderSales = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Resumen de Ventas</Text>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Hoy</Text>
          <Text style={styles.statValue}>${stats.today.toLocaleString()}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>${stats.month.toLocaleString()}</Text>
        </View>
      </View>
      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Gráfico de Rendimiento</Text>
      <View style={styles.mockChart}><Text style={{color: '#64748b'}}>Visualización de datos en tiempo real...</Text></View>

      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Rendimiento por Repartidor 🛵</Text>
      {repartidores.length === 0 ? (
        <Text style={styles.emptyText}>No hay repartidores para analizar.</Text>
      ) : (
        repartidores.map(rep => {
          const repOrders = orders.filter(o => o.repartidor_id === rep.id && o.status === 'Entregado');
          const total = repOrders.reduce((acc, o) => acc + parseFloat(o.total), 0);
          return (
            <View key={rep.id} style={styles.repMiniStat}>
              <Text style={styles.repMiniName}>{rep.full_name || rep.email}</Text>
              <Text style={styles.repMiniValue}>${total.toLocaleString()} ({repOrders.length} ped.)</Text>
            </View>
          );
        })
      )}

      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Últimas Reseñas ⭐</Text>
      {reviews.length === 0 ? (
        <Text style={styles.emptyText}>Aún no hay reseñas de clientes.</Text>
      ) : (
        reviews.map(review => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHead}>
              <Text style={styles.reviewCustomer}>{review.orders?.customer_name || 'Cliente'}</Text>
              <View style={styles.starsSmall}>
                {[1, 2, 3, 4, 5].map(s => (
                  <Text key={s} style={{ fontSize: 10, opacity: s <= review.rating ? 1 : 0.2 }}>⭐</Text>
                ))}
              </View>
            </View>
            <Text style={styles.reviewComment}>"{review.comment || 'Sin comentario'}"</Text>
            <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
          </View>
        ))
      )}
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
      { text: "Borrar", style: "destructive", onPress: async () => { await supabase.from('categories').delete().eq('id', id); fetchData(); }}
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
    const repartidorStats: { [key: string]: { entregas: number; recaudado: number; total_tiempo: number } } = {};

    orders.forEach(order => {
      if (order.repartidor_id && order.status === 'Entregado') {
        if (!repartidorStats[order.repartidor_id]) {
          repartidorStats[order.repartidor_id] = { entregas: 0, recaudado: 0, total_tiempo: 0 };
        }
        repartidorStats[order.repartidor_id].entregas += 1;
        repartidorStats[order.repartidor_id].recaudado += parseFloat(order.total);
        if (order.delivered_at && order.shipped_at) {
          const diff = new Date(order.delivered_at).getTime() - new Date(order.shipped_at).getTime();
          repartidorStats[order.repartidor_id].total_tiempo += (diff / 1000 / 60);
        }
      }
    });

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Gestión de Mensajeros 🛵</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setRepModalVisible(true)}>
            <Text style={styles.addButtonText}>+ Nuevo Mensajero / Repartidor</Text>
          </TouchableOpacity>
        </View>

        {repartidores.length === 0 && pendingInvites.length === 0 ? (
          <Text style={styles.emptyText}>No tienes repartidores registrados aún.</Text>
        ) : (
          <>
            {repartidores.map(rep => {
               const stats = repartidorStats[rep.id] || { entregas: 0, recaudado: 0, total_tiempo: 0 };
               const avgTime = stats.entregas > 0 ? (stats.total_tiempo / stats.entregas).toFixed(1) : '0';
               return (
                <View key={rep.id} style={styles.repCard}>
                  <View style={styles.repInfo}>
                    <Text style={styles.repName}>{rep.full_name || 'Sin nombre'}</Text>
                    <Text style={styles.repEmail}>{rep.email}</Text>
                  </View>
                  <View style={styles.repStatsRow}>
                    <View style={styles.repStatItem}>
                      <Text style={styles.repStatVal}>{stats.entregas}</Text>
                      <Text style={styles.repStatLab}>Pedidos</Text>
                    </View>
                    <View style={styles.repStatItem}>
                      <Text style={styles.repStatVal}>${stats.recaudado.toLocaleString()}</Text>
                      <Text style={styles.repStatLab}>Recaudado</Text>
                    </View>
                    <View style={styles.repStatItem}>
                      <Text style={styles.repStatVal}>{avgTime}m</Text>
                      <Text style={styles.repStatLab}>Promedio</Text>
                    </View>
                  </View>
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

  const renderOrders = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Órdenes Recientes</Text>
      {orders.length === 0 ? (
        <Text style={styles.emptyText}>Aún no hay ventas registradas.</Text>
      ) : (
        orders.map(order => (
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
                order.status === 'Enviado' ? styles.statusShipped : styles.statusDone]}>
                {order.status}
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
                                    order.status === 'Confirmado';
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
               </View>
            </View>
          </View>
        ))
      )}
    </View>
  );

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
        <Text style={styles.headerTitle}>Admin Panel 💎</Text>
        <View style={styles.headerRight}>
           <TouchableOpacity style={styles.shopBtn} onPress={onViewShop}>
             <Text style={styles.shopBtnText}>🛒 Ver Tienda</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.notifBell} onPress={() => setNotifModalVisible(true)}>
             <Text style={{ fontSize: 24 }}>🔔</Text>
             {pendingOrders.length > 0 ? (
               <View style={styles.notifBadge}><Text style={styles.notifBadgeTextShort}>{pendingOrders.length > 9 ? '+9' : pendingOrders.length}</Text></View>
             ) : null}
           </TouchableOpacity>
        </View>
      </View>
      <View style={styles.tabs}>
        {[
          { id: 'inventory', label: '📦 Stock' },
          { id: 'sales', label: '📊 Ventas' },
          { id: 'orders', label: '🧾 Pedidos' },
          { id: 'repartidores', label: '🛵 Flota' },
          { id: 'categories', label: '🏷️ Tipos' }
        ].map((tab: any) => (
          <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.activeTab]} onPress={() => setActiveTab(tab.id)}>
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={styles.content}>
        {activeTab === 'inventory' ? renderInventory() : null}
        {activeTab === 'sales' ? renderSales() : null}
        {activeTab === 'orders' ? renderOrders() : null}
        {activeTab === 'repartidores' ? renderRepartidores() : null}
        {activeTab === 'categories' ? renderCategories() : null}
      </ScrollView>

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
                       <TouchableOpacity style={styles.atenderBtn} onPress={() => { updateOrderStatus(order.id, 'Recibida'); if (pendingOrders.length === 1) setNotifModalVisible(false); }}>
                          <Text style={styles.atenderBtnText}>Atender ✅</Text>
                       </TouchableOpacity>
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

      {/* MODAL CREAR REPARTIDOR */}
      <Modal visible={repModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '65%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Mensajero 🛵</Text>
              <TouchableOpacity onPress={() => setRepModalVisible(false)}><Text style={{ fontSize: 24 }}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.form}>
              <Text style={styles.label}>Nombre Completo</Text>
              <TextInput style={styles.input} placeholder="Nombre del trabajador" value={repName} onChangeText={setRepName} />
              
              <Text style={styles.label}>Correo Electrónico</Text>
              <TextInput style={styles.input} placeholder="trabajador@gmail.com" value={repEmail} onChangeText={setRepEmail} autoCapitalize="none" keyboardType="email-address" />
              
              <Text style={styles.label}>Teléfono de Contacto</Text>
              <TextInput style={styles.input} placeholder="Ej: 3101234567" value={repPhone} onChangeText={setRepPhone} keyboardType="phone-pad" />

              <TouchableOpacity style={styles.saveButton} onPress={handleStaffCreation} disabled={repSaving}>
                {repSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar / Invitar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  header: { padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', flex: 1, textAlign: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { padding: 5, width: 80 },
  backText: { color: '#ef4444', fontWeight: '600', fontSize: 12 },
  shopBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  shopBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 11 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', padding: 10 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: '#0f172a' },
  tabText: { color: '#64748b', fontWeight: '600' },
  activeTabText: { color: '#fff' },
  content: { flex: 1 },
  tabContent: { padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  addButton: { backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  itemCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  itemName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  itemStock: { color: '#64748b', fontSize: 14, marginTop: 4 },
  itemPrice: { fontSize: 16, fontWeight: '800', color: '#16a34a' },
  orderCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#0f172a' },
  orderHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderBody: { paddingVertical: 8 },
  orderId: { fontWeight: 'bold', color: '#0f172a' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 12, fontWeight: 'bold', overflow: 'hidden' },
  statusDone: { backgroundColor: '#dcfce7', color: '#16a34a' },
  statusReceived: { backgroundColor: '#dcfce7', color: '#16a34a' },
  statusPending: { backgroundColor: '#e2e8f0', color: '#64748b' },
  statusPreparing: { backgroundColor: '#fef3c7', color: '#d97706' },
  statusShipped: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  orderCustomer: { color: '#64748b', marginBottom: 4, fontSize: 13 },
  orderDate: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  orderTotal: { fontWeight: '700', fontSize: 15, color: '#16a34a', marginTop: 4 },
  statusActions: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  actionRow: { flexDirection: 'row', gap: 8 },
  smallStatusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  btnActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  smallStatusText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  textWhite: { color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabel: { color: '#64748b', fontSize: 14, marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  mockChart: { height: 160, backgroundColor: '#f1f5f9', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
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
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
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
  repCard: { backgroundColor: '#fff', padding: 20, borderRadius: 24, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  repInfo: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12, marginBottom: 12 },
  repName: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  repEmail: { fontSize: 14, color: '#64748b', marginTop: 2 },
  repStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  repStatItem: { alignItems: 'center', flex: 1 },
  repStatVal: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  repStatLab: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginTop: 4, fontWeight: '700' },
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
});
