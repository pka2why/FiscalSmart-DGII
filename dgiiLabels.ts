export const GASTO_LABELS: Record<string, string> = {
  '01': 'Gastos de personal',
  '02': 'Gastos de trabajos, suministros y servicios',
  '03': 'Arrendamientos',
  '04': 'Gastos de activos fijos',
  '05': 'Gastos de representación',
  '06': 'Gastos deducciones admitidas',
  '07': 'Gastos financieros',
  '08': 'Gastos extraordinarios',
  '09': 'Compras y gastos que forman parte del costo de venta',
  '10': 'Adquisiciones de activos',
  '11': 'Gastos de Seguros',
};

export const INGRESO_LABELS: Record<string, string> = {
  '01': 'Operaciones',
  '02': 'Financieros',
  '03': 'Extraordinarios',
  '04': 'Otros Ingresos',
};

export const FORMA_PAGO_LABELS: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheques/Transferencias/Depósito',
  '03': 'Tarjeta de crédito/débito',
  '04': 'Compra a crédito',
  '05': 'Permuta',
  '06': 'Nota de crédito',
  '07': 'Mixto',
};

export function labelOrCode(
  map: Record<string, string>,
  code: string,
  fallback = 'Sin clasificar'
): string {
  const key = String(code || '').padStart(2, '0');
  if (!code) return fallback;
  return map[key] || map[code] || `${fallback} (${code})`;
}
