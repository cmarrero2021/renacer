<template>
    <MantenedorGenerico tabla="estados" titulo="ESTADOS" titulo-singular="Estado" :columnas="columnas"
        :campos-editables="camposEditables" permiso-base="estados" />
</template>

<script setup>
import MantenedorGenerico from 'src/components/MantenedorGenerico.vue';

const columnas = [
    { name: 'actions', label: 'Acciones', align: 'left' },
    { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
    { name: 'estado', label: 'Estado', field: 'estado', sortable: true, align: 'left' },
    { name: 'iso_3166_2', label: 'Código ISO', field: 'iso_3166_2', sortable: true, align: 'left' }
];

const camposEditables = [
    { name: 'estado', label: 'Estado', required: true, uppercase: true },
    { name: 'iso_3166_2', label: 'Código ISO 3166-2', required: true, uppercase: true }
];
</script>
