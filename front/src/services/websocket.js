const socket = new WebSocket(import.meta.env.VITE_WS_URL);

// Evento cuando la conexión se establece
socket.onopen = () => {
  console.log("Conexión WebSocket abierta");
};

// Evento cuando se recibe un mensaje del servidor
socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
  } catch (error) {
    // console.error("Error al procesar el mensaje recibido:", error);
  }
};

// Evento cuando ocurre un error en la conexión
socket.onerror = (error) => {
  console.error("Error en la conexión WebSocket:", error);
};

// Evento cuando la conexión se cierra
socket.onclose = () => {
  // console.log("Conexión WebSocket cerrada");
  // Puedes implementar aquí un sistema de reconexión automática si es necesario
};

// Función para enviar mensajes al servidor (si es necesario)
const sendMessage = (message) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    // console.log("No se pudo enviar el mensaje: conexión cerrada");
  }
};

// Exportar la instancia de socket como default y la función para enviar mensajes
export default socket;
export { sendMessage };
