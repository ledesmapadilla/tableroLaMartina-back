// Primero: el antes y el después del registro de cambios tiene que estar
// puesto antes de que se arme cualquier modelo.
import "./src/services/historial.js";
import router from "./src/routes/index.routes.js";
import Server from "./src/server/config.js";

const server = new Server();
server.app.use(`/api`, router);
server.listen();

export default server.app;
