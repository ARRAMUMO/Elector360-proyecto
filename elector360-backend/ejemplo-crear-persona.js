#!/usr/bin/env node

/**
 * EJEMPLO - Crear Persona Manualmente
 *
 * Este script demuestra cómo crear una persona de forma manual
 * usando la API del backend.
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function ejemploCrearPersona() {
  try {
    console.log('🔐 Paso 1: Login para obtener token...\n');

    // 1. Login para obtener token
    const loginResponse = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      email: 'admin@elector360.com',
      password: 'password123'
    });

    const token = loginResponse.data.data.accessToken;
    const usuario = loginResponse.data.data.user;

    console.log('✅ Login exitoso');
    console.log(`   Usuario: ${usuario.perfil.nombres} ${usuario.perfil.apellidos}`);
    console.log(`   Rol: ${usuario.rol}\n`);

    // 2. Crear persona con datos mínimos
    console.log('📝 Paso 2: Creando persona con datos mínimos...\n');

    const personaMinima = {
      documento: '1234567890'
    };

    const response1 = await axios.post(
      `${BASE_URL}/api/v1/personas`,
      personaMinima,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('✅ Persona creada (datos mínimos):');
    console.log(`   Documento: ${response1.data.data.documento}`);
    console.log(`   ID: ${response1.data.data._id}`);
    console.log(`   Líder: ${response1.data.data.lider.nombre}`);
    console.log(`   Origen: ${response1.data.data.origen}\n`);

    // 3. Crear persona con datos completos
    console.log('📝 Paso 3: Creando persona con datos completos...\n');

    const personaCompleta = {
      documento: '9876543210',
      nombres: 'María del Carmen',
      apellidos: 'González Pérez',
      fechaNacimiento: '1985-03-20',
      telefono: '3101234567',
      email: 'maria.gonzalez@example.com',
      lugarNacimiento: {
        departamento: 'CUNDINAMARCA',
        municipio: 'BOGOTÁ'
      },
      puesto: {
        departamento: 'CUNDINAMARCA',
        municipio: 'BOGOTÁ',
        zona: 'ZONA 1',
        nombrePuesto: 'COLEGIO SAN JOSÉ',
        direccion: 'Carrera 7 #10-20',
        mesa: '003'
      },
      estadoContacto: 'CONFIRMADO',
      notas: 'Contactada por teléfono, confirma asistencia a votación'
    };

    const response2 = await axios.post(
      `${BASE_URL}/api/v1/personas`,
      personaCompleta,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('✅ Persona creada (datos completos):');
    console.log(`   Documento: ${response2.data.data.documento}`);
    console.log(`   Nombre: ${response2.data.data.nombres} ${response2.data.data.apellidos}`);
    console.log(`   Teléfono: ${response2.data.data.telefono}`);
    console.log(`   Email: ${response2.data.data.email}`);
    console.log(`   Estado Contacto: ${response2.data.data.estadoContacto}`);
    console.log(`   Puesto: ${response2.data.data.puesto.nombrePuesto}`);
    console.log(`   Mesa: ${response2.data.data.puesto.mesa}`);
    console.log(`   ID: ${response2.data.data._id}\n`);

    // 4. Listar personas creadas
    console.log('📋 Paso 4: Listando personas creadas...\n');

    const listarResponse = await axios.get(`${BASE_URL}/api/v1/personas`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: 1,
        limit: 10
      }
    });

    console.log(`✅ Total de personas: ${listarResponse.data.data.pagination.total}`);
    console.log('   Personas:');

    listarResponse.data.data.personas.forEach((persona, index) => {
      console.log(`   ${index + 1}. ${persona.documento} - ${persona.nombres || 'Sin nombre'} ${persona.apellidos || ''}`);
    });

    console.log('\n✨ Ejemplo completado exitosamente!');
    console.log('\n📚 Consulta CREAR_PERSONA_MANUAL.md para más información\n');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data?.message || error.message);

    if (error.response?.data?.errors) {
      console.error('\n   Errores de validación:');
      error.response.data.errors.forEach(err => {
        console.error(`   - ${err.field}: ${err.message}`);
      });
    }

    console.log('\n💡 Sugerencias:');
    console.log('   1. Verifica que el servidor esté corriendo (npm start)');
    console.log('   2. Verifica las credenciales en .env');
    console.log('   3. Verifica que MongoDB esté conectado\n');

    process.exit(1);
  }
}

// Ejecutar ejemplo
ejemploCrearPersona();
