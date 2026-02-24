<template>
    <MantenedorGenerico tabla="idiomas" titulo="IDIOMAS" titulo-singular="Idioma" :columnas="columnas"
        :campos-editables="camposEditables" permiso-base="idiomas" />
</template>

<script setup>
import MantenedorGenerico from 'src/components/MantenedorGenerico.vue';

const columnas = [
    { name: 'actions', label: 'Acciones', align: 'left' },
    { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
    { name: 'idioma', label: 'Idioma', field: 'idioma', sortable: true, align: 'left' },
    { name: 'iso', label: 'Código ISO', field: 'iso', sortable: true, align: 'left' }
];

const camposEditables = [
    { name: 'idioma', label: 'Idioma', required: true, uppercase: true },
    { name: 'iso', label: 'Código ISO', required: true, uppercase: true }
];
</script>
