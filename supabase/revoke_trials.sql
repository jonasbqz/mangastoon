-- =====================================================================
-- SQL Script: Revocar Pruebas y Promociones Premium Gratuitas
-- =====================================================================
-- Este script desactiva el estado Premium de todos los usuarios
-- que lo obtuvieron mediante la Server Action piloto (tipo 'gifted')
-- o que no tienen un registro de pago asociado.
--
-- Ejecuta este comando en el editor de SQL de Supabase (SQL Editor).
-- =====================================================================

-- 1. Revocar Premium a todos los usuarios con tipo de suscripción 'gifted'
UPDATE public.profiles
SET 
  is_premium = false,
  premium_type = NULL,
  updated_at = now()
WHERE 
  premium_type = 'gifted';

-- 2. (Opcional) Si quieres limpiar metadatos de auth de Supabase correspondientes
-- a premium_since o scheduled_delete_at para estos usuarios, puedes ejecutar
-- procesos o consultas adicionales, aunque el campo is_premium en profiles
-- es la fuente única de verdad para el lector y la UI.
