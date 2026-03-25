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

// Los mocks se mantienen solo como referencia de interfaz si es necesario

export default function AdminDashboardScreen({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales' | 'orders' | 'categories'>('inventory');
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]); // Added categories state
  const [stats, setStats] = useState({ today: 0, month: 0 });
  const [loading, setLoading] = useState(true);
  
  // States for Add/Edit Product
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('Alimentos');
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // States for Category Management
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState('Todas');

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Inventory
      const { data: invData } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      setInventory(invData || []);

      // 2. Fetch Orders
      const { data: ordData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      setOrders(ordData || []);

      // 3. Fetch Categories
      const { data: catData } = await supabase.from('categories').select('*').order('name', { ascending: true });
      setCategories(catData || []);

      // 4. Simple Stats Calculation
      if (ordData) {
        const todaySum = ordData.filter((o: any) => new Date(o.created_at).toDateString() === new Date().toDateString())
          .reduce((acc, o) => acc + parseFloat(o.total), 0);
        const monthSum = ordData.reduce((acc, o) => acc + parseFloat(o.total), 0);
        setStats({ today: todaySum, month: monthSum });
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
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

  const openForm = (product?: any) => {
    if (product) {
      setEditingId(product.id);
      setName(product.name);
      setPrice(product.price.toString());
      setStock(product.stock.toString());
      setCategory(product.category || 'Alimentos');
      setImage(product.image_url);
    } else {
      setEditingId(null);
      setName('');
      setPrice('');
      setStock('');
      setCategory('Alimentos');
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

  const handleDelete = (id: string) => {
    Alert.alert(
      "Eliminar Producto",
      "¿Estás seguro de que quieres borrar este producto?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive", 
          onPress: async () => {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) Alert.alert("Error", error.message);
            else fetchData();
          } 
        }
      ]
    );
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
          <TouchableOpacity 
            key={cat} 
            onPress={() => setSelectedInventoryCategory(cat)}
            style={[styles.catPillSmall, selectedInventoryCategory === cat && styles.catPillSmallActive]}
          >
            <Text style={[styles.catTextSmall, selectedInventoryCategory === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#16a34a" size="large" style={{ marginTop: 40 }} />
      ) : inventory.length === 0 ? (
        <Text style={styles.emptyText}>No hay productos registrados.</Text>
      ) : (
        inventory
          .filter(item => selectedInventoryCategory === 'Todas' || item.category === selectedInventoryCategory)
          .map((item) => (
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
                  <TouchableOpacity onPress={() => openForm(item)} style={styles.actionBtn}>
                    <Text style={{ fontSize: 16 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
      )}
    </View>
  );

  const renderOrders = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Órdenes Recientes</Text>
      {orders.length === 0 ? (
        <Text style={styles.emptyText}>Aún no hay ventas registradas.</Text>
      ) : (
        orders.map(order => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderHead}>
              <Text style={styles.orderId}>#ORD-{order.id.substring(0, 6)}</Text>
              <Text style={[styles.statusBadge, order.status === 'Pendiente' ? styles.statusPending : styles.statusDone]}>
                {order.status}
              </Text>
            </View>
            <Text style={styles.orderCustomer}>Usuario ID: {order.user_id?.substring(0, 8)}</Text>
            <Text style={styles.orderTotal}>Total: ${parseFloat(order.total).toLocaleString()}</Text>
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
      <View style={styles.mockChart}>
        <Text style={{color: '#64748b'}}>Visualización de datos en tiempo real...</Text>
      </View>
    </View>
  );

  const handleAddCategory = async () => {
    if (!newCatName) return;
    setSaving(true);
    const { error } = await supabase.from('categories').insert([{ name: newCatName }]);
    setSaving(false);
    if (error) Alert.alert("Error", error.message);
    else {
      setNewCatName('');
      setCatModalVisible(false);
      fetchData();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    Alert.alert("Borrar Categoría", "¿Seguro? Los productos con esta categoría no la perderán, pero ya no se filtrarán igual.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: async () => {
        await supabase.from('categories').delete().eq('id', id);
        fetchData();
      }}
    ]);
  };

  const renderCategories = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🏷️ Gestión de Categorías</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setCatModalVisible(true)}>
          <Text style={styles.addButtonText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>
      {categories.map(cat => (
        <View key={cat.id} style={styles.categoryListItem}>
          <Text style={styles.categoryListItemText}>{cat.name}</Text>
          <TouchableOpacity onPress={() => handleDeleteCategory(cat.id)}>
            <Text style={{ fontSize: 16 }}>🗑️</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Salir del Panel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel 💎</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'inventory' && styles.activeTab]} 
          onPress={() => setActiveTab('inventory')}
        >
          <Text style={[styles.tabText, activeTab === 'inventory' && styles.activeTabText]}>📦 Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'sales' && styles.activeTab]} 
          onPress={() => setActiveTab('sales')}
        >
          <Text style={[styles.tabText, activeTab === 'sales' && styles.activeTabText]}>📊 Ventas</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'orders' && styles.activeTab]} 
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>🧾 Pedidos</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'categories' && styles.activeTab]} 
          onPress={() => setActiveTab('categories')}
        >
          <Text style={[styles.tabText, activeTab === 'categories' && styles.activeTabText]}>🏷️ Tipos</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'sales' && renderSales()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'categories' && renderCategories()}
      </ScrollView>

      {/* MODAL PARA NUEVO/EDITAR PRODUCTO */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingId ? 'Editar Producto' : 'Nuevo Producto'} 📦</Text>
              
              <TouchableOpacity onPress={pickImage} style={styles.imagePickerBtn}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.previewImage} />
                ) : (
                  <View style={styles.placeholderImg}>
                    <Text style={{ fontSize: 30 }}>📷</Text>
                    <Text style={styles.placeholderText}>Añadir Foto</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre del producto" />
              
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>Precio</Text>
                  <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="2500" keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Stock</Text>
                  <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="10" keyboardType="numeric" />
                </View>
              </View>

              <Text style={styles.label}>Categoría</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {categories.map(cat => (
                  <TouchableOpacity 
                    key={cat.id} 
                    onPress={() => setCategory(cat.name)}
                    style={[styles.catPill, category === cat.name && styles.catPillActive]}
                  >
                    <Text style={[styles.catText, category === cat.name && styles.catTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Confirmar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL PARA NUEVA CATEGORÍA */}
      <Modal visible={catModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { minHeight: '30%', justifyContent: 'center' }]}>
            <Text style={styles.modalTitle}>Nueva Categoría 🏷️</Text>
            <TextInput style={styles.input} value={newCatName} onChangeText={setNewCatName} placeholder="Ej: Navidad, Bebidas..." autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setCatModalVisible(false)}>
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddCategory} disabled={saving}>
                <Text style={styles.modalBtnText}>Añadir</Text>
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
  header: { 
    padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  backBtn: { padding: 5 },
  backText: { color: '#ef4444', fontWeight: '600' },
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
  itemCard: { 
    backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0'
  },
  itemName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  itemStock: { color: '#64748b', fontSize: 14, marginTop: 4 },
  itemPrice: { fontSize: 16, fontWeight: '800', color: '#16a34a' },
  orderCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#0f172a' },
  orderHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderId: { fontWeight: 'bold', color: '#0f172a' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 12, fontWeight: 'bold' },
  statusPending: { backgroundColor: '#fef3c7', color: '#d97706' },
  statusDone: { backgroundColor: '#dcfce7', color: '#16a34a' },
  orderCustomer: { color: '#64748b', marginBottom: 4 },
  orderTotal: { fontWeight: '800', fontSize: 16, color: '#0f172a' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabel: { color: '#64748b', fontSize: 14, marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  mockChart: { height: 200, backgroundColor: '#f1f5f9', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontSize: 16 },
  
  itemMainInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 10 },
  smallImage: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#f1f5f9' },
  itemCategory: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  itemActions: { alignItems: 'flex-end', justifyContent: 'space-between', minWidth: 80 },
  actionBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { padding: 4, backgroundColor: '#f8fafc', borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, minHeight: '80%' },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  imagePickerBtn: { width: '100%', height: 140, borderRadius: 20, backgroundColor: '#f8fafc', borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 10 },
  previewImage: { width: '100%', height: '100%' },
  placeholderImg: { alignItems: 'center' },
  placeholderText: { color: '#94a3b8', fontWeight: '600', fontSize: 12, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  catScroll: { marginTop: 10, marginBottom: 10 },
  catPill: { marginRight: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  catPillActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  catText: { color: '#64748b', fontWeight: '600', fontSize: 12 },
  catTextActive: { color: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 30 },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  saveBtn: { backgroundColor: '#16a34a' },
  modalBtnText: { fontWeight: 'bold', color: '#0f172a' },
  categoryListItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  categoryListItemText: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  catScrollAdmin: { marginBottom: 16, maxHeight: 40 },
  catPillSmall: { marginRight: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  catPillSmallActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  catTextSmall: { fontSize: 12, fontWeight: '600', color: '#64748b' }
});
