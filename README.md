# LPH Hotéis

Plataforma web da rede LPH para catálogo público de hotéis e operação administrativa interna.

O projeto combina:

- site público com listagem e páginas individuais de hotéis;
- área administrativa protegida;
- persistência com Prisma + PostgreSQL;
- autenticação com sessão segura e 2FA para administradores.

## Stack utilizada

- Next.js 15 (App Router)
- React 19
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod
- `bcryptjs` para hash de senha
- `jose` para sessão baseada em cookie assinado
- `otpauth` para 2FA

## Requisitos para rodar localmente

- Node.js 20+ recomendado
- npm
- PostgreSQL disponível localmente

## Variáveis de ambiente

Crie um arquivo `.env` com base em `.env.example`.

Variáveis atualmente necessárias:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/lph_hoteis?schema=public"
AUTH_SECRET="defina-um-segredo-longo-e-aleatorio-aqui"
TWO_FACTOR_ENCRYPTION_KEY="defina-uma-chave-base64-com-32-bytes"
UPLOAD_MAX_IMAGE_SIZE_BYTES="5242880"
```

Descrição:

- `DATABASE_URL`: conexão com o PostgreSQL.
- `AUTH_SECRET`: segredo usado para assinatura e validação de sessão.
- `TWO_FACTOR_ENCRYPTION_KEY`: chave base64 de 32 bytes para proteger o segredo de 2FA no banco.
- `UPLOAD_MAX_IMAGE_SIZE_BYTES`: limite máximo de upload de imagem em bytes. Opcional. Se ausente, usa `5 MB`.

## Instalação

```bash
npm install
```

## Comandos principais

Comandos existentes no `package.json`:

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

## Como rodar o projeto

1. Instale as dependências.
2. Configure o `.env`.
3. Gere o client do Prisma:

```bash
npm run prisma:generate
```

4. Rode as migrations:

```bash
npm run prisma:migrate
```

5. Popule a base com seed:

```bash
npm run prisma:seed
```

6. Inicie o ambiente local:

```bash
npm run dev
```

Aplicação local padrão:

- [http://localhost:3000](http://localhost:3000)

## Migrations

```bash
npm run prisma:migrate
```

## Seed

```bash
npm run prisma:seed
```

## Prisma Studio

```bash
npm run prisma:studio
```

## Lint, format e build

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format
npm run format:check
```

### Build

```bash
npm run build
```

### Quality gate local

```bash
npm run quality
```

## Visão geral da arquitetura

### Camadas principais

- `src/app`: rotas públicas, rotas administrativas e rotas de API.
- `src/components`: componentes visuais reutilizáveis.
- `src/lib`: autenticação, autorização, validação, auditoria, upload, leitura de dados e tratamento de erro.
- `src/data`: dados locais de apoio para desenvolvimento.
- `prisma`: schema, migrations e seed.

### Estratégia de dados

O fluxo principal usa Prisma + PostgreSQL.

Em desenvolvimento, ainda existem dados locais de apoio em `src/data` para cenários controlados. Em produção, páginas públicas não devem exibir hotéis mockados quando o banco não retornar dados.

### Segurança

- autenticação por e-mail e senha;
- sessão em cookie `HttpOnly`;
- `Secure` em produção;
- `SameSite` configurado;
- 2FA para administradores;
- autorização por hotel no backend;
- auditoria de alterações administrativas;
- upload protegido por autenticação, permissão e validação de arquivo.

## Principais pastas

### `src/app`

- `page.tsx`: home pública.
- `hoteis/[slug]/page.tsx`: página pública individual de hotel.
- `login`: tela de login.
- `admin`: área administrativa protegida.
- `api/auth`: login, logout e 2FA.
- `api/admin/hoteis`: upload e remoção de imagens.

### `src/lib`

- `auth/`: sessão, senha, 2FA, rate limit, autorização e proteção.
- `audit/`: auditoria administrativa.
- `errors/`: base central de erros e respostas padronizadas.
- `uploads/`: validação e persistência de imagens.
- `validations/`: schemas Zod dos payloads administrativos.
- `hotel-data.ts`: leitura pública de hotéis.
- `prisma.ts`: instância central do Prisma Client.

### `src/components`

Componentes da home, da página pública do hotel e do admin.

### `src/data`

Dados locais de apoio e conteúdo estático de interface.

### `prisma`

- `schema.prisma`: modelagem principal.
- `migrations/`: histórico de migrations.
- `seed.cjs`: carga inicial da base.

## Fluxo público dos hotéis

1. A home consulta hotéis publicados.
2. A seção `Conheça nossos hotéis` renderiza cards com imagem, nome, cidade e estado.
3. Cada card navega para `/hoteis/[slug]`.
4. A página pública carrega os dados do hotel publicado.
5. Se o hotel não existir ou não estiver publicado, retorna 404.

## Fluxo administrativo

1. Usuário acessa `/login`.
2. Autentica com e-mail e senha.
3. Se for administrador, precisa concluir 2FA.
4. Rotas `/admin` exigem sessão válida e 2FA validado.
5. `super_admin` acessa todos os hotéis.
6. `hotel_admin` acessa apenas hotéis vinculados em `HotelPermission`.
7. Escritas administrativas validam:
   - sessão;
   - permissão no backend;
   - payload com schema;
   - auditoria da alteração.

## Estado atual do projeto

### Já existe

- site público em Next.js
- página pública dinâmica por hotel
- Prisma configurado
- schema e migrations
- seed inicial
- autenticação com sessão segura
- 2FA para administradores
- autorização por hotel
- upload protegido de imagens
- auditoria administrativa
- ESLint
- Prettier
- quality gate local

### Parcial / pendente

- `npm audit` ainda precisa ser revisado antes de produção
- dados locais de apoio ainda existem em desenvolvimento
- não há painel de gestão de usuários/permissões

## Checklist de segurança operacional

- [ ] Nunca versionar `.env`. Use apenas `.env.example` como referência.
- [ ] Manter `DATABASE_URL` real e separado por ambiente.
- [ ] Não usar mocks ou fallbacks de hotéis em produção.
- [x] Toda escrita administrativa exige autenticação e autorização no backend.
- [x] Upload aceita apenas imagens validadas por tipo, extensão e conteúdo.
- [ ] Revisar toda migration antes de aplicar em ambientes compartilhados ou produção.
- [ ] Rodar `npm run quality` antes de merge ou deploy.
- [ ] Revisar `npm audit` antes de produção.
- [x] Nunca expor segredos, hashes, tokens ou chaves no frontend.

Observação:

- O item de `npm audit` continua pendente operacionalmente. O projeto possui quality gate local, mas a revisão de dependências vulneráveis ainda depende do processo de release.

## Observações de segurança

- Nunca salvar senha em texto puro.
- Nunca confiar em validação apenas no frontend.
- Toda escrita administrativa deve continuar validando permissão no backend.
- Não remover auditoria de operações sensíveis.
- Não expor segredos, hashes, tokens ou segredos de 2FA no cliente.
- Não aceitar upload fora das validações já existentes.

## Orientações para colaboradores

- Preserve a separação entre autenticação e autorização.
- Mantenha validação forte no backend.
- Use os helpers existentes em `src/lib/auth`, `src/lib/validations`, `src/lib/audit` e `src/lib/errors`.
- Ao adicionar campos novos ao hotel:
  - atualize o schema do Prisma;
  - gere migration;
  - ajuste seed se necessário;
  - revise a leitura pública em `src/lib/hotel-data.ts`;
  - revise a edição administrativa.
- Antes de abrir PR interno, rode:

```bash
npm run quality
```

## Importante

Nunca commite:

- `.env`
- segredos reais
- credenciais de banco
- chaves de autenticação
- chaves de criptografia

O arquivo versionado para referência deve ser apenas `.env.example`.
