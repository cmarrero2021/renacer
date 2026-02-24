<template>
    <MantenedorGenerico tabla="areas_conocimiento" titulo="ÁREAS DE CONOCIMIENTO" titulo-singular="Área de Conocimiento"
        :columnas="columnas" :campos-editables="camposEditables" permiso-base="areas_conocimiento" />
</template>

<script setup>
import MantenedorGenerico from 'src/components/MantenedorGenerico.vue';

const columnas = [
    { name: 'actions', label: 'Acciones', align: 'left' },
    { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
    { name: 'area_conocimiento', label: 'Área de Conocimiento', field: 'area_conocimiento', sortable: true, align: 'left' }
];

const camposEditables = [
    { name: 'area_conocimiento', label: 'Área de Conocimiento', required: true, uppercase: true }
];
</script>
