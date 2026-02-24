<template>
    <MantenedorGenerico tabla="periodicidad" titulo="PERIODICIDADES" titulo-singular="Periodicidad" :columnas="columnas"
        :campos-editables="camposEditables" permiso-base="periodicidad" />
</template>

<script setup>
import MantenedorGenerico from 'src/components/MantenedorGenerico.vue';

const columnas = [
    { name: 'actions', label: 'Acciones', align: 'left' },
    { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
    { name: 'periodicidad', label: 'Periodicidad', field: 'periodicidad', sortable: true, align: 'left' }
];

const camposEditables = [
    { name: 'periodicidad', label: 'Periodicidad', required: true, uppercase: true }
];
</script>
