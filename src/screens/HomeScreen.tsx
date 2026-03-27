import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Product, useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';

// Categorías se cargan desde Supabase

const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Reloj Premium X',
    price: '$299.00',
    priceValue: 299.00,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
  },
  {
    id: '2',
    name: 'Auriculares Pro Noir',
    price: '$189.99',
    priceValue: 189.99,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
  },
  {
    id: '3',
    name: 'Zapatillas Neo Run',
    price: '$120.00',
    priceValue: 120.00,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80',
  },
  {
    id: '4',
    name: 'Lámpara de Diseño',
    price: '$85.00',
    priceValue: 85.00,
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=500&q=80',
  },
];

interface HomeScreenProps {
  onProductPress: (product: Product) => void;
  onNavigateToCart: () => void;
  onNavigateToLanding: () => void;
  onNavigateToAdmin: () => void;
  onNavigate: (screen: string) => void;
}

export default function HomeScreen({ onProductPress, onNavigateToCart, onNavigateToLanding, onNavigateToAdmin, onNavigate }: HomeScreenProps) {
  const user = useAuthStore(state => state.user);
  const role = useAuthStore(state => state.role);
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todo']);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(false);
  
  const addItem = useCartStore(state => state.addItem);
  const cartItemsCount = useCartStore((state) => state.items.reduce((acc, item) => acc + item.quantity, 0));

  const checkNotifications = async () => {
    if (!user) return;
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('client_viewed_status', false);
    
    if (!error) {
      setHasNotifications((count || 0) > 0);
    }
  };

  const fetchProducts = async () => {
    checkNotifications();
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: catData } = await supabase.from('categories').select('name').order('name', { ascending: true });
      if (catData) {
        setCategories(['Todo', ...catData.map(c => c.name)]);
      }

      if (error) throw error;

      if (data && data.length > 0) {
        // Mapear datos de DB al formato de la interfaz Product
        const formattedProducts: Product[] = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: `$${parseFloat(p.price).toLocaleString()}`,
          priceValue: parseFloat(p.price),
          rating: 4.5 + Math.random() * 0.5,
          image: p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
          category: p.category || 'Otros',
          description: p.description || ''
        }));
        setProducts(formattedProducts);
      } else {
        setProducts(INITIAL_PRODUCTS);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts(INITIAL_PRODUCTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchProducts();
    
    if (user) {
      const subscription = supabase
        .channel(`user-notifications-${user.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        }, () => {
          checkNotifications();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Mi Tienda de Barrio,</Text>
          <Text style={styles.username}>MarketApp Pro 👋</Text>
        </View>
        <View style={styles.headerActions}>
          {role === 'admin' && (
            <TouchableOpacity style={styles.adminIconBtn} onPress={onNavigateToAdmin}>
              <Text style={styles.adminIconEmoji}>⚙️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => onNavigateToLanding()}>
            <Text style={styles.iconEmoji}>🚪</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => onNavigate('MyOrders')}>
            <Text style={styles.iconEmoji}>📋</Text>
            {hasNotifications ? (
              <View style={styles.notificationDot} />
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onNavigateToCart}>
            <Text style={styles.iconEmoji}>🛒</Text>{cartItemsCount > 0 ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{cartItemsCount}</Text></View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              placeholder="¿Qué buscas hoy? (Arroz, leche...)"
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {categories.map((cat, i) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(i)}
              style={[styles.categoryPill, activeCategory === i && styles.categoryPillActive]}
            >
              <Text style={[styles.categoryText, activeCategory === i && styles.categoryTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured Banner */}
        <View style={styles.bannerContainer}>
          <View style={styles.banner}>
            <View style={styles.bannerDecor} />
            <Text style={styles.bannerTitle}>Nueva Colección</Text>
            <Text style={styles.bannerSubtitle}>Descubre lo último en tecnología</Text>
            <TouchableOpacity style={styles.bannerBtn}>
              <Text style={styles.bannerBtnText}>Ver Todo →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Products Grid */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Populares</Text>
            <TouchableOpacity onPress={fetchProducts}>
              <Text style={styles.seeMore}>Actualizar</Text>
            </TouchableOpacity>
          </View>
          
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.grid}>
              {products
                .filter(p => {
                  const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
                  const matchesCategory = activeCategory === 0 || p.category === categories[activeCategory];
                  return matchesSearch && matchesCategory;
                })
                .map(product => (
                <TouchableOpacity 
                  key={product.id} 
                  style={styles.productCard}
                  onPress={() => onProductPress(product)}
                >
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: product.image }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity style={styles.wishlistBtn}>
                      <Text style={{ fontSize: 14 }}>❤️</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                    <View style={styles.ratingRow}>
                      <Text style={{ fontSize: 11 }}>⭐</Text>
                      <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>{product.price}</Text>
                      <TouchableOpacity 
                        style={styles.addBtn}
                        onPress={() => {
                          addItem(product);
                          Alert.alert("🛒 Carrito", `${product.name} añadido correctamente.`);
                        }}
                      >
                        <Text style={styles.addBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  greeting: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
  username: { color: '#0f172a', fontSize: 20, fontWeight: '700', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: { backgroundColor: '#f1f5f9', padding: 10, borderRadius: 50, position: 'relative' },
  adminIconBtn: { backgroundColor: '#0f172a', padding: 10, borderRadius: 50, position: 'relative', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  iconEmoji: { fontSize: 20 },
  adminIconEmoji: { fontSize: 20 },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff'},
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  notificationDot: { position: 'absolute', top: 5, right: 5, width: 12, height: 12, backgroundColor: '#ef4444', borderRadius: 6, borderWidth: 2, borderColor: '#ffffff' },
  searchContainer: { paddingHorizontal: 20, paddingTop: 20 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  categoriesScroll: { marginTop: 20 },
  categoryPill: {
    marginRight: 12, paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 50, backgroundColor: '#e2e8f0',
  },
  categoryPillActive: { backgroundColor: '#16a34a' },
  categoryText: { fontWeight: '600', color: '#475569' },
  categoryTextActive: { color: '#ffffff' },
  bannerContainer: { paddingHorizontal: 20, marginTop: 24 },
  banner: {
    backgroundColor: '#0f172a', borderRadius: 24, padding: 24,
    overflow: 'hidden', minHeight: 140, justifyContent: 'center',
  },
  bannerDecor: {
    position: 'absolute', bottom: -40, right: -40, width: 150, height: 150,
    borderRadius: 75, backgroundColor: '#16a34a', opacity: 0.2,
  },
  bannerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  bannerSubtitle: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  bannerBtn: {
    backgroundColor: '#16a34a', alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 14,
  },
  bannerBtnText: { color: '#ffffff', fontWeight: '700' },
  productsSection: { paddingHorizontal: 20, marginTop: 24, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  seeMore: { color: '#16a34a', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  productCard: {
    width: '48%', backgroundColor: '#ffffff', borderRadius: 16,
    marginBottom: 16, padding: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  imageContainer: { position: 'relative' },
  productImage: { width: '100%', height: 140, borderRadius: 12 },
  wishlistBtn: {
    position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 5, borderRadius: 50,
  },
  productInfo: { marginTop: 10 },
  productName: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingText: { color: '#94a3b8', fontSize: 11, marginLeft: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  price: { color: '#16a34a', fontWeight: '700', fontSize: 14 },
  addBtn: { backgroundColor: '#0f172a', padding: 6, borderRadius: 8 },
  addBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
});
