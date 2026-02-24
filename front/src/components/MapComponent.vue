<template>
  <div class="map-component">
    <div class="map-wrapper">
      <!-- Título del mapa con indicador de zoom -->
      <div class="map-header">

        <h6 class="map-title">Distribución nacional de registros</h6>
        <!-- <span class="zoom-indicator">Zoom: {{ currentZoom }}</span> -->
      </div>

      <div class="row relative-position map-row">
        <!-- Escala de colores (solo mostrar si hay datos) -->
        <div class="color-scale" v-if="uniqueValues.length > 0">
          <div class="scale-gradient" :style="{ background: gradientStyle }"></div>
          <div class="scale-labels" v-if="uniqueValues.length > 1">
            <div class="scale-value">{{ maxValue }}</div>
            <div class="scale-value scale-middle">{{ middleValue }}</div>
            <div class="scale-value">{{ minValue }}</div>
          </div>
          <div class="scale-labels scale-single" v-else>
            <div class="scale-value">{{ maxValue }}</div>
          </div>
        </div>

        <!-- Mapa -->
        <div ref="mapContainer" class="col-xs-12 col-md-6 map-container"></div>

        <!-- Contenedor de cards (fuera del flujo normal) -->
        <div ref="cardsContainer" class="cards-container" :class="{ visible: showTable }">
          <q-card class="q-ma-md" style="margin-right:160px;">
            <!-- Cards con la data del estado -->
            <div class="q-pa-md cards-grid">
              <q-card v-for="(value, key) in selectedStateData" :key="key" class="small-card q-mb-sm">
                <q-card-section class="small-section">
                  <div class="text-h6 small-title">{{ formatKey(key, value) }}</div>
                  <div class="text-subtitle1 small-text">{{ value }}</div>
                </q-card-section>
              </q-card>
            </div>
          </q-card>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { Notify } from "quasar";
import axios from "axios";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import venezuelaGeoJsonData from "../geojson/Venezuela.json";
import socket from "src/services/websocket";
import { useSelectedStateStore } from "src/stores/selectedState";
import { useFiltersStore } from "src/stores/filters";

const mapContainer = ref(null);
const cardsContainer = ref(null);
const VITE_GR_ESTADOS_URL = import.meta.env.VITE_GR_ESTADOS_URL;
const VITE_GR_ESTADOS_FILTRADO_URL = import.meta.env.VITE_GR_ESTADOS_FILTRADO_URL;
const VITE_DATA_ESTADOS_BASE_URL = import.meta.env.VITE_DATA_ESTADOS_BASE_URL;
const VITE_DATA_NACIONAL_BASE_URL = import.meta.env.VITE_DATA_NACIONAL_BASE_URL;
const showTable = ref(false);
const selectedStateData = ref({});
const estadoData = ref([]);
const paisData = ref([]);
let map = null;
let geoJsonLayer = null;
const selectedStateStore = useSelectedStateStore();
const filtersStore = useFiltersStore();

// Variables para la escala de colores
const minValue = ref(0);
const maxValue = ref(0);
const middleValue = ref(0);
const uniqueValues = ref([]); // Valores únicos reales de los datos
const gradientStyle = ref('');
const currentZoom = ref(6); // Zoom inicial para desktop

// Función para mostrar la data nacional en la tabla y en los gráficos
const mostrarDataNacional = async () => {
  const paisInfo = await fetchPaisInfo();
  selectedStateData.value = paisInfo;
  showTable.value = true;
  selectedStateStore.selectedState = null;
  filtersStore.selectedEstado = null; // Sincronizar con el store de filtros
  console.log('[MapComponent] Estado limpiado - mostrando data nacional');
};
// const selectedStateStore = useSelectedStateStore();

const generateColorScale = () => {
  const colorScale = [];
  // Color máximo #273984 = rgb(39, 57, 132)
  // Color mínimo = blanco rgb(255, 255, 255)
  const maxColor = { r: 39, g: 57, b: 132 };
  const minColor = { r: 255, g: 255, b: 255 };

  for (let i = 0; i < 26; i++) {
    // Interpolar entre blanco (i=0) y azul oscuro (i=25)
    const ratio = i / 25;
    const r = Math.round(minColor.r + (maxColor.r - minColor.r) * ratio);
    const g = Math.round(minColor.g + (maxColor.g - minColor.g) * ratio);
    const b = Math.round(minColor.b + (maxColor.b - minColor.b) * ratio);
    colorScale.push(`rgb(${r}, ${g}, ${b})`);
  }
  return colorScale;
};
const colorScale = generateColorScale();
// Función para cargar los datos del mapa
const fetchEstadoData = async () => {
  try {
    const timestamp = new Date().getTime();

    // Verificar si hay filtros activos (excluyendo el filtro de estado)
    const activeFilters = filtersStore.getActiveFilters();
    const hasNonStateFilters = Object.keys(activeFilters).some(key => key !== 'estado');

    let url;
    if (hasNonStateFilters) {
      // Usar endpoint filtrado (sin incluir el filtro de estado en la query)
      const filtersWithoutState = { ...activeFilters };
      delete filtersWithoutState.estado;

      const params = new URLSearchParams();
      Object.keys(filtersWithoutState).forEach(key => {
        if (filtersWithoutState[key]) {
          params.append(key, filtersWithoutState[key]);
        }
      });
      params.append('_t', timestamp);

      url = `${VITE_GR_ESTADOS_FILTRADO_URL}?${params.toString()}`;
      console.log('[MapComponent] Consultando mapa con filtros:', filtersWithoutState, 'URL:', url);
    } else {
      // Sin filtros, usar endpoint normal
      const separator = VITE_GR_ESTADOS_URL.includes('?') ? '&' : '?';
      url = `${VITE_GR_ESTADOS_URL}${separator}_t=${timestamp}`;
      console.log('[MapComponent] Consultando mapa sin filtros. URL:', url);
    }

    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    Notify.create({
      message: "Error al obtener datos del estado.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return [];
  }
};
// Función para inicializar el mapa
const initializeMap = () => {
  // Destruir el mapa existente si hay uno
  if (map) {
    map.remove();
    map = null;
  }

  // Determinar el zoom inicial según el tamaño de pantalla
  const isDesktop = window.innerWidth >= 1024;
  const initialZoom = isDesktop ? 6 : 5;
  currentZoom.value = initialZoom;

  // Crear un nuevo mapa
  map = L.map(mapContainer.value).setView([8.0, -66.0], initialZoom);

  // Actualizar el zoom cuando cambie
  map.on('zoomend', () => {
    currentZoom.value = map.getZoom();
  });

  // Agregar control de reinicio
  const resetControl = L.control({ position: "topright" });
  resetControl.onAdd = () => {
    const container = L.DomUtil.create("div", "reset-icon-container");
    const btn = L.DomUtil.create("button", "reset-icon-btn", container);
    btn.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
    btn.style =
      "background-color: rgb(0, 0, 255) !important; color: rgb(255, 255, 255) !important; padding: 5px !important; cursor: pointer !important";
    btn.title = "Recentrar Mapa";
    L.DomEvent.on(btn, "click", () => {
      const isDesktop = window.innerWidth >= 1024;
      const resetZoom = isDesktop ? 6 : 5;
      map.setView([8.0, -66.0], resetZoom);
    });
    return container;
  };
  map.addControl(resetControl);
  // Ocultar el control de atribución
  const attributionControl = map
    .getContainer()
    .querySelector(".leaflet-control-attribution");
  if (attributionControl) {
    attributionControl.style.display = "none";
  }
  // Ocultar el control de zoom
  const zommControl = map.getContainer().querySelector(".leaflet-control");
  if (zommControl) {
    zommControl.style.display = "none";
  }
};
// Función para actualizar el mapa con nuevos datos
const updateMap = async () => {
  estadoData.value = await fetchEstadoData();
  const estadoMap = estadoData.value.reduce((acc, item) => {
    acc[item.estado.toLowerCase().replace(/ /g, "")] = item.cant_estado;
    return acc;
  }, {});

  // Calcular valores mínimo y máximo
  const valores = estadoData.value.map((item) => item.cant_estado || 0);

  // Obtener valores únicos y ordenarlos
  uniqueValues.value = [...new Set(valores)].sort((a, b) => a - b);

  // Verificar si hay datos válidos
  if (valores.length === 0 || valores.every(v => v === 0)) {
    // No hay datos o todos son 0
    minValue.value = 0;
    maxValue.value = 0;
    middleValue.value = 0;
    uniqueValues.value = []; // Vaciar para que no se muestre la escala
    gradientStyle.value = `linear-gradient(to bottom, rgb(255, 255, 255), rgb(255, 255, 255))`;
  } else {
    const realMax = Math.max(...valores);

    // El mínimo siempre es 0 (hay estados sin datos que tienen valor 0)
    // El máximo es el valor real más alto de los datos
    minValue.value = 0;
    maxValue.value = realMax;
    middleValue.value = Math.floor(realMax / 2);

    // Generar gradiente dinámico con color máximo #273984
    gradientStyle.value = `linear-gradient(to bottom, rgb(39, 57, 132), rgb(147, 156, 194), rgb(255, 255, 255))`;
  }

  // Eliminar la capa GeoJSON existente si hay una
  if (geoJsonLayer) {
    map.removeLayer(geoJsonLayer);
  }

  // Agregar una nueva capa GeoJSON con los datos actualizados
  geoJsonLayer = L.geoJSON(venezuelaGeoJsonData, {
    style(feature) {
      const normalizedEstado = feature.properties.name
        .toLowerCase()
        .replace(/ /g, "");
      const cant_estado = estadoMap[normalizedEstado] || 0;
      const normalizedValue = Math.min(cant_estado / maxValue.value, 1);
      const colorIndex = Math.floor(normalizedValue * 25);
      return {
        fillColor: colorScale[colorIndex] || colorScale[0],
        weight: 1,
        color: "#000000",
        fillOpacity: 0.7,
      };
    },
    onEachFeature(feature, layer) {
      const normalizedEstado = feature.properties.name
        .toLowerCase()
        .replace(/ /g, "");
      const cant_estado = estadoMap[normalizedEstado] || 0;
      const normalizedValue = Math.min(cant_estado / maxValue.value, 1);
      const colorIndex = Math.floor(normalizedValue * 25);
      const fillColor = colorScale[colorIndex] || colorScale[0];

      // Agregar etiqueta con el número en el centro del estado
      const bounds = layer.getBounds();
      const center = bounds.getCenter();

      // Crear un marcador de texto personalizado con outline blanco
      const label = L.marker(center, {
        icon: L.divIcon({
          className: 'state-label',
          html: `<div style="
            background: transparent;
            font-weight: bold;
            font-size: 14px;
            color: #000000;
            text-shadow: 
              -3px -3px 0 #fff,
              3px -3px 0 #fff,
              -3px 3px 0 #fff,
              3px 3px 0 #fff,
              -3px 0 0 #fff,
              3px 0 0 #fff,
              0 -3px 0 #fff,
              0 3px 0 #fff;
          ">${cant_estado}</div>`,
          iconSize: [40, 20],
          iconAnchor: [20, 10]
        })
      }).addTo(map);

      layer.bindTooltip(`${feature.properties.name}: ${cant_estado}`);

      layer.on("mouseover", () => {
        layer.setStyle({
          fillColor: "rgb(0, 0, 180)",
          weight: 1,
          color: "#000000",
          fillOpacity: 1,
        });
        layer.bringToFront();
        const bounds = layer.getBounds();
        const centerLatLng = bounds.getCenter();
        const centerPixel = map.latLngToContainerPoint(centerLatLng);
        layer._path.style.transformOrigin = `${centerPixel.x}px ${centerPixel.y}px`;
        layer._path.style.transform = "scale(1)";
      });

      layer.on("mouseout", () => {
        layer.setStyle({
          fillColor,
          weight: 1,
          color: "#000000",
          fillOpacity: 0.7,
        });
        layer._path.style.transform = "";
        layer._path.style.transformOrigin = "";
      });

      layer.on("click", async () => {
        const estadoName = feature.properties.name.toLowerCase();
        const estadoInfo = await fetchEstadoInfo(estadoName);
        const paisInfo = await fetchPaisInfo();
        if (JSON.stringify(estadoInfo).length == 2) {
          selectedStateData.value = paisInfo;
          showTable.value = true;
          selectedStateStore.selectedState = null;
          filtersStore.selectedEstado = null; // Sincronizar con el store de filtros
          console.log('[MapComponent] Click en estado sin datos - mostrando data nacional');
        } else {
          selectedStateData.value = estadoInfo;
          showTable.value = true;
          selectedStateStore.selectedState = estadoName;
          filtersStore.selectedEstado = estadoName; // Sincronizar con el store de filtros
          console.log('[MapComponent] Estado seleccionado:', estadoName);
        }
      });
    },
  }).addTo(map);
};
// Función para obtener la información nacional
const fetchPaisInfo = async () => {
  try {
    const timestamp = new Date().getTime();
    const separator = VITE_DATA_NACIONAL_BASE_URL.includes('?') ? '&' : '?';
    const url = `${VITE_DATA_NACIONAL_BASE_URL}${separator}_t=${timestamp}`;
    const response = await axios.get(url);
    const paisInfo = response.data[0];
    return paisInfo || {};
  } catch (error) {
    Notify.create({
      message: "Falla al obtener información del estado.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return {};
  }
};
// Función para obtener la información de un estado específico
const fetchEstadoInfo = async (estadoName) => {
  try {
    const timestamp = new Date().getTime();
    const separator = VITE_DATA_ESTADOS_BASE_URL.includes('?') ? '&' : '?';
    const url = `${VITE_DATA_ESTADOS_BASE_URL}${separator}_t=${timestamp}`;
    const response = await axios.get(url);
    const estadoInfo = response.data.find(
      (item) => item.estado.toLowerCase() === estadoName
    );
    return estadoInfo || {};
  } catch (error) {
    Notify.create({
      message: "Falla al obtener información del estado.",
      color: "negative",
      position: "top",
      timeout: 3000,
    });
    return {};
  }
};
onMounted(async () => {
  // Inicializar el mapa
  initializeMap();
  // Cargar los datos iniciales del mapa
  await updateMap();
  const paisInfo = await fetchPaisInfo();
  selectedStateData.value = paisInfo;
  showTable.value = true;

  // Escuchar eventos de actualización desde WebSocket
  socket.onmessage = async (event) => {
    // Notify.create({
    //   message: "Cambio detectado en la base de datos. Actualizando mapa.",
    //   color: "positive",
    //   position: "top",
    //   timeout: 3000,
    // });
    await updateMap(); // Actualizar el mapa con los nuevos datos
    const updatedPaisInfo = await fetchPaisInfo();
    selectedStateData.value = updatedPaisInfo;
  };
});
onUnmounted(() => {
  // Limpiar el listener del WebSocket
  socket.onmessage = null;
});

// Watch para actualizar el mapa cuando cambien los filtros (excluyendo estado)
watch(
  [
    () => filtersStore.selectedArea,
    () => filtersStore.selectedIndice,
    () => filtersStore.selectedIdioma,
    () => filtersStore.selectedEditorial,
    () => filtersStore.selectedPeriodicidad,
    () => filtersStore.selectedFormato
  ],
  (newValues, oldValues) => {
    console.log('[MapComponent] Filtros (sin estado) cambiados');
    updateMap();
  },
  { immediate: false }
);

// Watch para sincronizar el filtro de estado del store con el mapa
watch(
  () => filtersStore.selectedEstado,
  async (newEstado, oldEstado) => {
    console.log('[MapComponent] Filtro de estado cambiado:', oldEstado, '->', newEstado);

    // Actualizar el selectedStateStore
    selectedStateStore.selectedState = newEstado;

    // Actualizar la ficha con la información del estado
    if (newEstado) {
      const estadoInfo = await fetchEstadoInfo(newEstado);
      if (JSON.stringify(estadoInfo).length > 2) {
        selectedStateData.value = estadoInfo;
        showTable.value = true;
      } else {
        // Si no hay datos para ese estado, mostrar data nacional
        const paisInfo = await fetchPaisInfo();
        selectedStateData.value = paisInfo;
        showTable.value = true;
      }
    } else {
      // Si se limpia el filtro, mostrar data nacional
      const paisInfo = await fetchPaisInfo();
      selectedStateData.value = paisInfo;
      showTable.value = true;
    }
  },
  { immediate: false }
);
// Función para formatear las claves de la data con singular/plural y acentos
const formatKey = (key, value) => {
  const numValue = parseInt(value, 10) || 0;
  const isSingular = numValue === 1;

  // Mapeo de claves a títulos con singular/plural y acentos correctos
  const keyMappings = {
    'estado': { singular: 'ESTADO', plural: 'ESTADO' },
    'cantidad_area_conocimiento': { singular: 'ÁREA DE CONOCIMIENTO', plural: 'ÁREAS DE CONOCIMIENTO' },
    'cantidad_indice': { singular: 'ÍNDICE', plural: 'ÍNDICES' },
    'cantidad_idioma': { singular: 'IDIOMA', plural: 'IDIOMAS' },
    'cantidad_revista': { singular: 'REVISTA', plural: 'REVISTAS' },
    'cantidad_editorial': { singular: 'EDITORIAL', plural: 'EDITORIALES' },
    'cantidad_periodicidad': { singular: 'PERIODICIDAD', plural: 'PERIODICIDADES' },
    'cantidad_formato': { singular: 'FORMATO', plural: 'FORMATOS' },
    // Variantes sin prefijo "cantidad_"
    'area_conocimiento': { singular: 'ÁREA DE CONOCIMIENTO', plural: 'ÁREAS DE CONOCIMIENTO' },
    'indice': { singular: 'ÍNDICE', plural: 'ÍNDICES' },
    'idioma': { singular: 'IDIOMA', plural: 'IDIOMAS' },
    'revista': { singular: 'REVISTA', plural: 'REVISTAS' },
    'editorial': { singular: 'EDITORIAL', plural: 'EDITORIALES' },
    'periodicidad': { singular: 'PERIODICIDAD', plural: 'PERIODICIDADES' },
    'formato': { singular: 'FORMATO', plural: 'FORMATOS' }
  };

  const normalizedKey = key.toLowerCase();

  if (keyMappings[normalizedKey]) {
    return isSingular ? keyMappings[normalizedKey].singular : keyMappings[normalizedKey].plural;
  }

  // Fallback: formatear la clave eliminando "cantidad_" y capitalizando
  const formattedKey = key
    .replace(/cantidad_/gi, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return formattedKey;
};
</script>
<style scoped>
.map-container {
  height: 400px;
  background-color: var(--oncti-white);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(39, 57, 132, 0.08);
  margin-bottom: 24px;
  width: 100%;
  padding: 5px;
}

@media (min-width: 768px) {
  .map-container {
    height: 500px;
    float: left;
    width: 45%;
    margin-right: 2%;
    padding: 8px;
  }
}

@media (min-width: 1024px) {
  .map-container {
    height: 550px;
    width: 48%;
    padding: 10px;
  }
}

/* Contenedor de cards (fuera del flujo normal) */
.cards-container {
  position: relative;
  width: 100%;
  max-height: 400px;
  overflow-y: auto;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.3s ease, visibility 0.3s ease;
  z-index: 10;
  margin-top: 16px;
}

.cards-container.visible {
  visibility: visible;
  opacity: 1;
}

@media (min-width: 768px) {
  .cards-container {
    position: relative;
    float: left;
    width: 53%;
    max-height: 500px;
    margin-top: 0;
  }
}

@media (min-width: 1024px) {
  .cards-container {
    max-height: 550px;
    width: 50%;
  }
}

/* Estilos para el botón de cerrar */
.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 20;
  background-color: var(--oncti-blue) !important;
  color: var(--oncti-white) !important;
}

.close-btn:hover {
  background-color: var(--oncti-blue-dark) !important;
}

/* Nuevos estilos para las cards */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.small-card {
  background: var(--oncti-white);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(39, 57, 132, 0.06);
  transition: all 0.3s ease;
}

.small-card:hover {
  box-shadow: 0 4px 12px rgba(39, 57, 132, 0.12);
  transform: translateY(-2px);
}

.small-section {
  padding: 8px !important;
}

.small-title {
  font-size: 0.75rem !important;
  margin-bottom: 4px !important;
  color: var(--oncti-text-dark);
  font-weight: 600;
  text-transform: uppercase;
}

.small-text {
  font-size: 1.1rem !important;
  line-height: 1.2 !important;
  color: var(--oncti-blue);
  font-weight: 700;
}

/* Ajustes responsive */
@media (max-width: 767px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .small-card {
    padding: 10px;
  }

  .small-title {
    font-size: 0.65rem !important;
  }

  .small-text {
    font-size: 0.95rem !important;
  }
}

@media (max-width: 480px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }

  .small-card {
    padding: 8px;
  }

  .small-title {
    font-size: 0.6rem !important;
  }

  .small-text {
    font-size: 0.85rem !important;
  }
}

/* Scrollbar personalizado */
.cards-container::-webkit-scrollbar {
  width: 8px;
}

.cards-container::-webkit-scrollbar-track {
  background: var(--oncti-gray-light);
  border-radius: 4px;
}

.cards-container::-webkit-scrollbar-thumb {
  background: var(--oncti-blue-light);
  border-radius: 4px;
}

.cards-container::-webkit-scrollbar-thumb:hover {
  background: var(--oncti-blue);
}

/* Estilos para el título del mapa */
.map-wrapper {
  position: relative;
  overflow: hidden;
  /* Contener los elementos flotantes */
}

/* Clearfix para el contenedor con floats */
.map-row {
  overflow: hidden;
  /* Alternativa moderna al clearfix */
}

.map-row::after {
  content: "";
  display: table;
  clear: both;
}

.map-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.map-title {
  color: var(--oncti-blue);
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
  padding: 0;
}

.zoom-indicator {
  background-color: var(--oncti-blue);
  color: var(--oncti-white);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
}

/* Estilos para la escala de colores */
.color-scale {
  position: absolute;
  left: 10px;
  top: 60px;
  z-index: 1000;
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.scale-gradient {
  width: 30px;
  height: 200px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background: linear-gradient(to bottom, rgb(0, 0, 180), rgb(180, 180, 255), rgb(255, 255, 255));
}

.scale-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2px 0;
}

.scale-labels.scale-single {
  justify-content: center;
}

.scale-value {
  font-size: 0.85rem;
  color: var(--oncti-text-dark);
  font-weight: 600;
  line-height: 1;
}

.scale-middle {
  margin: auto 0;
}

/* Estilos para las etiquetas de los estados */
:deep(.state-label) {
  background: transparent !important;
  border: none !important;
}

@media (max-width: 767px) {
  .map-title {
    font-size: 1rem;
    margin-bottom: 12px;
  }

  .color-scale {
    left: 5px;
    top: 50px;
    padding: 8px;
    min-width: 100px;
  }

  .scale-gradient {
    height: 120px;
  }

  .scale-title {
    font-size: 0.65rem;
  }

  .scale-labels {
    font-size: 0.6rem;
  }
}

/* Large screens (1440px+) */
@media (min-width: 1440px) {
  .map-container {
    height: 600px;
    width: 50%;
    padding: 12px;
  }

  .cards-container {
    max-height: 600px;
    width: 48%;
  }

  .map-title {
    font-size: 1.4rem;
  }

  .small-title {
    font-size: 0.85rem !important;
  }

  .small-text {
    font-size: 1.2rem !important;
  }

  .small-card {
    padding: 16px;
  }

  .cards-grid {
    gap: 16px;
  }

  .scale-gradient {
    width: 35px;
    height: 220px;
  }

  .scale-value {
    font-size: 0.9rem;
  }
}

/* Extra large screens (1920px+) */
@media (min-width: 1920px) {
  .map-container {
    height: 700px;
    width: 52%;
    padding: 16px;
  }

  .cards-container {
    max-height: 700px;
    width: 46%;
  }

  .map-title {
    font-size: 1.6rem;
  }

  .small-title {
    font-size: 0.95rem !important;
  }

  .small-text {
    font-size: 1.4rem !important;
  }

  .small-card {
    padding: 20px;
  }

  .cards-grid {
    gap: 20px;
  }

  .scale-gradient {
    width: 40px;
    height: 250px;
  }

  .scale-value {
    font-size: 1rem;
  }
}

/* Pantallas en orientación vertical (portrait) - reducir altura para evitar espacio en blanco excesivo */
@media (min-width: 768px) and (max-width: 1200px) and (orientation: portrait) {
  .map-container {
    height: 350px;
    float: left;
    width: 48%;
    margin-right: 2%;
  }

  .cards-container {
    max-height: 350px;
    width: 50%;
  }
}
</style>
