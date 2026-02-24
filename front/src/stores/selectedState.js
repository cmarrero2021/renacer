import { defineStore } from "pinia";
import { ref } from "vue";

export const useSelectedStateStore = defineStore("selectedState", () => {
  const selectedState = ref(null); // null para nacional, string para estado
  return { selectedState };
});
