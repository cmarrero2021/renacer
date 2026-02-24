<template>
  <router-view />
</template>

<script setup>
import { Chart } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
Chart.register(ChartDataLabels);
defineOptions({
  name: "App",
});
</script>
<style>
/* Importar la fuente Gotham */
@font-face {
  font-family: 'Gotham Bold';
  src: url('fonts/gotham/Gotham-Bold.otf') format('opentype');
  font-weight: bold;
  font-style: normal;
}

@font-face {
  font-family: 'Gotham Medium';
  src: url('fonts/gotham/Gotham-Medium.otf') format('opentype');
  font-weight: 500;
  font-style: normal;
}

@font-face {
  font-family: 'Gotham Regular';
  src: url('fonts/gotham/Gotham-Regular.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}

* {
  font-family: 'Gotham Regular', sans-serif;
}

h3 {
  font-family: 'Gotham Bold', sans-serif;
}
</style>
