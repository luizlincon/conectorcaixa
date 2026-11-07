CREATE TYPE public.app_role AS ENUM ('dono','funcionario');

CREATE TABLE public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  horario_limite time NOT NULL DEFAULT '20:00',
  data_inicio_assinatura date NOT NULL DEFAULT '2026-11-09',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  telefone text NOT NULL UNIQUE,
  unidade_id uuid REFERENCES public.unidades(id),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO authenticated;
GRANT ALL ON public.usuarios TO service_role;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.minha_unidade()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT unidade_id FROM public.usuarios WHERE id = auth.uid() AND ativo
$$;

CREATE OR REPLACE FUNCTION public.hoje_sp()
RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

CREATE TABLE public.feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  descricao text NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriados TO authenticated;
GRANT ALL ON public.feriados TO service_role;
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  data date NOT NULL,
  status text NOT NULL DEFAULT 'enviado',
  enviado_por uuid,
  enviado_por_nome text,
  enviado_em timestamptz,
  valor_maquina numeric(12,2) NOT NULL,
  valor_assinatura numeric(12,2) NOT NULL,
  valor_dinheiro numeric(12,2) NOT NULL,
  leitura_hub jsonb,
  leitura_pag jsonb,
  leitura_status text NOT NULL DEFAULT 'pendente',
  leitura_erro text,
  corrigido_por_nome text,
  corrigido_em timestamptz,
  versoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fechamentos TO authenticated;
GRANT ALL ON public.fechamentos TO service_role;
ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES public.fechamentos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  path text NOT NULL,
  capturada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fotos TO authenticated;
GRANT ALL ON public.fotos TO service_role;
ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES public.fechamentos(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  data date NOT NULL,
  regra int NOT NULL,
  nivel text NOT NULL,
  mensagem text NOT NULL,
  resolvido boolean NOT NULL DEFAULT false,
  resolvido_por_nome text,
  resolvido_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas TO authenticated;
GRANT ALL ON public.alertas TO service_role;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "ler unidades" ON public.unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "dono edita unidades" ON public.unidades FOR ALL TO authenticated USING (public.has_role(auth.uid(),'dono')) WITH CHECK (public.has_role(auth.uid(),'dono'));

CREATE POLICY "ler proprio usuario" ON public.usuarios FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'dono'));
CREATE POLICY "dono edita usuarios" ON public.usuarios FOR ALL TO authenticated USING (public.has_role(auth.uid(),'dono')) WITH CHECK (public.has_role(auth.uid(),'dono'));

CREATE POLICY "ler proprio papel" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'dono'));

CREATE POLICY "ler feriados" ON public.feriados FOR SELECT TO authenticated USING (true);
CREATE POLICY "dono edita feriados" ON public.feriados FOR ALL TO authenticated USING (public.has_role(auth.uid(),'dono')) WITH CHECK (public.has_role(auth.uid(),'dono'));

CREATE POLICY "dono tudo fechamentos" ON public.fechamentos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'dono')) WITH CHECK (public.has_role(auth.uid(),'dono'));
CREATE POLICY "func le fechamento do dia" ON public.fechamentos FOR SELECT TO authenticated USING (unidade_id = public.minha_unidade() AND data = public.hoje_sp());
CREATE POLICY "func insere fechamento do dia" ON public.fechamentos FOR INSERT TO authenticated WITH CHECK (unidade_id = public.minha_unidade() AND data = public.hoje_sp() AND enviado_por = auth.uid());

CREATE POLICY "dono tudo fotos" ON public.fotos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'dono')) WITH CHECK (public.has_role(auth.uid(),'dono'));
CREATE POLICY "func le fotos do dia" ON public.fotos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.fechamentos f WHERE f.id = fechamento_id AND f.unidade_id = public.minha_unidade() AND f.data = public.hoje_sp()));
CREATE POLICY "func insere fotos do dia" ON public.fotos FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.fechamentos f WHERE f.id = fechamento_id AND f.unidade_id = public.minha_unidade() AND f.data = public.hoje_sp()));

CREATE POLICY "dono tudo alertas" ON public.alertas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'dono')) WITH CHECK (public.has_role(auth.uid(),'dono'));

-- Storage
CREATE POLICY "func envia fotos da unidade" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-caixa' AND (storage.foldername(name))[1] = public.minha_unidade()::text);
CREATE POLICY "func le fotos da unidade" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-caixa' AND ((storage.foldername(name))[1] = public.minha_unidade()::text OR public.has_role(auth.uid(),'dono')));
CREATE POLICY "dono gerencia fotos" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'fotos-caixa' AND public.has_role(auth.uid(),'dono'))
  WITH CHECK (bucket_id = 'fotos-caixa' AND public.has_role(auth.uid(),'dono'));

INSERT INTO public.unidades (nome) VALUES ('SCS');