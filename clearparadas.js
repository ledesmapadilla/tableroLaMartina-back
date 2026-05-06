import mongoose from "mongoose";
import Parada from "./src/models/Parada.js";

await mongoose.connect(process.env.MONGODB);
const r = await Parada.deleteMany({});
console.log(`Paradas eliminadas: ${r.deletedCount}`);
await mongoose.disconnect();
