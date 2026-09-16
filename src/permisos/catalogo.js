/**
 * Las pantallas del proyecto y quién entraba a cada una antes de que
 * existiera la tabla de Roles. Es lo que vale para un rol mientras no tenga
 * nada guardado en la colección `roles`.
 *
 * Es una copia de TableroFront/src/utils/permisosCatalogo.js (CATALOGO, campo
 * `hoy`): si se suma o se saca una pantalla allá, va también acá. Una clave
 * que falte acá no da permiso de edición en el back.
 */
const ROLES = ["superadmin", "solicitante", "analista", "comprador", "gerente"];
const TODOS = ROLES;
const SIN_SOLICITANTE = ROLES.filter((r) => r !== "solicitante");
const GERENCIA = ["gerente", "superadmin"];
const CONTABLE = ["superadmin", "gerente", "analista"];

export const PERMISOS_HOY = {
  // Compras
  "compras.pedidos": TODOS,
  "compras.pendientes": TODOS,
  "compras.analista": SIN_SOLICITANTE,
  "compras.comprador": SIN_SOLICITANTE,
  "compras.gerencia": GERENCIA,

  // Mantenimiento
  "camionetas.kilometros": TODOS,
  "camionetas.ultimoService": TODOS,
  "camionetas.checklist": TODOS,
  "camionetas.reportar": TODOS,
  "camionetas.tareas": TODOS,
  "camionetas.historial": TODOS,
  "camionetas.planilla": TODOS,
  "tractores.preventivo": TODOS,
  "tractores.repuestos": TODOS,
  "tractores.reportar": TODOS,
  "tractores.tareas": TODOS,
  "tractores.historial": TODOS,
  "tractores.planilla": TODOS,
  "colectivos.preventivo": TODOS,
  "colectivos.reparaciones": TODOS,
  "mantenimiento.visitas": TODOS,

  // Producción
  "produccion.variables": SIN_SOLICITANTE,
  "produccion.certificacion": SIN_SOLICITANTE,
  "produccion.informeMes": SIN_SOLICITANTE,
  "produccion.contable": CONTABLE,

  // Altas
  "altas.centrosCosto": SIN_SOLICITANTE,
  "altas.proveedores": SIN_SOLICITANTE,
  "altas.personal": SIN_SOLICITANTE,
  "altas.tareas": SIN_SOLICITANTE,
  "altas.camionetas": TODOS,
  "altas.tractores": TODOS,
  "altas.colectivos": TODOS,
};
