import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { useCartStore, Product } from '../store/useCartStore';

interface ProductDetailProps {
  product: Product;
  onBack: () => void;
  onNavigateToCart: () => void;
}

export default function ProductDetailScreen({ product, onBack, onNavigateToCart }: ProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((state) => state.addItem);
  const cartItemsCount = useCartStore((state) => state.items.reduce((acc, item) => acc + item.quantity, 0));

  const handleAddToCart = () => {
    addItem(product, quantity);
    // Optional: add some haptic feedback or toast message here in the future
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
          <Text style={styles.iconEmoji}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={onNavigateToCart}>
           <Text style={styles.iconEmoji}>🛒</Text>
           {cartItemsCount > 0 && (
             <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartItemsCount}</Text>
             </View>
           )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: product.image_url }} style={styles.image} resizeMode="cover" />
          <TouchableOpacity style={styles.heartBtn}>
             <Text style={{ fontSize: 20 }}>❤️</Text>
          </TouchableOpacity>
        </View>

        {/* Product Info */}
        <View style={styles.infoContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{product.name}</Text>
              <View style={styles.ratingBadge}>
                <Text style={{ fontSize: 12 }}>⭐</Text>
                <Text style={styles.ratingText}>{product.rating}</Text>
              </View>
            </View>
            
            <Text style={styles.price}>${product.price.toFixed(2)}</Text>

            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.description}>
              {product.description || 'Producto premium de alta calidad. Diseñado con los mejores materiales para asegurar durabilidad y estilo. Perfecto para elevar tu experiencia diaria.'}
            </Text>

            <View style={styles.divider} />

            {/* Quantity Selector */}
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Cantidad</Text>
              <View style={styles.quantityControl}>
                <TouchableOpacity 
                   style={styles.qtyBtn} 
                   onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{quantity}</Text>
                <TouchableOpacity 
                   style={styles.qtyBtn} 
                   onPress={() => setQuantity(quantity + 1)}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
         <View>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalPrice}>${(product.priceValue * quantity).toFixed(2)}</Text>
         </View>
         <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart}>
            <Text style={styles.addToCartBtnText}>Añadir al Carrito</Text>
         </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  iconBtn: { backgroundColor: '#ffffff', padding: 12, borderRadius: 50, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2, position: 'relative' },
  iconEmoji: { fontSize: 20 },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff'},
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  scrollContent: { paddingBottom: 100 },
  imageContainer: { paddingHorizontal: 20, marginTop: 10, position: 'relative' },
  image: { width: '100%', height: 350, borderRadius: 32 },
  heartBtn: { position: 'absolute', top: 20, right: 40, backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 50 },
  infoContainer: { paddingHorizontal: 24, marginTop: 30 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a', flex: 1, marginRight: 16, lineHeight: 32 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  ratingText: { color: '#d97706', fontWeight: '700', fontSize: 14, marginLeft: 4 },
  price: { fontSize: 24, fontWeight: '800', color: '#16a34a', marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 30, marginBottom: 12 },
  description: { fontSize: 15, lineHeight: 24, color: '#64748b' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 24 },
  quantityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  quantityLabel: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 16, padding: 4 },
  qtyBtn: { backgroundColor: '#ffffff', width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  qtyBtnText: { fontSize: 20, fontWeight: '600', color: '#0f172a' },
  qtyValue: { fontSize: 18, fontWeight: '700', color: '#0f172a', width: 40, textAlign: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: -10 }, elevation: 10 },
  totalLabel: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  totalPrice: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  addToCartBtn: { backgroundColor: '#16a34a', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 20 },
  addToCartBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
});
