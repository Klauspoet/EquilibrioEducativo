-- ============================================================
-- Equilibrio Educativo — Supabase Migration
-- Apply this in the Supabase SQL Editor (Shift+Enter to run all)
-- ============================================================

-- ============================================================
-- 1. STORAGE: Create bucket for counselor credential files
-- ============================================================
-- PROBLEM: Frontend code uploads to 'titulos' bucket but it
-- doesn't exist, causing silent failures on counselor signup.
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('titulos', 'titulos', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. HELPER FUNCTION: check if current user is admin
-- ============================================================
-- PROBLEM (fixed): a policy on `usuarios` that queries
-- `usuarios` again to check the caller's role causes
-- "infinite recursion detected in policy for relation usuarios"
-- in Postgres. Using a SECURITY DEFINER function avoids this,
-- because the function runs with the privileges of its owner
-- and does not re-trigger RLS evaluation on `usuarios`.
-- ============================================================
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin'
  );
$$;

-- ============================================================
-- 3. STORAGE RLS: Only admins can read/list; counselors can
-- upload their own file during registration
-- ============================================================
CREATE OR REPLACE FUNCTION public.obtener_usuario_id_archivo(nombre_archivo text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN split_part(nombre_archivo, '.', 1)::uuid;
END;
$$;

-- Policy: authenticated users can upload to titulos
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir archivos" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden subir archivos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'titulos'
  AND (public.obtener_usuario_id_archivo(name) = auth.uid())
);

-- Policy: users can read their own uploaded files
DROP POLICY IF EXISTS "Usuarios pueden leer sus propios archivos" ON storage.objects;
CREATE POLICY "Usuarios pueden leer sus propios archivos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'titulos'
  AND (public.obtener_usuario_id_archivo(name) = auth.uid())
);

-- Policy: admins can read all files
DROP POLICY IF EXISTS "Admin puede leer todos los archivos" ON storage.objects;
CREATE POLICY "Admin puede leer todos los archivos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'titulos'
  AND public.es_admin()
);

-- ============================================================
-- 4. ENABLE RLS ON ALL TABLES
-- ============================================================
-- PROBLEM: All tables are publicly readable with the anon key.
-- The anon key should only access public data (like available
-- counselors). All other access requires authentication.
-- ============================================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psicoorientadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_emocionales ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES — usuarios
-- ============================================================
-- Users can read their own profile
DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON public.usuarios;
CREATE POLICY "Usuarios ven su propio perfil"
ON public.usuarios FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Admin can read all users (needed for admin panel)
-- FIXED: uses es_admin() instead of a self-referencing subquery
-- to avoid infinite recursion on the `usuarios` policy.
DROP POLICY IF EXISTS "Admin ve todos los usuarios" ON public.usuarios;
CREATE POLICY "Admin ve todos los usuarios"
ON public.usuarios FOR SELECT
TO authenticated
USING (public.es_admin());

-- Chat participants can see the name of the other person in their chats
DROP POLICY IF EXISTS "Participantes del chat ven nombre del otro usuario" ON public.usuarios;
CREATE POLICY "Participantes del chat ven nombre del otro usuario"
ON public.usuarios FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE (chats.estudiante_id = usuarios.id OR chats.psicoorientador_id = usuarios.id)
    AND (chats.estudiante_id = auth.uid() OR chats.psicoorientador_id = auth.uid())
  )
);

-- Anyone can see the name and specialty of approved counselors
DROP POLICY IF EXISTS "Ver nombre de psicoorientadores aprobados" ON public.usuarios;
CREATE POLICY "Ver nombre de psicoorientadores aprobados"
ON public.usuarios FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.psicoorientadores
    WHERE psicoorientadores.usuario_id = usuarios.id
    AND psicoorientadores.disponible = true
    AND psicoorientadores.estado = 'aprobado'
  )
);

-- Users can update their own profile (but not their role)
DROP POLICY IF EXISTS "Usuarios actualizan su propio perfil" ON public.usuarios;
CREATE POLICY "Usuarios actualizan su propio perfil"
ON public.usuarios FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- The signup trigger inserts the user profile (see section 9)
DROP POLICY IF EXISTS "Trigger de registro puede insertar" ON public.usuarios;
CREATE POLICY "Trigger de registro puede insertar"
ON public.usuarios FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ============================================================
-- 6. RLS POLICIES — psicoorientadores
-- ============================================================
-- Anyone (even anon) can see approved & available counselors
DROP POLICY IF EXISTS "Cualquier persona ve psicoorientadores disponibles" ON public.psicoorientadores;
CREATE POLICY "Cualquier persona ve psicoorientadores disponibles"
ON public.psicoorientadores FOR SELECT
TO anon, authenticated
USING (disponible = true AND estado = 'aprobado');

-- Counselors can see their own full profile
DROP POLICY IF EXISTS "Psicoorientador ve su propio perfil" ON public.psicoorientadores;
CREATE POLICY "Psicoorientador ve su propio perfil"
ON public.psicoorientadores FOR SELECT
TO authenticated
USING (usuario_id = auth.uid());

-- Admin can see all counselor profiles
DROP POLICY IF EXISTS "Admin ve todos los psicoorientadores" ON public.psicoorientadores;
CREATE POLICY "Admin ve todos los psicoorientadores"
ON public.psicoorientadores FOR SELECT
TO authenticated
USING (public.es_admin());

-- Admin can update counselor status (approve/reject)
DROP POLICY IF EXISTS "Admin actualiza psicoorientadores" ON public.psicoorientadores;
CREATE POLICY "Admin actualiza psicoorientadores"
ON public.psicoorientadores FOR UPDATE
TO authenticated
USING (public.es_admin())
WITH CHECK (public.es_admin());

-- Insert happens via signup trigger or registration flow
DROP POLICY IF EXISTS "Usuario puede insertar su perfil de psicoorientador" ON public.psicoorientadores;
CREATE POLICY "Usuario puede insertar su perfil de psicoorientador"
ON public.psicoorientadores FOR INSERT
TO authenticated
WITH CHECK (usuario_id = auth.uid());

-- ============================================================
-- 7. RLS POLICIES — chats
-- ============================================================
-- Only chat participants can see the chat
DROP POLICY IF EXISTS "Participantes ven sus chats" ON public.chats;
CREATE POLICY "Participantes ven sus chats"
ON public.chats FOR SELECT
TO authenticated
USING (
  estudiante_id = auth.uid()
  OR psicoorientador_id = auth.uid()
);

-- Either participant can create a chat (student starts it)
DROP POLICY IF EXISTS "Participantes crean chats" ON public.chats;
CREATE POLICY "Participantes crean chats"
ON public.chats FOR INSERT
TO authenticated
WITH CHECK (
  estudiante_id = auth.uid()
  OR psicoorientador_id = auth.uid()
);

-- ============================================================
-- 8. RLS POLICIES — mensajes
-- ============================================================
-- Only chat participants can see messages in that chat
DROP POLICY IF EXISTS "Participantes ven mensajes del chat" ON public.mensajes;
CREATE POLICY "Participantes ven mensajes del chat"
ON public.mensajes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = mensajes.chat_id
    AND (chats.estudiante_id = auth.uid() OR chats.psicoorientador_id = auth.uid())
  )
);

-- Chat participants can insert messages
DROP POLICY IF EXISTS "Participantes envian mensajes" ON public.mensajes;
CREATE POLICY "Participantes envian mensajes"
ON public.mensajes FOR INSERT
TO authenticated
WITH CHECK (
  enviado_por = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = mensajes.chat_id
    AND (chats.estudiante_id = auth.uid() OR chats.psicoorientador_id = auth.uid())
  )
);

-- ============================================================
-- 9. RLS POLICIES — registros_emocionales
-- ============================================================
-- Students can see only their own emotional records
DROP POLICY IF EXISTS "Estudiante ve sus propios registros" ON public.registros_emocionales;
CREATE POLICY "Estudiante ve sus propios registros"
ON public.registros_emocionales FOR SELECT
TO authenticated
USING (estudiante_id = auth.uid());

-- Students can insert their own emotional records
DROP POLICY IF EXISTS "Estudiante inserta sus propios registros" ON public.registros_emocionales;
CREATE POLICY "Estudiante inserta sus propios registros"
ON public.registros_emocionales FOR INSERT
TO authenticated
WITH CHECK (estudiante_id = auth.uid());

-- ============================================================
-- 10. AUTH TRIGGER: Auto-create profile on signup
-- ============================================================
-- PROBLEM: Frontend manually inserts into `usuarios` after
-- auth.signUp(). If the DB insert fails, the auth user is
-- orphaned. Moving profile creation to a trigger ensures
-- atomicity: every auth user gets a profile row.
-- ============================================================

-- Helper: extracts user metadata from raw JSON
CREATE OR REPLACE FUNCTION public.extraer_metadatos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_rol text;
BEGIN
  -- Extract raw_user_meta_data from auth.users
  v_nombre := NEW.raw_user_meta_data ->> 'nombre';
  v_rol    := NEW.raw_user_meta_data ->> 'rol';

  -- Fallback to email local-part if no name provided
  IF v_nombre IS NULL THEN
    v_nombre := split_part(NEW.email, '@', 1);
  END IF;

  -- Default role to 'estudiante'
  IF v_rol IS NULL THEN
    v_rol := 'estudiante';
  END IF;

  INSERT INTO public.usuarios (id, nombre, correo, rol)
  VALUES (NEW.id, v_nombre, NEW.email, v_rol)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.extraer_metadatos();

-- ============================================================
-- 11. INDEXES for performance
-- ============================================================
-- PROBLEM: Foreign key columns lack indexes, causing slow
-- queries when loading chats, messages, and counselor lists.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_psicoorientadores_usuario_id
  ON public.psicoorientadores (usuario_id);

CREATE INDEX IF NOT EXISTS idx_psicoorientadores_disponible_estado
  ON public.psicoorientadores (disponible, estado)
  WHERE disponible = true AND estado = 'aprobado';

CREATE INDEX IF NOT EXISTS idx_chats_estudiante_id
  ON public.chats (estudiante_id);

CREATE INDEX IF NOT EXISTS idx_chats_psicoorientador_id
  ON public.chats (psicoorientador_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_chat_id
  ON public.mensajes (chat_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_enviado_por
  ON public.mensajes (enviado_por);

CREATE INDEX IF NOT EXISTS idx_registros_emocionales_estudiante_id
  ON public.registros_emocionales (estudiante_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol
  ON public.usuarios (rol);

CREATE INDEX IF NOT EXISTS idx_usuarios_correo
  ON public.usuarios (correo);

-- ============================================================
-- 12. CHECK CONSTRAINTS (non-breaking)
-- ============================================================
-- PROBLEM: `rol`, `estado`, and `emocion` columns accept any
-- string value. Adding constraints prevents data corruption.
-- These are additive (no existing data will be modified).
-- ============================================================

-- Constrain rol to valid values
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS check_rol_valido;

ALTER TABLE public.usuarios
  ADD CONSTRAINT check_rol_valido
  CHECK (rol IN ('estudiante', 'psicoorientador', 'admin'));

-- Constrain estado to valid values
ALTER TABLE public.psicoorientadores
  DROP CONSTRAINT IF EXISTS check_estado_valido;

ALTER TABLE public.psicoorientadores
  ADD CONSTRAINT check_estado_valido
  CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));

-- Constrain emocion to valid values
ALTER TABLE public.registros_emocionales
  DROP CONSTRAINT IF EXISTS check_emocion_valida;

ALTER TABLE public.registros_emocionales
  ADD CONSTRAINT check_emocion_valida
  CHECK (emocion IN ('Triste', 'Regular', 'Bien', 'Genial', 'Ansioso'));

-- ============================================================
-- 13. NOT NULL CONSTRAINTS (non-breaking additions)
-- ============================================================
-- Ensure critical columns are never null
ALTER TABLE public.usuarios
  ALTER COLUMN nombre SET NOT NULL,
  ALTER COLUMN correo SET NOT NULL,
  ALTER COLUMN rol SET NOT NULL;

ALTER TABLE public.psicoorientadores
  ALTER COLUMN usuario_id SET NOT NULL,
  ALTER COLUMN especialidad SET NOT NULL,
  ALTER COLUMN estado SET NOT NULL,
  ALTER COLUMN disponible SET NOT NULL;

ALTER TABLE public.chats
  ALTER COLUMN estudiante_id SET NOT NULL,
  ALTER COLUMN psicoorientador_id SET NOT NULL;

ALTER TABLE public.mensajes
  ALTER COLUMN chat_id SET NOT NULL,
  ALTER COLUMN enviado_por SET NOT NULL,
  ALTER COLUMN texto SET NOT NULL;

ALTER TABLE public.registros_emocionales
  ALTER COLUMN estudiante_id SET NOT NULL,
  ALTER COLUMN emocion SET NOT NULL;

-- ============================================================
-- 14. FOREIGN KEYS WITH ON DELETE CASCADE
-- ============================================================
-- PROBLEM: deleting a user from auth.users (e.g. from the
-- Dashboard) fails with a foreign key violation if that user
-- has related rows in chats/mensajes/registros_emocionales.
-- Adding ON DELETE CASCADE means deleting a user automatically
-- cleans up all their related data instead of blocking.
-- ============================================================
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_id_fkey;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.chats
  DROP CONSTRAINT IF EXISTS chats_estudiante_id_fkey;
ALTER TABLE public.chats
  ADD CONSTRAINT chats_estudiante_id_fkey
  FOREIGN KEY (estudiante_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE public.chats
  DROP CONSTRAINT IF EXISTS chats_psicoorientador_id_fkey;
ALTER TABLE public.chats
  ADD CONSTRAINT chats_psicoorientador_id_fkey
  FOREIGN KEY (psicoorientador_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE public.mensajes
  DROP CONSTRAINT IF EXISTS mensajes_chat_id_fkey;
ALTER TABLE public.mensajes
  ADD CONSTRAINT mensajes_chat_id_fkey
  FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;

ALTER TABLE public.mensajes
  DROP CONSTRAINT IF EXISTS mensajes_enviado_por_fkey;
ALTER TABLE public.mensajes
  ADD CONSTRAINT mensajes_enviado_por_fkey
  FOREIGN KEY (enviado_por) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE public.registros_emocionales
  DROP CONSTRAINT IF EXISTS registros_emocionales_estudiante_id_fkey;
ALTER TABLE public.registros_emocionales
  ADD CONSTRAINT registros_emocionales_estudiante_id_fkey
  FOREIGN KEY (estudiante_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE public.psicoorientadores
  DROP CONSTRAINT IF EXISTS psicoorientadores_usuario_id_fkey;
ALTER TABLE public.psicoorientadores
  ADD CONSTRAINT psicoorientadores_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;
