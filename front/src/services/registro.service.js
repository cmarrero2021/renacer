// src/services/registro.service.js
// Servicio para el sistema de autorregistro de usuarios
import { authApi } from 'boot/axios';

export const registroService = {
    // Paso 1: solicitar código de confirmación (validez 24 h)
    requestCode: (email) => authApi.post('/registro/request-code', { email }),
    // Paso 2: verificar código -> retorna registroToken
    verifyCode: (email, code) => authApi.post('/registro/verify-code', { email, code }),
    // Paso 3: consultar identidad (requiere registroToken)
    consultarIdentidad: (registroToken, nacionalidad, cedula) =>
        authApi.post(
            '/registro/consultar-identidad',
            { nacionalidad, cedula: parseInt(cedula, 10) },
            { headers: { Authorization: `Bearer ${registroToken}` } }
        ),
    // Extrae datos del RIF a partir de un archivo (base64) — para CARGAR RIF
    readRif: (registroToken, archivoBase64, nombreArchivo) =>
        authApi.post(
            '/registro/read-rif',
            { archivoBase64, nombreArchivo },
            { headers: { Authorization: `Bearer ${registroToken}` } }
        ),
    // Paso 5: completar registro (usuario + centro)
    completar: (registroToken, payload) =>
        authApi.post('/registro/completar', payload, {
            headers: { Authorization: `Bearer ${registroToken}` }
        }),
};
