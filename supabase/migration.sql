-- Migración para la creación de listas de cómics/mangas de la comunidad
CREATE TABLE IF NOT EXISTS public.manga_lists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  is_public boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.manga_list_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id uuid REFERENCES public.manga_lists ON DELETE CASCADE NOT NULL,
  manga_id text NOT NULL,
  manga_title text NOT NULL,
  cover_image text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(list_id, manga_id)
);

ALTER TABLE public.manga_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manga_list_items ENABLE ROW LEVEL SECURITY;

-- Verificar si las políticas ya existen antes de crearlas para evitar errores al re-correr la migración
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'manga_lists' AND policyname = 'Anyone can view public lists'
    ) THEN
        CREATE POLICY "Anyone can view public lists" ON public.manga_lists FOR SELECT USING (is_public = true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'manga_lists' AND policyname = 'Users can manage their own lists'
    ) THEN
        CREATE POLICY "Users can manage their own lists" ON public.manga_lists FOR ALL USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'manga_list_items' AND policyname = 'Anyone can view items of public lists'
    ) THEN
        CREATE POLICY "Anyone can view items of public lists" ON public.manga_list_items FOR SELECT USING (
          EXISTS (SELECT 1 FROM public.manga_lists WHERE id = list_id AND is_public = true)
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'manga_list_items' AND policyname = 'Users can manage items of their own lists'
    ) THEN
        CREATE POLICY "Users can manage items of their own lists" ON public.manga_list_items FOR ALL USING (
          EXISTS (SELECT 1 FROM public.manga_lists WHERE id = list_id AND user_id = auth.uid())
        );
    END IF;
END
$$;

-- Asegurar que los perfiles nuevos no tengan premium automáticamente por defecto
ALTER TABLE public.profiles ALTER COLUMN is_premium SET DEFAULT false;

-- Cambiar valor por defecto de lectura a horizontal tradicional para nuevos usuarios
ALTER TABLE public.profiles ALTER COLUMN reading_direction SET DEFAULT 'horizontal';

-- Crear tabla de favoritos si no existe
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  manga_id text NOT NULL,
  manga_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, manga_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can manage their own favorites'
    ) THEN
        CREATE POLICY "Users can manage their own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Crear tabla de historial de lectura si no existe
CREATE TABLE IF NOT EXISTS public.reading_history (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  manga_id text NOT NULL,
  manga_title text NOT NULL,
  chapter_id text NOT NULL,
  chapter_number text NOT NULL,
  cover_image text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, manga_id)
);
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'reading_history' AND policyname = 'Users can manage their own reading history'
    ) THEN
        CREATE POLICY "Users can manage their own reading history" ON public.reading_history FOR ALL USING (auth.uid() = user_id);
    END IF;
END
$$;
