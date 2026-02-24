import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useFiltersStore = defineStore('filters', () => {
  // Estado de los filtros
  const selectedArea = ref(null);
  const selectedIndice = ref(null);
  const selectedIdioma = ref(null);
  const selectedEditorial = ref(null);
  const selectedPeriodicidad = ref(null);
  const selectedFormato = ref(null);
  const selectedEstado = ref(null);

  // Función para limpiar todos los filtros
  const clearAllFilters = () => {
    selectedArea.value = null;
    selectedIndice.value = null;
    selectedIdioma.value = null;
    selectedEditorial.value = null;
    selectedPeriodicidad.value = null;
    selectedFormato.value = null;
    selectedEstado.value = null;
  };

  // Función para obtener los filtros activos como objeto
  const getActiveFilters = () => {
    const filters = {};
    if (selectedArea.value) filters.area = selectedArea.value;
    if (selectedIndice.value) filters.indice = selectedIndice.value;
    if (selectedIdioma.value) filters.idioma = selectedIdioma.value;
    if (selectedEditorial.value) filters.editorial = selectedEditorial.value;
    if (selectedPeriodicidad.value) filters.periodicidad = selectedPeriodicidad.value;
    if (selectedFormato.value) filters.formato = selectedFormato.value;
    if (selectedEstado.value) filters.estado = selectedEstado.value;
    return filters;
  };

  // Función para construir query string
  const buildQueryString = () => {
    const filters = getActiveFilters();
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        params.append(key, filters[key]);
      }
    });
    return params.toString();
  };

  // Función para verificar si hay filtros activos
  const hasActiveFilters = () => {
    return !!(selectedArea.value || selectedIndice.value || selectedIdioma.value || 
              selectedEditorial.value || selectedPeriodicidad.value || 
              selectedFormato.value || selectedEstado.value);
  };

  return {
    // State
    selectedArea,
    selectedIndice,
    selectedIdioma,
    selectedEditorial,
    selectedPeriodicidad,
    selectedFormato,
    selectedEstado,
    // Actions
    clearAllFilters,
    getActiveFilters,
    buildQueryString,
    hasActiveFilters
  };
});
