import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import LandingScreen from './src/screens/LandingScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import CartScreen from './src/screens/CartScreen';
import { Product } from './src/store/useCartStore';

import AdminDashboardScreen from './src/screens/AdminDashboardScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Landing');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  return (
    <View style={{ flex: 1 }}>
      {currentScreen === 'Landing' && (
        <LandingScreen onNavigate={setCurrentScreen} />
      )}
      
      {currentScreen === 'Home' && (
        <HomeScreen 
          onProductPress={(p) => { setSelectedProduct(p); setCurrentScreen('ProductDetail'); }} 
          onNavigateToCart={() => setCurrentScreen('Cart')} 
          onNavigateToLanding={() => setCurrentScreen('Landing')}
        />
      )}

      {currentScreen === 'AdminDashboard' && (
        <AdminDashboardScreen onBack={() => setCurrentScreen('Landing')} />
      )}
      
      {currentScreen === 'ProductDetail' && selectedProduct && (
        <ProductDetailScreen 
          product={selectedProduct} 
          onBack={() => setCurrentScreen('Home')}
          onNavigateToCart={() => setCurrentScreen('Cart')}
        />
      )}

      {currentScreen === 'Cart' && (
        <CartScreen 
          onBack={() => setCurrentScreen('Home')}
          onCheckout={() => Alert.alert("Checkout", "Redirigiendo a pasarela...")}
        />
      )}
      
      <StatusBar style={currentScreen === 'Landing' ? "light" : "dark"} />
    </View>
  );
}