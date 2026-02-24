<template>
    <MantenedorGenerico tabla="editoriales" titulo="EDITORIALES" titulo-singular="Editorial" :columnas="columnas"
        :campos-editables="camposEditables" permiso-base="editoriales" />
</template>

<script setup>
import MantenedorGenerico from 'src/components/MantenedorGenerico.vue';

const columnas = [
    { name: 'actions', label: 'Acciones', align: 'left' },
    { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left' },
    { name: 'editorial', label: 'Editorial', field: 'editorial', sortable: true, align: 'left' },
    { name: 'url', label: 'URL', field: 'url', sortable: true, align: 'left' }
];

const camposEditables = [
    { name: 'editorial', label: 'Editorial', required: true, uppercase: true },
    { name: 'url', label: 'URL', required: false, uppercase: false }
];
</script>
