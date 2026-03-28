// IMPORTACIÓN ULTRA-DIRECTA (con extensión .js para Metro)
import 'react-native-url-polyfill/js/URL.js';
import 'react-native-url-polyfill/js/URLSearchParams.js';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// --- CONFIGURACIÓN DE TU BASE DE DATOS SUPABASE ---
const supabaseUrl = 'https://rofrdxjvriirweyddxqw.supabase.co';
const supabaseAnonKey = 'sb_publishable_GHYlZxay_YzT-pRVFJMq0Q_Y2iGfLjR';
// --------------------------------------------------

// Cliente tipado: las consultas ahora conocen el esquema completo de tu BD
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Tipos de conveniencia para usar en los componentes sin imports extra
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Profile = Tables<'profiles'>;
export type Order   = Tables<'orders'>;
export type Product = Tables<'products'>;
export type OrderItem = Tables<'order_items'>;
