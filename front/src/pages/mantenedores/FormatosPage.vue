<template>
    <MantenedorGenerico tabla="formatos" titulo="FORMATOS" titulo-singular="Formato" :columnas="columnas"
        :campos-editables="camposEditables" permiso-base="formatos" />
</template>

<script setup>
import MantenedorGenerico from 'src/components/MantenedorGenerico.vue';

const columnas = [
    { name: 'actions', label: 'Acciones', align: 'left' },
    { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
    { name: 'formato', label: 'Formato', field: 'formato', sortable: true, align: 'left' }
];

const camposEditables = [
    { name: 'formato', label: 'Formato', required: true, uppercase: true }
];
</script>
