import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import LandingScreen from './src/screens/LandingScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import CartScreen from './src/screens/CartScreen';
import { Product } from './src/store/useCartStore';

import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import OrderStatusScreen from './src/screens/OrderStatusScreen';
import MyOrdersScreen from './src/screens/MyOrdersScreen';
import DeliveryDashboardScreen from './src/screens/DeliveryDashboardScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Landing');
  const [selectedProduct, setSelectedProduct] = useState<Product| null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  return (
    <View style={{ flex: 1 }}>
      {currentScreen === 'Landing' ? (
        <LandingScreen onNavigate={setCurrentScreen} />
      ) : null}
      
      {currentScreen === 'Home' ? (
        <HomeScreen 
          onProductPress={(p) => { setSelectedProduct(p); setCurrentScreen('ProductDetail'); }} 
          onNavigateToCart={() => setCurrentScreen('Cart')} 
          onNavigateToLanding={() => setCurrentScreen('Landing')}
          onNavigate={setCurrentScreen}
        />
      ) : null}

      {currentScreen === 'AdminDashboard' ? (
        <AdminDashboardScreen onBack={() => setCurrentScreen('Landing')} />
      ) : null}

      {currentScreen === 'DeliveryDashboard' ? (
        <DeliveryDashboardScreen onLogout={() => setCurrentScreen('Landing')} />
      ) : null}

      {currentScreen === 'MyOrders' ? (
        <MyOrdersScreen 
          onBack={() => setCurrentScreen('Home')}
        />
      ) : null}
      
      {currentScreen === 'ProductDetail' ? (
        selectedProduct ? (
          <ProductDetailScreen 
            product={selectedProduct} 
            onBack={() => setCurrentScreen('Home')}
            onNavigateToCart={() => setCurrentScreen('Cart')}
          />
        ) : null
      ) : null}

      {currentScreen === 'Cart' ? (
        <CartScreen 
          onBack={() => setCurrentScreen('Home')}
          onOrderSuccess={(id) => {
            setLastOrderId(id);
            setCurrentScreen('OrderStatus');
          }}
        />
      ) : null}

      {currentScreen === 'OrderStatus' ? (
        lastOrderId ? (
          <OrderStatusScreen 
            orderId={lastOrderId} 
            onBack={() => setCurrentScreen('Home')} 
          />
        ) : null
      ) : null}
      
      <StatusBar style={currentScreen === 'Landing' ? "light" : "dark"} />
    </View>
  );
}