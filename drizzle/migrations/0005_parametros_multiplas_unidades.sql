ALTER TABLE public.unidades
  ADD COLUMN codigo text,
  ADD COLUMN valor_plano numeric(10,2) NOT NULL DEFAULT 35.00,
  ADD COLUMN dias_funcionamento smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN dias_ilimitado smallint[] NOT NULL DEFAULT '{1,2,3}',
  ADD COLUMN multiplo_avulso numeric(10,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN ativa boolean NOT NULL DEFAULT true;

UPDATE public.unidades SET codigo = 'scs' WHERE id = 'ab7891af-d856-43db-8148-4e4ede87abab';

ALTER TABLE public.unidades
  ADD CONSTRAINT unidades_codigo_unique UNIQUE (codigo),
  ADD CONSTRAINT unidades_codigo_formato CHECK (codigo ~ '^[a-z0-9-]{2,30}$'),
  ADD CONSTRAINT unidades_valor_plano_positivo CHECK (valor_plano > 0),
  ADD CONSTRAINT unidades_multiplo_avulso_positivo CHECK (multiplo_avulso > 0),
  ADD CONSTRAINT unidades_dias_funcionamento_validos CHECK (dias_funcionamento <@ ARRAY[0,1,2,3,4,5,6]::smallint[] AND array_position(dias_funcionamento, NULL) IS NULL),
  ADD CONSTRAINT unidades_dias_ilimitado_validos CHECK (dias_ilimitado <@ ARRAY[0,1,2,3,4,5,6]::smallint[] AND array_position(dias_ilimitado, NULL) IS NULL);

CREATE FUNCTION public.unidade_por_codigo(_codigo text)
RETURNS TABLE (id uuid, nome text, codigo text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.nome, u.codigo
  FROM public.unidades AS u
  WHERE u.codigo = _codigo AND u.ativa = true;
$$;
REVOKE ALL ON FUNCTION public.unidade_por_codigo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unidade_por_codigo(text) TO anon, authenticated;