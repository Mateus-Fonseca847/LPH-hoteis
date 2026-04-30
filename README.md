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

Crie `.env` com base em `.env.example`. Nunca commite `.env`, chaves reais ou credenciais.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
AUTH_SECRET=""
TWO_FACTOR_ENCRYPTION_KEY=""
NODE_ENV="production"
UPLOAD_MAX_IMAGE_SIZE_BYTES="5242880"
EMAIL_PROVIDER="resend"
EMAIL_FROM="LPH Testes <onboarding@resend.dev>"
RESEND_API_KEY=""
NEXT_PUBLIC_APP_URL="https://staging.seu-dominio.com"
PAYMENT_SECRETS_ENCRYPTION_KEY=""
MERCADO_PAGO_ACCESS_TOKEN=""
MERCADO_PAGO_SANDBOX="true"
MERCADO_PAGO_WEBHOOK_URL=""
MERCADO_PAGO_WEBHOOK_SECRET=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
ALLOW_LOCAL_HOTEL_DATA_FALLBACK="false"
SEED_STAGING_SUPER_ADMIN_EMAIL="super.admin.staging@lphhoteis.local"
SEED_STAGING_SUPER_ADMIN_PASSWORD=""
SEED_STAGING_HOTEL_ADMIN_EMAIL="hotel.admin.staging@lphhoteis.local"
SEED_STAGING_HOTEL_ADMIN_PASSWORD=""
SEED_STAGING_HOTEL_ADMIN_HOTEL_SLUG="lph-marina-santos"
SEED_ADMIN_EMAIL=""
SEED_ADMIN_PASSWORD=""
```

## Staging / Homologação

Configure as variáveis na plataforma, não no repositório. Para homologação, use banco, e-mails e credenciais de pagamento separados de produção.

Variáveis obrigatórias para staging:

- `DATABASE_URL`: PostgreSQL de homologação, separado do ambiente local e de produção.
- `AUTH_SECRET`: segredo longo e aleatório para assinar sessões/cookies.
- `TWO_FACTOR_ENCRYPTION_KEY`: chave base64 de 32 bytes. Gere com `openssl rand -base64 32`.
- `NODE_ENV`: em deploy de staging, use `production`.
- `UPLOAD_MAX_IMAGE_SIZE_BYTES`: limite de upload em bytes. Exemplo: `5242880` para 5 MB.
- `ALLOW_LOCAL_HOTEL_DATA_FALLBACK`: manter `false` em staging. O app não deve usar dados locais quando o banco falhar.

Variáveis recomendadas conforme recursos ativos:

- `PAYMENT_SECRETS_ENCRYPTION_KEY`: chave base64 de 32 bytes para credenciais de pagamento por hotel.
- `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`: envio real de e-mails transacionais.
- `NEXT_PUBLIC_APP_URL`: URL pública de homologação, usada em retornos de checkout.
- `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_SANDBOX`, `MERCADO_PAGO_WEBHOOK_URL`, `MERCADO_PAGO_WEBHOOK_SECRET`: pagamentos em sandbox.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: ainda são lidas pelo webhook legado de Stripe.
- `SEED_STAGING_*`: opcionais para criar usuários administrativos de teste via seed.
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`: aliases legados ainda aceitos pelo seed.

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
- O banco deve conter hotéis publicados para a home e páginas públicas.
- Deve existir ao menos um usuário `super_admin` ativo para acessar `/admin`.
- Se usar as variáveis `SEED_STAGING_*`, rode `npm run prisma:seed` após as migrations; o primeiro login exigirá ativação de 2FA.
- Credenciais `SEED_STAGING_*` são apenas para homologação/testes do cliente. Não use esses usuários nem essas senhas em produção.
- `NODE_ENV` deve ser `production` no runtime de staging.
- Não use `.env` local, SQLite, seed ou mocks como fonte de dados do staging.
- Com `ALLOW_LOCAL_HOTEL_DATA_FALLBACK="false"`, a aplicação falha de forma explícita se `DATABASE_URL` estiver ausente.
- A autenticação falha de forma explícita se `AUTH_SECRET` estiver ausente.
- A ativação/validação de 2FA falha de forma explícita se `TWO_FACTOR_ENCRYPTION_KEY` estiver ausente ou não for base64 de 32 bytes.
- Uploads gravados em `public/uploads` dependem de disco persistente; em hospedagem serverless, use URLs externas ou configure armazenamento persistente antes de testar upload.

## Deploy na Railway

1. Conecte o repositório GitHub no Railway e crie o serviço da aplicação.
2. Adicione um serviço PostgreSQL no mesmo projeto Railway.
3. No serviço da aplicação, configure `DATABASE_URL` usando a URL interna do PostgreSQL da Railway.
4. Configure as demais variáveis de ambiente listadas em `.env.example`.
5. Defina `ALLOW_LOCAL_HOTEL_DATA_FALLBACK="false"` em homologação.
6. Configure o Pre-deploy Command como:

```bash
npm run prisma:migrate:deploy
```

7. Use o Build Command padrão do projeto:

```bash
npm run build
```

8. Use o Start Command:

```bash
npm start
```

Scripts de produção:

- `npm run build`: gera o Prisma Client e compila o Next.js.
- `npm start`: inicia o Next.js em produção.
- `npm run prisma:generate`: gera o Prisma Client manualmente, se necessário.
- `npm run prisma:migrate:deploy`: aplica migrations em ambientes de deploy.

Não use banco local em homologação.

## Prisma e migrations

Use estes comandos conforme o ambiente:

- Desenvolvimento local: `npm run prisma:migrate` (`prisma migrate dev`) cria e aplica novas migrations durante o desenvolvimento.
- Staging/produção: `npm run prisma:generate` e depois `npm run prisma:migrate:deploy` (`prisma migrate deploy`) aplicam somente migrations já versionadas.
- Não use `prisma db push` em staging ou produção. Ele altera o schema direto no banco e não preserva o histórico auditável de migrations.

Comando recomendado para staging:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

## Seed de homologação

Após aplicar as migrations em staging, rode o seed apenas quando quiser preparar ou restaurar dados de demonstração:

```bash
npm run prisma:seed
```

Antes de rodar, configure pelo menos:

- `SEED_STAGING_SUPER_ADMIN_PASSWORD`: senha forte para o super admin.
- `SEED_STAGING_HOTEL_ADMIN_PASSWORD`: senha forte para o admin do hotel.
- `SEED_STAGING_SUPER_ADMIN_EMAIL`: opcional; define o e-mail do super admin.
- `SEED_STAGING_HOTEL_ADMIN_EMAIL`: opcional; define o e-mail do admin do hotel.
- `SEED_STAGING_HOTEL_ADMIN_HOTEL_SLUG`: opcional; define o hotel vinculado ao admin.

O seed popula:

- hotéis publicados com textos, imagens, comodidades e políticas;
- quartos ativos com capacidade, camas, tamanho, imagens e comodidades;
- tarifas ativas em reais, salvas em centavos;
- disponibilidade futura para teste de consulta;
- um `super_admin`, quando a senha de seed estiver configurada;
- um `hotel_admin` vinculado a um hotel, quando a senha de seed estiver configurada.

Use o seed somente em homologação/desenvolvimento. Não use para popular produção.

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
