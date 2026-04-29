# LPH Hotéis

Plataforma web da rede LPH para catálogo público de hotéis e operação administrativa interna.

## Stack

- Next.js 15 com App Router
- React 19
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod
- `bcryptjs` para hash de senha
- `jose` para sessão em cookie assinado
- `otpauth` para 2FA

## Requisitos

- Node.js 20+
- npm
- PostgreSQL

## Variáveis de ambiente

Crie `.env` com base em `.env.example`.

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/lph_hoteis?schema=public"
AUTH_SECRET="defina-um-segredo-longo-e-aleatorio-aqui"
TWO_FACTOR_ENCRYPTION_KEY="defina-uma-chave-base64-com-32-bytes"
UPLOAD_MAX_IMAGE_SIZE_BYTES="5242880"
ALLOW_LOCAL_HOTEL_DATA_FALLBACK="false"
SEED_STAGING_SUPER_ADMIN_EMAIL="super.admin.staging@lphhoteis.local"
SEED_STAGING_SUPER_ADMIN_PASSWORD=""
SEED_STAGING_HOTEL_ADMIN_EMAIL="hotel.admin.staging@lphhoteis.local"
SEED_STAGING_HOTEL_ADMIN_PASSWORD=""
SEED_STAGING_HOTEL_ADMIN_HOTEL_SLUG="lph-marina-santos"
```

Nunca commite `.env`.

## Deploy em staging

Checklist de variaveis obrigatorias:

- `DATABASE_URL`: PostgreSQL separado do ambiente local.
- `AUTH_SECRET`: segredo longo e aleatorio para sessoes.
- `TWO_FACTOR_ENCRYPTION_KEY`: chave base64 com 32 bytes.
- `UPLOAD_MAX_IMAGE_SIZE_BYTES`: limite de upload em bytes.
- `ALLOW_LOCAL_HOTEL_DATA_FALLBACK`: manter `false` em staging/producao.
- `SEED_STAGING_SUPER_ADMIN_EMAIL` e `SEED_STAGING_SUPER_ADMIN_PASSWORD`: opcionais para criar o `super_admin` de homologacao via seed.
- `SEED_STAGING_HOTEL_ADMIN_EMAIL`, `SEED_STAGING_HOTEL_ADMIN_PASSWORD` e `SEED_STAGING_HOTEL_ADMIN_HOTEL_SLUG`: opcionais para criar um `hotel_admin` limitado a um unico hotel.

Passos recomendados:

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run build
npm run start
```

Antes de liberar para o cliente:

- O banco de staging deve ter as migrations aplicadas.
- O banco deve conter hoteis publicados para a home e paginas publicas.
- Deve existir ao menos um usuario `super_admin` ativo para acessar `/admin`.
- Se usar as variaveis `SEED_STAGING_*`, rode `npm run prisma:seed` apos as migrations; o primeiro login exigira ativacao de 2FA.
- Credenciais `SEED_STAGING_*` sao apenas para homologacao/testes do cliente. Nao use esses usuarios nem essas senhas em producao.
- `NODE_ENV` deve ser `production` no runtime de staging.
- Nao use `.env` local, SQLite, seed ou mocks como fonte de dados do staging.
- Uploads gravados em `public/uploads` dependem de disco persistente; em hospedagem serverless, use URLs externas ou configure armazenamento persistente antes de testar upload.

## Instalação e uso

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Aplicação local: [http://localhost:3000](http://localhost:3000)

## Comandos úteis

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run format
npm run format:check
npm run quality
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed
npm run prisma:validate
```

O quality gate executa formatação, lint, validação do Prisma e build:

```bash
npm run quality
```

## Arquitetura

- `src/app`: rotas públicas, rotas administrativas e APIs.
- `src/components`: componentes reutilizáveis da home e páginas públicas.
- `src/lib`: autenticação, autorização, validações, auditoria, upload, erros e Prisma.
- `src/data`: dados locais de apoio para desenvolvimento.
- `prisma`: schema, migrations e seed.

## Fluxo público

- A home lista hotéis publicados.
- Cards da seção `Conheça nossos hotéis` navegam para `/hoteis/[slug]`.
- A página pública do hotel usa dados do banco.
- Hotéis inexistentes ou despublicados retornam 404.
- Quartos ativos aparecem publicamente com preço inicial baseado em tarifas ativas.
- Disponibilidade pública é exibida como status simples, sem motor de reserva.

## Admin Fase 2

### Dashboard operacional

Rota: `/admin`

- `super_admin` vê visão da rede.
- `hotel_admin` vê apenas hotéis vinculados.
- Exibe métricas de hotéis, quartos ativos, tarifas ativas, disponibilidade futura e admins ativos.
- Exibe últimos logs dentro do escopo.
- Exibe alertas acionáveis com links para corrigir pendências.
- Exibe completude dos hotéis com percentual e pendências.

### Hotéis

Rota: `/admin/hoteis`

- `super_admin` lista todos os hotéis.
- `hotel_admin` lista apenas hotéis vinculados.
- Cada card mostra status, permissão e completude do perfil.

### Edição de hotel

Rota: `/admin/hoteis/[id]`

Permite editar:

- dados principais;
- localização;
- contato;
- descrições;
- imagem de capa;
- galeria;
- comodidades;
- políticas;
- horários;
- visibilidade/publicação.

Toda escrita valida sessão, 2FA administrativo, permissão por hotel, payload e auditoria.

### CRUD de quartos

Na edição do hotel:

- listar quartos;
- criar quarto;
- editar quarto;
- ativar/desativar quarto.

Campos principais:

- nome;
- descrição;
- imagem por URL;
- capacidade de adultos e crianças;
- camas;
- tamanho em m²;
- comodidades;
- status ativo.

### CRUD de tarifas

Na edição do hotel:

- selecionar quarto;
- listar tarifas do quarto;
- criar tarifa;
- editar tarifa;
- ativar/desativar tarifa.

Na UI, o preço é digitado em reais. No banco, é salvo em centavos (`priceCents`).

### Gestão de disponibilidade

Na edição do hotel:

- selecionar quarto;
- escolher data inicial e final;
- definir unidades totais;
- definir unidades disponíveis;
- marcar período como fechado;
- adicionar observação interna;
- salvar em lote.

O intervalo de edição em lote é limitado pelos validadores do backend.

### Administradores e permissões

Rota: `/admin/administradores`

- lista administradores acessíveis dentro do escopo;
- cria administrador com vínculo inicial a hotel;
- edita papel por hotel quando permitido;
- remove vínculo permitido;
- `super_admin` pode ativar/desativar usuários;
- protege contra desativar o último `super_admin`;
- impede escalada de privilégio.

Convite por e-mail ainda não está implementado. A criação gera usuário e vínculo administrativo para configuração posterior de acesso.

### Auditoria navegável

Rotas:

- `/admin/auditoria`
- `/admin/auditoria/[id]`

Inclui:

- listagem paginada;
- filtros por hotel, usuário, ação, período e texto livre;
- detalhe do log;
- escopo por perfil;
- redaction de dados sensíveis.

Logs cobrem alterações relevantes em hotéis, quartos, tarifas, disponibilidade, imagens e permissões.

## Papéis e escopos

### Papéis globais

- `super_admin`: acessa a rede inteira.
- `hotel_admin`: acessa hotéis vinculados via `HotelPermission`.
- `user`: não acessa área administrativa.

### Papéis por hotel

- `owner`: pode gerenciar o hotel e atribuir papéis permitidos.
- `admin`: pode gerenciar o hotel e atribuir papéis inferiores.
- `editor`: pode editar dados do hotel, quartos, tarifas e disponibilidade.

As regras efetivas são aplicadas no backend. A UI não é fonte de segurança.

## Segurança

- Senhas são armazenadas com hash.
- Sessão usa cookie `HttpOnly`.
- Cookie usa `Secure` em produção.
- `SameSite` configurado.
- Administradores precisam de 2FA.
- Usuário desativado não autentica como usuário válido.
- Escritas administrativas exigem autenticação e autorização no backend.
- Escritas ligadas a hotel validam permissão por hotel.
- Payloads são validados com Zod e rejeitam campos inesperados.
- Upload aceita apenas imagens validadas por MIME, extensão, tamanho e conteúdo.
- Remoção de imagem exige permissão e registra auditoria.
- Erros usam padrão comum e não devem expor stack trace em produção.
- Auditoria não deve registrar senhas, tokens, segredos de 2FA ou dados sensíveis.

## Pendências reais

- Convite por e-mail ainda não existe.
- Não há motor de reserva.
- Não há calendário visual avançado de disponibilidade.
- Não há gestão dedicada de upload para imagem de quarto; hoje o quarto usa URL/imagem existente.
- Warnings de lint sobre `<img>` ainda existem e podem ser tratados futuramente com `next/image`.
- `npm audit` deve ser revisado antes de produção.
- Dados locais de apoio continuam existindo para desenvolvimento e não devem contaminar produção.

## Checklist operacional

- Rode `npm run quality` antes de merge/deploy.
- Revise migrations antes de aplicar em ambientes compartilhados.
- Use `DATABASE_URL` real e separado por ambiente.
- Nunca use mocks em produção.
- Nunca exponha segredos no frontend.
- Nunca commite `.env`, credenciais ou chaves reais.
