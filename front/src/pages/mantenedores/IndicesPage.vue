<template>
    <MantenedorGenerico tabla="indices" titulo="ÍNDICES" titulo-singular="Índice" :columnas="columnas"
        :campos-editables="camposEditables" permiso-base="indices" />
</template>

<script setup>
import MantenedorGenerico from 'src/components/MantenedorGenerico.vue';

const columnas = [
    { name: 'actions', label: 'Acciones', align: 'left' },
    { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
    { name: 'indice', label: 'Índice', field: 'indice', sortable: true, align: 'left' }
];

const camposEditables = [
    { name: 'indice', label: 'Índice', required: true, uppercase: true }
];
</script>
