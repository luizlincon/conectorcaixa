-- Rodar no banco novo DEPOIS das migrations 0000 a 0006.
-- Bucket das fotos do caixa: PRIVADO (o painel usa links temporários).
-- As políticas de acesso ao bucket já estão nas migrations (storage.objects).
insert into storage.buckets (id, name, public)
values ('fotos-caixa', 'fotos-caixa', false)
on conflict (id) do update set public = false;
