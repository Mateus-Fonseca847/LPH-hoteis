# LPH Hotéis

Plataforma web da LPH Hotéis para divulgação pública de hotéis, consulta de disponibilidade, reserva online e operação administrativa.

Produção: `https://lazerpousadahoteis.com.br`  
Repositório: `https://github.com/Mateus-Fonseca847/LPH-hoteis`

## Visão Geral

O projeto usa Next.js App Router com PostgreSQL via Prisma. O site público mostra hotéis publicados, mapa, busca, páginas de hotel e fluxo de reserva. O painel administrativo permite criar e operar hotéis, quartos, tarifas, disponibilidade, experiências próximas, imagens, comodidades, políticas, reservas, auditoria, financeiro e permissões.

O deploy principal é Vercel + Neon PostgreSQL + Resend + Vercel Blob.

## Stack

- Next.js 15
- React 19
- TypeScript
- Prisma ORM
- PostgreSQL, atualmente Neon em produção
- Vercel
- Vercel Blob para uploads em produção
- Resend para e-mails
- Mercado Pago para checkout online
- Stripe apenas como webhook legado
- Vitest
- ESLint
- Prettier

## Funcionalidades Públicas

- Home com hotéis publicados.
- Busca pública em `/buscar`.
- Mapa público em `/mapa`.
- Página pública de hotel em `/hoteis/[slug]`.
- Fluxo de reserva em `/hoteis/[slug]/reservar`.
- Redirecionamento legado de `/hoteis/[slug]/disponibilidade`.
- Sugestões de hotel via `/api/hoteis/sugestoes`.
- Recomendações de viagem via `/api/viagem/recomendacoes`.
- Cadastro público em `/cadastro`.
- Solicitação pública de acesso de dono de hotel em `/cadastro`, gravada como `HotelOwnerSignupRequest`.
- Login em `/login`.

Hotéis com `isPublished=false` não aparecem na home, busca, mapa ou página pública.

## Funcionalidades Administrativas

Rotas principais:

- `/admin`: painel operacional.
- `/admin/hoteis`: listagem administrativa.
- `/admin/hoteis/novo`: criação de hotel como rascunho.
- `/admin/hoteis/[id]`: edição completa do hotel.
- `/admin/administradores`: usuários e vínculos administrativos.
- `/admin/auditoria`: auditoria de alterações de tarifas.
- `/admin/auditoria/[id]`: detalhe de auditoria.
- `/admin/reservas`: reservas.
- `/admin/reservas/[id]`: operação de reserva.
- `/admin/financeiro`: dashboard financeiro.
- `/admin/seguranca`: 2FA por e-mail opcional.
- `/admin/solicitacoes-acesso`: aprovação/rejeição de solicitações de donos de hotéis, restrita a `super_admin`.

## Papéis de Usuário

- `user`: usuário comum; não acessa o painel administrativo.
- `hotel_admin`: acessa apenas hotéis vinculados em `HotelPermission`.
- `super_admin`: acessa todos os hotéis e pode publicar/aprovar.

Papéis por hotel:

- `owner`
- `admin`
- `editor`

As permissões são validadas no backend. A UI não é fonte de segurança.

## Login e 2FA

Administradores podem entrar com e-mail e senha. O 2FA por e-mail existe como funcionalidade opcional:

- se `emailTwoFactorEnabled=true`, o login administrativo exige código por e-mail;
- se `emailTwoFactorEnabled=false`, o admin entra apenas com e-mail e senha;
- `twoFactorEnabled` e `twoFactorSecret` são campos legados de TOTP.

## Solicitação de Acesso de Dono de Hotel

O cadastro público de donos de hotéis não cria usuário automaticamente:

1. O dono solicita acesso em `/cadastro`.
2. A solicitação fica como `pending` em `HotelOwnerSignupRequest`.
3. `super_admin` revisa em `/admin/solicitacoes-acesso`.
4. Ao aprovar, o sistema cria `User` com `globalRole="hotel_admin"` e `isActive=true`.
5. A aprovação não cria `super_admin`, não cria sessão e não cria `HotelPermission` sem hotel concreto.
6. Como não há fluxo completo de definição de senha, a aprovação envia senha temporária forte por e-mail e recomenda troca no primeiro acesso.
7. O `hotel_admin` aprovado pode criar seu primeiro hotel em `/admin/hoteis/novo`; nesse fluxo o sistema cria `HotelPermission owner` para o hotel criado.
8. Ao rejeitar, o sistema marca a solicitação como `rejected` e não cria `User`.

## Criação, Aprovação e Publicação de Hotel

O fluxo atual separa rascunho de publicação:

1. `hotel_admin` ou `super_admin` cria um hotel em `/admin/hoteis/novo`.
2. O hotel é salvo com `isPublished=false`.
3. Após o primeiro save, ficam disponíveis quartos, tarifas, disponibilidade, experiências e uploads adicionais.
4. O hotel pode ser enviado para aprovação quando estiver completo.
5. `super_admin` aprova e publica.
6. Após aprovação, o hotel passa a `isPublished=true`.

Requisitos de publicação validados no código:

- dados básicos completos;
- e-mail de contato;
- imagem de capa;
- pelo menos 1 quarto ativo;
- pelo menos 1 tarifa ativa;
- disponibilidade futura cadastrada;
- coordenadas válidas quando exigidas para mapa/publicação.

## Quartos, Tarifas e Disponibilidade

Quartos ficam vinculados ao hotel e incluem nome, descrição, imagem, capacidade, camas, tamanho, comodidades e status ativo.

Tarifas exigem um quarto já criado. Campos principais:

- nome;
- descrição;
- preço em reais na UI, salvo em centavos em `priceCents`;
- moeda, normalmente `BRL`;
- data inicial;
- data final;
- mínimo de noites;
- hóspedes máximos;
- reembolsável;
- café incluso;
- ativa/inativa.

Uma tarifa ativa é necessária para o hotel ficar publicável.

Disponibilidade é cadastrada por quarto e data:

- unidades totais;
- unidades disponíveis;
- período fechado ou aberto;
- observação interna.

## Experiências Próximas

Experiências próximas ficam em `HotelExperience` e são vinculadas ao hotel. Incluem título, cidade, estado, descrição, imagem, categorias, preferências, distância e status ativo.

Na criação inicial do hotel, experiências não são obrigatórias. A seção depende do hotel já salvo com `id`.

## Reservas

O fluxo público cria reservas em `/api/reservas`.

Modelos principais:

- `Reservation`
- `PaymentTransaction`
- `PaymentReconciliationLog`
- `ReservationOperationLog`

Status de reserva:

- `pending`
- `awaiting_payment`
- `confirmed`
- `paid`
- `payment_failed`
- `cancelled`
- `expired`

Status de pagamento:

- `pending`
- `awaiting_payment`
- `paid`
- `payment_failed`
- `cancelled`

Reservas aguardando pagamento recebem `expiresAt` e podem ser expiradas pela rotina interna.

## Pagamentos

Provedor online ativo: Mercado Pago.

Variáveis aceitas:

- `PAYMENT_PROVIDER=mercado_pago`
- `PAYMENT_ACCESS_TOKEN`
- `PAYMENT_WEBHOOK_URL`
- `PAYMENT_WEBHOOK_SECRET`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_SANDBOX`
- `MERCADO_PAGO_WEBHOOK_URL`
- `MERCADO_PAGO_WEBHOOK_SECRET`

`PaymentProvider.manual` existe para compatibilidade e operação administrativa, mas o checkout online real usa Mercado Pago.

Stripe permanece apenas como legado em `/api/stripe/webhook`.

## E-mails com Resend

O envio de e-mails usa Resend quando:

- `EMAIL_PROVIDER=resend`
- `EMAIL_FROM` está configurado;
- `RESEND_API_KEY` está configurado;
- o domínio de envio está verificado no Resend.

`onboarding@resend.dev` serve apenas para testes limitados e normalmente só envia para o e-mail dono da conta Resend.

## Uploads com Vercel Blob

Produção usa Vercel Blob:

```env
STORAGE_PROVIDER="vercel_blob"
BLOB_READ_WRITE_TOKEN=""
```

Regras atuais:

- formatos aceitos: JPG/JPEG, PNG e WEBP;
- SVG é rejeitado;
- arquivos suspeitos ou com dupla extensão são rejeitados;
- limite padrão: `UPLOAD_MAX_IMAGE_SIZE_BYTES=5242880`, ou 5 MB;
- URLs públicas retornadas pelo Blob são salvas no banco;
- Vercel Blob deve permitir acesso público às imagens públicas.

O código ainda possui provider S3-compatible. Use S3 apenas se configurar as variáveis `S3_*`; o deploy atual deve usar Vercel Blob.

## Banco Neon/PostgreSQL

O Prisma usa PostgreSQL:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
```

Produção usa Neon. Aplique migrations com:

```bash
npm run prisma:migrate:deploy
```

Não use `prisma db push` em staging ou produção.

## Deploy na Vercel

Fluxo recomendado:

1. Importe o repositório GitHub na Vercel.
2. Selecione a branch correta, como `staging` para homologação.
3. Configure `DATABASE_URL` apontando para Neon.
4. Configure todas as variáveis de ambiente necessárias.
5. Configure Vercel Blob e `BLOB_READ_WRITE_TOKEN`.
6. Configure Resend e domínio de e-mail.
7. Aplique migrations com `npm run prisma:migrate:deploy`.
8. Faça deploy.
9. Ao mudar variáveis, faça redeploy sem cache se necessário.

Não defina `NODE_ENV=production` manualmente na Vercel se isso impedir instalação de `devDependencies` necessárias ao build. A Vercel já define o ambiente de build/runtime.

## Domínio e DNS

Domínio de produção:

- raiz: `lazerpousadahoteis.com.br`;
- `www`: opcional, recomendado como CNAME para Vercel.

DNS do site e DNS do Resend são coisas diferentes:

- Vercel exige registros para apontar o domínio do site;
- Resend exige registros próprios para validar o domínio remetente;
- o site abrir no navegador não significa que o domínio de e-mail esteja verificado.

## Cron e Manutenção

Rotas internas:

- `POST /api/internal/reservas/expirar`
- `POST /api/internal/pagamentos/reconciliar`

Proteção:

- `INTERNAL_API_TOKEN`
- `CRON_SECRET`, como alias quando a plataforma de cron usa esse nome.

Configure um cron externo ou Vercel Cron para chamar a rotina de expiração periodicamente, por exemplo a cada 5 ou 10 minutos.

## Variáveis de Ambiente

Nunca versionar segredos reais.

### Banco

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
```

### Autenticação

```env
AUTH_SECRET=""
TWO_FACTOR_ENCRYPTION_KEY=""
```

### App

```env
NEXT_PUBLIC_APP_URL="https://lazerpousadahoteis.com.br"
APP_INTERNAL_BASE_URL="https://lazerpousadahoteis.com.br"
ALLOW_LOCAL_HOTEL_DATA_FALLBACK="false"
BOOKING_PAYMENT_TTL_MINUTES="30"
```

### E-mail

```env
EMAIL_PROVIDER="resend"
EMAIL_FROM="LPH Hotéis <noreply@seudominio.com.br>"
RESEND_API_KEY=""
```

### Upload/storage

```env
UPLOAD_MAX_IMAGE_SIZE_BYTES="5242880"
STORAGE_PROVIDER="vercel_blob"
BLOB_READ_WRITE_TOKEN=""
S3_ENDPOINT=""
S3_BUCKET=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_PUBLIC_BASE_URL=""
```

### Cron

```env
INTERNAL_API_TOKEN=""
CRON_SECRET=""
```

### Pagamentos

```env
PAYMENT_PROVIDER="mercado_pago"
PAYMENT_ACCESS_TOKEN=""
PAYMENT_WEBHOOK_URL=""
PAYMENT_WEBHOOK_SECRET=""
PAYMENT_SECRETS_ENCRYPTION_KEY=""
MERCADO_PAGO_ACCESS_TOKEN=""
MERCADO_PAGO_SANDBOX="false"
MERCADO_PAGO_WEBHOOK_URL=""
MERCADO_PAGO_WEBHOOK_SECRET=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

Stripe é legado. Configure apenas se precisar manter compatibilidade com webhook antigo.

### Seeds

```env
SEED_STAGING_SUPER_ADMIN_EMAIL="super.admin.staging@lphhoteis.local"
SEED_STAGING_SUPER_ADMIN_PASSWORD=""
SEED_STAGING_HOTEL_ADMIN_EMAIL="hotel.admin.staging@lphhoteis.local"
SEED_STAGING_HOTEL_ADMIN_PASSWORD=""
SEED_STAGING_HOTEL_ADMIN_HOTEL_SLUG="lph-marina-santos"
SEED_ADMIN_EMAIL=""
SEED_ADMIN_PASSWORD=""
```

## Desenvolvimento Local

Requisitos:

- Node.js `>=20 <25`;
- npm;
- PostgreSQL.

Instalação:

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Aplicação local:

```text
http://localhost:3000
```

Para upload local, use:

```env
STORAGE_PROVIDER="local"
```

## Scripts Úteis

Scripts reais do `package.json`:

```bash
npm ci
npm run dev
npm run build
npm run start
npm test
npm run quality
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed
npm run prisma:validate
npm run format
npm run format:check
npm run lint
npm run test:watch
npm run test:coverage
npm run finance:test-data
npm run finance:clear-test-data
```

Observação: o script de teste é `npm test`. Não existe `npm run test` no `package.json`.

## Produção

Checklist mínimo:

- `DATABASE_URL` de produção no Neon.
- Migrations aplicadas.
- `NEXT_PUBLIC_APP_URL` com domínio final HTTPS.
- `APP_INTERNAL_BASE_URL` com domínio final HTTPS.
- `AUTH_SECRET` forte.
- `TWO_FACTOR_ENCRYPTION_KEY` base64 de 32 bytes.
- `PAYMENT_SECRETS_ENCRYPTION_KEY` base64 de 32 bytes se houver credenciais por hotel.
- `EMAIL_PROVIDER=resend`.
- `RESEND_API_KEY` configurada.
- domínio de e-mail verificado no Resend.
- `STORAGE_PROVIDER=vercel_blob`.
- `BLOB_READ_WRITE_TOKEN` configurado.
- Mercado Pago configurado, se reservas online estiverem ativas.
- Cron de manutenção configurado.
- Pelo menos um `super_admin` ativo.
- `npm run quality` passando antes do deploy.

## Rotas de API

Públicas:

- `POST /api/reservas`
- `GET /api/hoteis/sugestoes`
- `POST /api/marketing/subscribers`
- `POST /api/viagem/recomendacoes`
- `POST /api/hotel-owner-signup`

Autenticação:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/register`
- `POST /api/auth/2fa/email/request`
- `POST /api/auth/2fa/verify`
- `POST /api/auth/2fa/setup`
- `POST /api/auth/2fa/activate`

Admin/upload:

- `POST /api/admin/hoteis/[id]/upload`
- `POST /api/admin/hoteis/[id]/quartos/upload`
- `DELETE /api/admin/hoteis/[id]/images/[imageId]`

Webhooks e internas:

- `POST /api/mercado-pago/webhook`
- `POST /api/stripe/webhook`, legado
- `POST /api/internal/reservas/expirar`
- `POST /api/internal/pagamentos/reconciliar`

## Troubleshooting

### `npm ci` com EPERM no Windows/OneDrive

Feche editores e terminais usando `node_modules`, pare processos Node e tente novamente. Se persistir, mover o repositório para uma pasta fora do OneDrive costuma evitar locks de arquivo.

### Vercel build falha por devDependencies ausentes

Não force `NODE_ENV=production` manualmente nas variáveis da Vercel se isso impedir instalação de dependências de build, como Prisma, TypeScript, ESLint ou Vitest.

### Resend envia só para o dono da conta

Isso acontece ao usar `onboarding@resend.dev`. Configure domínio próprio verificado no Resend e use um `EMAIL_FROM` desse domínio.

### Site funciona, mas e-mail não

DNS da Vercel e DNS do Resend são separados. Verifique os registros exigidos pelo Resend.

### Upload falha em produção

Confirme:

- `STORAGE_PROVIDER=vercel_blob`;
- `BLOB_READ_WRITE_TOKEN` existe na Vercel;
- o Blob está configurado para URLs públicas;
- o arquivo é JPG/JPEG, PNG ou WEBP;
- o arquivo respeita `UPLOAD_MAX_IMAGE_SIZE_BYTES`.

### Correção aparece em Preview, mas não em produção

Verifique se o deploy correto foi promovido para Production. Branch `staging` normalmente gera Preview se o projeto Vercel estiver configurado para produção em outra branch.

### Banco Neon sem migrations

Rode:

```bash
npm run prisma:migrate:deploy
```

Depois faça redeploy se o schema gerado no build estava desatualizado.

### Produção usando deploy antigo

Confirme o commit do deployment na Vercel, faça redeploy sem cache e verifique se as variáveis foram alteradas no ambiente correto.

## CI e Qualidade

O gate principal é:

```bash
npm run quality
```

Ele executa:

- `npm run format:check`;
- `npm run lint`;
- `npm run prisma:validate`;
- `npm test`;
- `npm run build`.

Antes de mudanças de produção, rode pelo menos:

```bash
npm run format:check
npm run build
```
