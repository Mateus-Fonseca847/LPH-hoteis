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

## Status do projeto

### Implementado

- Catálogo público de hotéis publicados, páginas de hotel, busca e favoritos locais.
- Consulta pública de disponibilidade por datas, viajantes e quarto.
- Fluxo público real de reserva: criação de reserva, retenção de disponibilidade, checkout externo, webhooks de pagamento e e-mails após confirmação.
- Pagamento online ativo via Mercado Pago, com Pix, cartão de crédito, cartão de débito e boleto conforme disponibilidade do provedor.
- Painel administrativo com hotéis, quartos, tarifas, disponibilidade, imagens, configurações de pagamento, reservas, administradores, auditoria, segurança e financeiro.
- Autenticação com sessão em cookie, cadastro público e 2FA administrativo por e-mail.
- Testes automatizados com Vitest para regras críticas de reserva, pagamento, disponibilidade, autorização e 2FA.

### Parcialmente implementado

- Motor de reserva: existe fluxo transacional público com pagamento e controle de disponibilidade; o admin possui acompanhamento de reservas/pagamentos, mas não executa remarcação, cancelamento manual ou confirmação manual de pagamento.
- Financeiro: exibe reservas pagas, métodos, receita e comissão, mas não executa repasses bancários.
- E-mails transacionais: envio existe para 2FA e confirmação de reserva paga, condicionado à configuração do provedor de e-mail.
- Pagamentos por hotel: configuração administrativa existe; o checkout público exige provedor habilitado e credenciais válidas.

### Pendente

- Convite por e-mail para novos administradores.
- Cancelamento/remarcação manual de reservas no admin.
- Calendário visual avançado de disponibilidade.
- Rotina automática de expiração/liberação de reservas abandonadas em `awaiting_payment`.
- Revisão de `npm audit` antes de produção.

### Legado/compatibilidade

- Webhook Stripe legado permanece disponível para compatibilidade com reservas antigas/campos legados.
- Campos `stripeCheckoutSessionId`, `stripePaymentIntentId`, `twoFactorEnabled` e `twoFactorSecret` são mantidos por compatibilidade.
- `manual` existe em `PaymentProvider` para configuração/desativação administrativa, mas não é checkout público online.
- Dados locais em `src/data` são apoio de desenvolvimento e não devem ser fonte de staging/produção.

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
UPLOAD_STORAGE_PROVIDER="local"
EMAIL_PROVIDER="resend"
EMAIL_FROM="LPH Testes <onboarding@resend.dev>"
RESEND_API_KEY=""
NEXT_PUBLIC_APP_URL="https://staging.seu-dominio.com"
PAYMENT_SECRETS_ENCRYPTION_KEY=""
PAYMENT_PROVIDER="mercado_pago"
PAYMENT_ACCESS_TOKEN=""
PAYMENT_WEBHOOK_URL=""
PAYMENT_WEBHOOK_SECRET=""
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
- `UPLOAD_STORAGE_PROVIDER`: `local` para gravar em `public/uploads`; `external_url` é placeholder para integração futura com storage externo.
- `ALLOW_LOCAL_HOTEL_DATA_FALLBACK`: manter `false` em staging. O app não deve usar dados locais quando o banco falhar.

Variáveis recomendadas conforme recursos ativos:

- `PAYMENT_SECRETS_ENCRYPTION_KEY`: chave base64 de 32 bytes para credenciais de pagamento por hotel.
- `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`: envio real de e-mails transacionais.
- `NEXT_PUBLIC_APP_URL`: URL pública de homologação, usada em retornos de checkout.
- `PAYMENT_PROVIDER`: provedor online ativo. Hoje use `mercado_pago`.
- `PAYMENT_ACCESS_TOKEN`, `PAYMENT_WEBHOOK_URL`, `PAYMENT_WEBHOOK_SECRET`: aliases genéricos aceitos pelo código de pagamento.
- `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_SANDBOX`, `MERCADO_PAGO_WEBHOOK_URL`, `MERCADO_PAGO_WEBHOOK_SECRET`: checkout e webhook Mercado Pago em sandbox.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: ainda são lidas apenas pelo webhook legado de Stripe.
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
- Para testar reserva pública completa, o hotel deve ter quartos ativos, tarifas ativas, disponibilidade futura com unidades disponíveis e pagamento Mercado Pago habilitado nas configurações do hotel.
- O webhook Mercado Pago precisa apontar para a URL pública de staging. Sem webhook público, o checkout pode iniciar, mas a confirmação automática não será validada no ambiente.
- Se usar as variáveis `SEED_STAGING_*`, rode `npm run prisma:seed` após as migrations; o primeiro login exigirá ativação de 2FA.
- Credenciais `SEED_STAGING_*` são apenas para homologação/testes do cliente. Não use esses usuários nem essas senhas em produção.
- `NODE_ENV` deve ser `production` no runtime de staging.
- Não use `.env` local, SQLite, seed ou mocks como fonte de dados do staging.
- Com `ALLOW_LOCAL_HOTEL_DATA_FALLBACK="false"`, a aplicação falha de forma explícita se `DATABASE_URL` estiver ausente.
- A autenticação falha de forma explícita se `AUTH_SECRET` estiver ausente.
- A ativação/validação de 2FA falha de forma explícita se `TWO_FACTOR_ENCRYPTION_KEY` estiver ausente ou não for base64 de 32 bytes.
- Uploads com `UPLOAD_STORAGE_PROVIDER="local"` são gravados em `public/uploads` e dependem de disco persistente. Em Railway, configure um Volume persistente montado no caminho da aplicação antes de usar upload em staging/produção. Sem volume, arquivos enviados podem ser perdidos em redeploy/restart.

## Deploy na Railway

1. Conecte o repositório GitHub no Railway e crie o serviço da aplicação.
2. Adicione um serviço PostgreSQL no mesmo projeto Railway.
3. No serviço da aplicação, configure `DATABASE_URL` usando a URL interna do PostgreSQL da Railway.
4. Configure as demais variáveis de ambiente listadas em `.env.example`.
5. Defina `ALLOW_LOCAL_HOTEL_DATA_FALLBACK="false"` em homologação.
6. Para testar upload em staging, configure um Railway Volume persistente. Com `UPLOAD_STORAGE_PROVIDER="local"`, o app grava arquivos em `public/uploads`; sem volume persistente, imagens enviadas podem desaparecer após redeploy ou restart.
7. Configure o Pre-deploy Command como:

```bash
npm run prisma:migrate:deploy
```

8. Use o Build Command padrão do projeto:

```bash
npm run build
```

9. Use o Start Command:

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

Para validar localmente sem serviços externos reais:

```bash
npm run test
npm run quality
```

O fluxo público de checkout exige credenciais Mercado Pago e URL de webhook acessível pelo provedor. Em ambiente puramente local, teste a criação/validação com mocks automatizados ou use uma URL pública de túnel apenas em sandbox.

## Comandos úteis

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:watch
npm run test:coverage
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

Os testes automatizados rodam separadamente:

```bash
npm run test
```

## CI

O repositório possui GitHub Actions em `.github/workflows/ci.yml`. O pipeline roda em `push` para `main` e em `pull_request` para `main`, usando Node.js 20.

Ele executa `npm ci`, `npm run prisma:generate`, `npm run quality` e `npm run test`. As variáveis usadas no workflow são valores fake seguros apenas para build/validação; credenciais reais devem ficar somente nos ambientes de staging/produção.

## Arquitetura

- A entrada da aplicação é o App Router em `src/app`; não há HTML/CSS/JS estático legado na raiz.
- `src/app`: rotas públicas, rotas administrativas e APIs.
- `src/components`: componentes reutilizáveis da home e páginas públicas.
- `src/lib`: autenticação, autorização, validações, auditoria, upload, erros e Prisma.
- `src/data`: dados locais de apoio para desenvolvimento.
- `prisma`: schema, migrations e seed.

## Uploads e imagens

- Hotéis, capas, galeria e quartos usam URLs salvas no banco. URLs antigas continuam válidas enquanto o arquivo ou URL externa existir.
- O provider atual `local` grava arquivos em `public/uploads/hotels/[hotelId]` e retorna URLs `/uploads/hotels/...`.
- O provider `external_url` existe como placeholder seguro: ele bloqueia novos uploads até a integração real com S3/R2/Supabase Storage ser implementada. Isso evita falsa sensação de persistência em produção sem disco.
- Para desenvolvimento local, use `UPLOAD_STORAGE_PROVIDER="local"`.
- Para staging no Railway com upload real, use `UPLOAD_STORAGE_PROVIDER="local"` somente se houver Railway Volume persistente configurado.
- Para produção, a recomendação é migrar para storage externo gerenciado antes de liberar upload público/administrativo em larga escala.
- A validação de upload rejeita arquivos sem conteúdo, arquivos acima de `UPLOAD_MAX_IMAGE_SIZE_BYTES`, MIME types fora de JPG/PNG/WEBP, extensões inseguras, dupla extensão suspeita e conteúdo cujo magic number não corresponda ao MIME declarado.

## Fluxo público

- A home lista hotéis publicados.
- Cards da seção `Conheça nossos hotéis` navegam para `/hoteis/[slug]`.
- A página pública do hotel usa dados do banco.
- Hotéis inexistentes ou despublicados retornam 404.
- Quartos ativos aparecem publicamente com preço inicial baseado em tarifas ativas.
- O botão `Consultar disponibilidade` abre um fluxo público em etapas: datas/viajantes, escolha do quarto, dados do hóspede, pagamento e confirmação.
- A etapa de quartos usa disponibilidade configurada, capacidade e tarifas ativas. Quartos com disponibilidade desconhecida ou indisponível não seguem para reserva.
- A API `/api/reservas` cria a reserva inicialmente como `awaiting_payment`/`pending`, retém uma unidade de disponibilidade por noite e inicia checkout externo.
- O pagamento aprovado por webhook confirma a reserva, marca `paymentStatus` como `paid`, registra transação financeira e dispara e-mails.
- Pagamento recusado, cancelado, expirado, estornado ou com chargeback marca a reserva como falha/cancelada e libera a disponibilidade retida.
- Webhooks duplicados são tratados de forma idempotente para não duplicar reserva, disponibilidade ou e-mails.
- O motor atual é um fluxo transacional público de reserva e pagamento. Ainda não é um motor operacional completo com gestão administrativa de reservas, remarcação, cancelamento manual e calendário avançado.

## Pagamentos

- Provedor online ativo: Mercado Pago.
- Métodos expostos no fluxo público: Pix, cartão de crédito, cartão de débito e boleto.
- Cada hotel precisa ter configuração de pagamento habilitada para permitir reserva pública.
- `PaymentProvider.manual` existe para estado/configuração administrativa e compatibilidade, mas não inicia checkout online público.
- Stripe é legado: o webhook `/api/stripe/webhook` continua disponível para compatibilidade com campos e eventos antigos, mas o checkout público atual usa Mercado Pago.
- Nunca use credenciais reais em desenvolvimento local ou homologação. Use sandbox e banco separado.

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
- enviar imagem do quarto por upload validado.

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

### Configuração de pagamento

Na edição do hotel:

- configurar provedor `manual` ou `mercado_pago`;
- ativar/desativar pagamento online do hotel;
- salvar credencial sensível criptografada;
- preservar credencial existente sem exibi-la novamente;
- registrar auditoria da alteração.

O checkout público só inicia quando a configuração do hotel está habilitada e compatível com o provedor ativo do ambiente.

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
- O fluxo atual de login administrativo usa 2FA por e-mail.
- `emailTwoFactorEnabled` controla a exigência de código por e-mail no login.
- `twoFactorEnabled` e `twoFactorSecret` são campos legados de app autenticador/TOTP e não controlam o login atual.
- Usuários comuns e administradores com `emailTwoFactorEnabled=false` entram apenas com e-mail e senha.
- Administradores com `emailTwoFactorEnabled=true` recebem um código de 6 dígitos por e-mail antes de acessar o painel.
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
- Há tela administrativa de acompanhamento de reservas/pagamentos em `/admin/reservas`, sem confirmação manual de pagamento.
- Não há remarcação/cancelamento manual de reserva no admin.
- Não há calendário visual avançado de disponibilidade.
- Não há rotina automática para expirar reservas abandonadas em `awaiting_payment`.
- `npm audit` deve ser revisado antes de produção.
- Dados locais de apoio continuam existindo para desenvolvimento e não devem contaminar produção.

## Checklist operacional

- Rode `npm run quality` antes de merge/deploy.
- Revise migrations antes de aplicar em ambientes compartilhados.
- Use `DATABASE_URL` real e separado por ambiente.
- Nunca use mocks em produção.
- Nunca exponha segredos no frontend.
- Nunca commite `.env`, credenciais ou chaves reais.
