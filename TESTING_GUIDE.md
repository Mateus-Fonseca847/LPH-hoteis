# Guia de testes - Homologacao LPH Hoteis

## Objetivo

Esta versao de homologacao permite validar o MVP da plataforma LPH Hoteis antes da liberacao final. O foco e testar navegacao publica, consulta de disponibilidade, favoritos e operacao basica do painel administrativo.

## Ambiente

URL de homologacao: `https://URL-DE-HOMOLOGACAO`

## Credenciais de teste

Super admin:

- E-mail: `SUPER_ADMIN_EMAIL`
- Senha: `SUPER_ADMIN_SENHA`

Admin de hotel:

- E-mail: `HOTEL_ADMIN_EMAIL`
- Senha: `HOTEL_ADMIN_SENHA`
- Escopo esperado: acesso a apenas um hotel vinculado.

Estas credenciais sao exclusivas para homologacao e nao devem ser usadas em producao.

## Fluxo publico para testar

1. Acessar a home.
2. Buscar hoteis por cidade.
3. Abrir um hotel pela secao "Conheca nossos hoteis".
4. Conferir dados do hotel: descricao, cidade, endereco, contato, galeria, comodidades, politicas e quartos.
5. Adicionar/remover hotel dos favoritos pela pagina do hotel e pelo icone de coracao no topo.
6. Clicar em "Consultar disponibilidade".
7. Informar datas, adultos e criancas.
8. Conferir quartos, valores estimados quando disponiveis e CTAs de contato.

Importante: reservas nao sao confirmadas automaticamente nesta versao. O fluxo envia apenas uma consulta para a equipe.

## Fluxo admin para testar

1. Acessar `/login`.
2. Entrar com usuario `super_admin`.
3. Validar que o dashboard abre e mostra a rede.
4. Acessar a listagem de hoteis.
5. Editar dados de um hotel e conferir reflexo no site publico.
6. Testar upload de capa e galeria.
7. Editar comodidades e politicas.
8. Criar, editar, ativar e desativar quartos.
9. Enviar imagem de quarto.
10. Criar, editar, ativar e desativar tarifas.
11. Salvar disponibilidade por periodo.
12. Entrar com usuario `hotel_admin` e validar que ele visualiza apenas o hotel vinculado.

## Funcionalidades incluidas

- Home publica com hoteis vindos do banco.
- Pagina publica de hotel.
- Busca por cidade.
- Favoritos no navegador.
- Consulta publica de disponibilidade.
- Login administrativo com 2FA.
- Escopo por perfil administrativo.
- CRUD administrativo de hoteis, quartos, tarifas e disponibilidade.
- Upload de imagens de hotel e quarto.
- Auditoria de alteracoes administrativas.

## Ainda nao incluido

- Confirmacao automatica de reservas.
- Pagamento online.
- Motor completo de reservas.
- Envio de convite por e-mail para administradores.
- Calendario visual avancado de disponibilidade.
- Integracao com PMS, channel manager ou CRM.

## Como reportar bugs

Ao encontrar um problema, envie:

- URL da pagina.
- Usuario utilizado.
- Passos para reproduzir.
- Resultado esperado.
- Resultado obtido.
- Print ou video curto, se possivel.
- Data e horario aproximado do teste.

## Observacoes de seguranca

- Nao compartilhe credenciais fora do grupo de testes.
- Nao cadastre dados reais de hospedes, cartoes ou documentos.
- Nao use senhas pessoais.
- O ambiente de homologacao pode ser reiniciado ou ter dados ajustados durante os testes.
- As credenciais de teste devem ser removidas ou trocadas antes de qualquer uso em producao.
