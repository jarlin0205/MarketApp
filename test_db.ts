import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Se asume que las variables de entorno están en la PC o en el código.
// Vamos a importar la instancia configurada si funciona
import { supabase } from './src/lib/supabase';

async function checkDatabase() {
    console.log("Conectando a Supabase para verificar imágenes...");
    const { data, error } = await supabase
        .from('products')
        .select('name, image_url')
        .limit(5);

    if (error) {
        console.error("Error consultando productos:", error);
    } else {
        console.log("Muestra de Productos en Base de Datos:");
        data.forEach(p => {
            const urlType = p.image_url?.startsWith('data:image') 
                ? '[BASE64 VALIDO]' 
                : p.image_url?.startsWith('http') 
                    ? '[URL DE INTERNET]' 
                    : p.image_url?.startsWith('file://') 
                        ? '[RUTA FISICA LOCAL ROTA]'
                        : '[DESCONOCIDO/VACIO]';
            
            console.log(`- ${p.name}`);
            console.log(`  Tipo: ${urlType}`);
            console.log(`  Contenido: ${p.image_url?.substring(0, 60)}...`);
            console.log("-----------------------------------------");
        });
    }
}

checkDatabase();
