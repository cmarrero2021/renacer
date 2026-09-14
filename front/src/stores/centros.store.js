// src/stores/centros.store.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { centrosService, fichasService, geoService, centroAccessService, maintenanceService } from 'src/services/centros.service';

import { userService } from 'src/services/user.service';

import { Notify } from 'quasar';

export const useCentrosStore = defineStore('centros', () => {
    // ─── Estado ───────────────────────────────────────────────────────────────
    const centros = ref([]);
    const current = ref(null);   // Centro seleccionado
    const ficha = ref(null);   // Ficha activa del centro seleccionado
    const loading = ref(false);
    const centroUsers = ref([]); // Usuarios con acceso delegado al centro actual
    const userCentros = ref([]); // Centros a los que un usuario tiene acceso
    const maintenanceLogs = ref([]);




    // Geo-catálogos
    const estados = ref([]);
    const municipios = ref([]);
    const parroquias = ref([]);
    const currentEstadoId = ref(null);
    const currentMunicipioId = ref(null);

    // ─── Getters ──────────────────────────────────────────────────────────────
    const centroCount = computed(() => centros.value.length);

    // ─── Acciones: geo-catálogos ──────────────────────────────────────────────
    async function fetchEstados(force = false) {
        if (estados.value.length && !force) return; // cache
        try {
            const { data } = await geoService.getEstados();
            estados.value = data;
        } catch {
            Notify.create({ type: 'negative', message: 'Error al cargar estados.' });
        }
    }

    async function fetchMunicipios(estadoId) {
        currentEstadoId.value = estadoId;
        municipios.value = [];
        parroquias.value = [];
        if (!estadoId) return;
        try {
            const { data } = await geoService.getMunicipios(estadoId);
            municipios.value = data;
        } catch {
            Notify.create({ type: 'negative', message: 'Error al cargar municipios.' });
        }
    }

    async function fetchParroquias(municipioId, estadoId) {
        currentMunicipioId.value = municipioId;
        if (estadoId) currentEstadoId.value = estadoId;
        parroquias.value = [];
        if (!municipioId) return;
        try {
            const { data } = await geoService.getParroquias(municipioId, estadoId || currentEstadoId.value);
            parroquias.value = data;
        } catch {
            Notify.create({ type: 'negative', message: 'Error al cargar parroquias.' });
        }
    }

    async function refreshGeoCatalog(cat) {
        if (!cat || ['estados', 'paises'].includes(cat)) {
            await fetchEstados(true);
        }
        if (!cat || cat === 'municipios') {
            if (currentEstadoId.value) {
                try {
                    const { data } = await geoService.getMunicipios(currentEstadoId.value);
                    municipios.value = data;
                } catch (e) {
                    console.error('Error refrescando municipios:', e);
                }
            }
        }
        if (!cat || cat === 'parroquias') {
            if (currentMunicipioId.value) {
                try {
                    const { data } = await geoService.getParroquias(currentMunicipioId.value, currentEstadoId.value);
                    parroquias.value = data;
                } catch (e) {
                    console.error('Error refrescando parroquias:', e);
                }
            }
        }
    }

    // Escuchar actualizaciones en tiempo real de catálogos geográficos
    if (typeof window !== 'undefined') {
        window.addEventListener('catalogs-updated', (event) => {
            const cat = event?.detail?.catalog;
            if (!cat || ['estados', 'municipios', 'parroquias', 'paises'].includes(cat)) {
                refreshGeoCatalog(cat);
            }
        });
    }


    // ─── Acciones: centros ────────────────────────────────────────────────────
    async function fetchCentros() {
        loading.value = true;
        try {
            const { data } = await centrosService.list();
            centros.value = data;
        } catch {
            Notify.create({ type: 'negative', message: 'Error al cargar los centros.' });
        } finally {
            loading.value = false;
        }
    }

    async function fetchCentro(id) {
        loading.value = true;
        try {
            const { data } = await centrosService.get(id);
            current.value = data;
            return data;
        } catch (err) {
            console.error('[ERROR] getCentro:', err?.response?.status, err?.response?.data);
            Notify.create({ type: 'negative', message: 'Error al cargar el centro.' });
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function createCentro(payload) {
        loading.value = true;
        try {
            const { data } = await centrosService.create(payload);
            centros.value.push(data.centro);
            Notify.create({ type: 'positive', message: 'Centro registrado exitosamente.' });
            return data.centro;
        } catch (err) {
            Notify.create({ type: 'negative', message: err?.response?.data?.error || 'Error al crear el centro.' });
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function updateCentro(id, payload) {
        loading.value = true;
        try {
            const { data } = await centrosService.update(id, payload);
            const idx = centros.value.findIndex(c => c.id === id);
            if (idx !== -1) centros.value[idx] = { ...centros.value[idx], ...data.centro };
            if (current.value?.id === id) current.value = { ...current.value, ...data.centro };
            Notify.create({ type: 'positive', message: 'Centro actualizado.' });
            return true;
        } catch (err) {
            Notify.create({ type: 'negative', message: err?.response?.data?.error || 'Error al actualizar el centro.' });
            return false;
        } finally {
            loading.value = false;
        }
    }

    async function deleteCentro(id) {
        try {
            await centrosService.delete(id);
            centros.value = centros.value.filter(c => c.id !== id);
            Notify.create({ type: 'positive', message: 'Centro eliminado.' });
        } catch {
            Notify.create({ type: 'negative', message: 'Error al eliminar el centro.' });
        }
    }

    // ─── Acciones: fichas ─────────────────────────────────────────────────────
    async function fetchFichaActual(centroId) {
        loading.value = true;
        try {
            const { data } = await fichasService.getActual(centroId);
            ficha.value = data;
            return data;
        } catch (err) {
            console.error('[ERROR] getFichaActual:', err?.response?.status, err?.response?.data);
            if (err?.response?.status !== 404) {
                Notify.create({ type: 'negative', message: 'Error al cargar la ficha.' });
            }
            ficha.value = null;
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function saveFicha(centroId, payload) {
        loading.value = true;
        try {
            const method = ficha.value?.id
                ? fichasService.update(ficha.value.id, payload)
                : fichasService.create(centroId, payload);
            const { data } = await method;
            Notify.create({ type: 'positive', message: 'Ficha guardada exitosamente.' });
            return data;
        } catch (err) {
            Notify.create({ type: 'negative', message: err?.response?.data?.error || 'Error al guardar la ficha.' });
            return null;
        } finally {
            loading.value = false;
        }
    }

    // ─── Acciones: Acceso Delegado ───────────────────────────────────────────
    async function fetchCentroUsers(centroId) {
        try {
            const { data } = await centroAccessService.listUsers(centroId);
            centroUsers.value = data;
        } catch {
            Notify.create({ type: 'negative', message: 'Error al cargar usuarios del centro.' });
        }
    }

    async function grantAccess(centroId, userId, accessLevel = 'read') {
        try {
            const levelVal = typeof accessLevel === 'object' && accessLevel !== null ? accessLevel.value : accessLevel;
            await centroAccessService.grant(centroId, { user_id: userId, access_level: levelVal || 'read' });
            await fetchCentroUsers(centroId);
            Notify.create({ type: 'positive', message: 'Acceso otorgado correctamente.' });
            return true;
        } catch (err) {
            const errorMsg = err?.response?.data?.detail 
                ? `${err.response.data.error}: ${err.response.data.detail}`
                : (err?.response?.data?.error || 'Error al otorgar acceso.');
            Notify.create({ type: 'negative', message: errorMsg });
            return false;
        }
    }

    async function revokeAccess(centroId, userId) {
        try {
            await centroAccessService.revoke(centroId, userId);
            centroUsers.value = centroUsers.value.filter(u => u.id !== userId);
            Notify.create({ type: 'positive', message: 'Acceso revocado.' });
            return true;
        } catch {
            Notify.create({ type: 'negative', message: 'Error al revocar acceso.' });
            return false;
        }
    }

    async function searchUsers(query) {
        try {
            const { data } = await userService.list({ search: query });
            return data;
        } catch {
            return [];
        }
    }

    async function fetchUserCentros(userId) {
        try {
            const { data } = await userService.listCentros(userId);
            userCentros.value = data;
        } catch {
            Notify.create({ type: 'negative', message: 'Error al cargar centros del usuario.' });
        }
    }

    async function purgeDeleted() {
        loading.value = true;
        try {
            const { data } = await maintenanceService.purgeDeleted();
            Notify.create({ type: 'positive', message: data.message });
            await fetchMaintenanceLogs(); 
            return true;
        } catch (err) {
            Notify.create({ type: 'negative', message: err?.response?.data?.error || 'Error al purgar los registros.' });
            return false;
        } finally {
            loading.value = false;
        }
    }

    async function fetchMaintenanceLogs() {
        loading.value = true;
        try {
            const { data } = await maintenanceService.getMaintenanceLogs();
            maintenanceLogs.value = data;
        } catch (err) {
            console.error('Error fetching maintenance logs:', err);
            Notify.create({ type: 'negative', message: 'Error al cargar la bitácora de mantenimiento.' });
        } finally {
            loading.value = false;
        }
    }

    async function uploadFoto(centroId, file) {
        // Validar tamaño: 1 MB = 1,048,576 bytes
        if (file.size > 1048576) {
            Notify.create({ type: 'negative', message: 'La foto excede el límite de 1 MB.' });
            return false;
        }
        loading.value = true;
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const { data } = await centrosService.uploadFoto(centroId, base64);
            // Actualizar el estado local del centro con la nueva foto
            if (current.value) {
                current.value = { ...current.value, foto_base64: data.foto_base64 };
            }
            Notify.create({ type: 'positive', message: 'Foto guardada correctamente.' });
            return true;
        } catch (err) {
            const msg = err?.response?.data?.error || 'Error al guardar la foto.';
            Notify.create({ type: 'negative', message: msg });
            return false;
        } finally {
            loading.value = false;
        }
    }

    async function deleteFoto(centroId) {
        loading.value = true;
        try {
            await centrosService.deleteFoto(centroId);
            if (current.value) {
                current.value = { ...current.value, foto_base64: null };
            }
            Notify.create({ type: 'positive', message: 'Foto eliminada.' });
            return true;
        } catch (err) {
            Notify.create({ type: 'negative', message: err?.response?.data?.error || 'Error al eliminar la foto.' });
            return false;
        } finally {
            loading.value = false;
        }
    }



    return {

        // State
        centros, current, ficha, loading,
        estados, municipios, parroquias,
        currentEstadoId, currentMunicipioId,
        // Getters
        centroCount,
        // Actions - geo
        fetchEstados, fetchMunicipios, fetchParroquias, refreshGeoCatalog,
        // Actions - centros
        fetchCentros, fetchCentro, createCentro, updateCentro, deleteCentro,
        // Actions - foto
        uploadFoto, deleteFoto,
        // Actions - fichas
        fetchFichaActual, saveFicha,
        // Actions - acceso
        centroUsers, fetchCentroUsers, grantAccess, revokeAccess, searchUsers,
        // Actions - asignación simétrica
        userCentros, fetchUserCentros,
        // Maintenance
        purgeDeleted,
        maintenanceLogs,
        fetchMaintenanceLogs
    };


});

