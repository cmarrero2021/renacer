// src/stores/centros.store.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { centrosService, fichasService, geoService } from 'src/services/centros.service';
import { Notify } from 'quasar';

export const useCentrosStore = defineStore('centros', () => {
    // ─── Estado ───────────────────────────────────────────────────────────────
    const centros = ref([]);
    const current = ref(null);   // Centro seleccionado
    const ficha = ref(null);   // Ficha activa del centro seleccionado
    const loading = ref(false);

    // Geo-catálogos
    const estados = ref([]);
    const municipios = ref([]);
    const parroquias = ref([]);

    // ─── Getters ──────────────────────────────────────────────────────────────
    const centroCount = computed(() => centros.value.length);

    // ─── Acciones: geo-catálogos ──────────────────────────────────────────────
    async function fetchEstados() {
        if (estados.value.length) return; // cache
        try {
            const { data } = await geoService.getEstados();
            estados.value = data;
        } catch {
            Notify.create({ type: 'negative', message: 'Error al cargar estados.' });
        }
    }

    async function fetchMunicipios(estadoId) {
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

    async function fetchParroquias(municipioId) {
        parroquias.value = [];
        if (!municipioId) return;
        try {
            const { data } = await geoService.getParroquias(municipioId);
            parroquias.value = data;
        } catch {
            Notify.create({ type: 'negative', message: 'Error al cargar parroquias.' });
        }
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
        } catch {
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

    return {
        // State
        centros, current, ficha, loading,
        estados, municipios, parroquias,
        // Getters
        centroCount,
        // Actions - geo
        fetchEstados, fetchMunicipios, fetchParroquias,
        // Actions - centros
        fetchCentros, fetchCentro, createCentro, updateCentro, deleteCentro,
        // Actions - fichas
        fetchFichaActual, saveFicha,
    };
});
