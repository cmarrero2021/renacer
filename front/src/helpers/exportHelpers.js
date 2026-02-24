// exportHelpers.js
// Funciones para exportar datos a Excel, CSV y JSON
import { utils, writeFile } from 'xlsx';

export function exportToExcel(data, filename) {
  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Revistas');
  writeFile(wb, filename + '.xlsx');
}

export function exportToCSV(data, filename) {
  const ws = utils.json_to_sheet(data);
  const csv = utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename + '.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
