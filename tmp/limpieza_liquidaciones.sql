-- Borrar Liquidaciones o cortes de caja antiguos (Antes de hoy)
DELETE FROM shift_settlements
WHERE created_at < '2026-03-28T05:00:00Z';
