import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ImageBackground, 
  TouchableOpacity, 
  StatusBar, 
  Modal, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Alert
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function LandingScreen({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [loginVisible, setLoginVisible] = useState(false);
  const [signupVisible, setSignupVisible] = useState(false);
  const [adminVisible, setAdminVisible] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const setUser = useAuthStore(state => state.setUser);
  const setAdmin = useAuthStore(state => state.setAdmin);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async () => {
    if (!validateEmail(email)) return Alert.alert("Error", "Email inválido");
    if (password.length < 6) return Alert.alert("Error", "Cédula/Contraseña muy corta");

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);

      if (error) {
        Alert.alert("Error de Acceso", error.message);
      } else {
        setUser(data.user);
        setAdmin(false);
        setLoginVisible(false);
        onNavigate('Home');
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error de Red", "No se pudo conectar al servidor. Verifica tu conexión a internet y las credenciales de Supabase en src/lib/supabase.ts");
    }
  };

  const handleSignup = async () => {
    if (!fullName) return Alert.alert("Error", "Ingresa tu nombre completo");
    if (!validateEmail(email)) return Alert.alert("Error", "Email inválido");
    if (password.length < 6) return Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres");

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      setLoading(false);

      if (error) {
        Alert.alert("Error en Registro", error.message);
      } else {
        Alert.alert("¡Éxito!", "Cuenta creada. Por favor verifica tu correo.");
        setSignupVisible(false);
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error de Red", "Fallo al conectar con la base de datos. Asegúrate de configurar la URL y KEY reales en src/lib/supabase.ts");
    }
  };

  const handleAdminLogin = () => {
    // Credenciales por defecto solicitadas por el usuario
    if (email === 'admin@marketapp.pro' && password === 'Admin123!') {
      setAdmin(true);
      setUser({ email: 'admin@marketapp.pro', role: 'admin' });
      setAdminVisible(false);
      onNavigate('AdminDashboard');
    } else {
      Alert.alert("Acceso Denegado", "Credenciales de administrador inválidas.");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070' }} 
        style={styles.backgroundImage}
      >
        <View style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoEmoji}>💎</Text>
              </View>
              <Text style={styles.logoText}>MarketApp Pro</Text>
            </View>
            
            <View style={styles.mainContent}>
              <Text style={styles.title}>Estilo.{'\n'}Elegancia.{'\n'}Exclusividad.</Text>
              <Text style={styles.subtitle}>
                Tu marketplace premium con seguridad garantizada y gestión en tiempo real.
              </Text>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setLoginVisible(true)}>
                <Text style={styles.primaryButtonText}>Iniciar Sesión</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setSignupVisible(true)}>
                <Text style={styles.secondaryButtonText}>Crear una Cuenta</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.adminLink} onPress={() => setAdminVisible(true)}>
                <Text style={styles.adminLinkText}>Acceso Administrativo 🔒</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>

      {/* LOGIN MODAL */}
      <Modal visible={loginVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Inicia Sesión</Text>
                <TouchableOpacity onPress={() => setLoginVisible(false)} style={styles.closeBtn}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.form}>
                <Text style={styles.label}>Correo electrónico</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="ejemplo@correo.com" 
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
                
                <Text style={styles.label}>Contraseña</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="********" 
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Entrar</Text>}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ADMIN MODAL */}
      <Modal visible={adminVisible} animationType="fade" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: '50%', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderRadius: 24, margin: 20 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Panel de Control ⚙️</Text>
                <TouchableOpacity onPress={() => setAdminVisible(false)} style={styles.closeBtn}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.form}>
                <TextInput 
                  style={styles.input} 
                  placeholder="Admin Email" 
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
                <TextInput 
                  style={[styles.input, { marginTop: 12 }]} 
                  placeholder="Admin Password" 
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#0f172a' }]} onPress={handleAdminLogin}>
                  <Text style={styles.submitBtnText}>Autenticar Admin</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* SIGNUP MODAL */}
      <Modal visible={signupVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Crea tu Cuenta</Text>
                <TouchableOpacity onPress={() => setSignupVisible(false)} style={styles.closeBtn}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.form}>
                <Text style={styles.label}>Nombre completo</Text>
                <TextInput style={styles.input} placeholder="Jarlin Esquivel" value={fullName} onChangeText={setFullName} />
                
                <Text style={styles.label}>Correo electrónico</Text>
                <TextInput style={styles.input} placeholder="ejemplo@correo.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                
                <Text style={styles.label}>Contraseña</Text>
                <TextInput style={styles.input} placeholder="Mínimo 6 caracteres" value={password} onChangeText={setPassword} secureTextEntry />

                <TouchableOpacity style={styles.submitBtn} onPress={handleSignup} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Registrarse</Text>}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, resizeMode: 'cover' },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)' },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 80, paddingBottom: 40, justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)', width: 48, height: 48, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
  },
  logoEmoji: { fontSize: 24 },
  logoText: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  mainContent: { flex: 1, justifyContent: 'center', marginTop: 40 },
  title: { color: '#ffffff', fontSize: 52, fontWeight: '900', lineHeight: 60, marginBottom: 24 },
  subtitle: { color: '#cbd5e1', fontSize: 18, lineHeight: 28, fontWeight: '400' },
  footer: { width: '100%' },
  primaryButton: { 
    backgroundColor: '#16a34a', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginBottom: 16,
    shadowColor: '#16a34a', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { 
    backgroundColor: 'transparent', paddingVertical: 18, borderRadius: 16, alignItems: 'center', 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginBottom: 20
  },
  secondaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  adminLink: { alignSelf: 'center', padding: 8 },
  adminLinkText: { color: '#94a3b8', fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center' },
  modalContent: { 
    backgroundColor: '#ffffff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32,
    minHeight: '60%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20,
    justifyContent: 'center'
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  closeBtn: { backgroundColor: '#f1f5f9', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  closeText: { fontSize: 16, color: '#64748b' },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8, marginTop: 16 },
  input: { 
    backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, 
    fontSize: 16, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' 
  },
  submitBtn: { 
    backgroundColor: '#16a34a', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 32,
    shadowColor: '#16a34a', shadowOpacity: 0.2, shadowRadius: 8
  },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
});
