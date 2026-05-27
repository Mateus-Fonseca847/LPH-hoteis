# Guia de homologação - LPH Hotéis

## Objetivo

Validar a plataforma LPH em ambiente de homologação antes da liberação para uso do cliente. O foco é testar a navegação pública, o fluxo de reserva, autenticação com 2FA e a operação administrativa básica.

## Status do projeto

### Implementado

- Catálogo público de hotéis, busca, favoritos locais e páginas públicas de hotel.
- Fluxo público de reserva com consulta de disponibilidade, criação de reserva, checkout Mercado Pago, webhook e e-mails após pagamento aprovado.
- Painel administrativo para hotéis, quartos, tarifas, disponibilidade, imagens, pagamentos, reservas, administradores, auditoria, segurança e financeiro.
- Cadastro/login público e login administrativo com 2FA por e-mail quando habilitado.
- Testes automatizados com Vitest para regras críticas.

### Parcialmente implementado

- O motor de reserva existe para o fluxo público transacional; o admin possui acompanhamento de reservas/pagamentos, mas não possui remarcação, cancelamento manual ou confirmação manual de pagamento.
- Financeiro mostra dados de pagamentos aprovados, mas não executa repasses.
- E-mails dependem de `EMAIL_PROVIDER`, `EMAIL_FROM` e `RESEND_API_KEY` configurados.

### Pendente

- Convite por e-mail para administradores.
- Remarcação/cancelamento manual de reservas no admin.
- Calendário visual avançado de disponibilidade.
- Expiração automática de reservas abandonadas em pagamento.

### Legado/compatibilidade

- Stripe permanece apenas como webhook legado.
- Campos TOTP legados permanecem no schema, mas o login administrativo atual usa 2FA por e-mail.

## Ambiente

- URL da homologação: `[preencher URL da Railway]`
- Data da rodada de testes: `[preencher data]`
- Responsável pelo acompanhamento: `[preencher nome]`
- Banco usado: staging separado de produção.
- Pagamentos usados: Mercado Pago sandbox.
- E-mail usado: conta/provedor de homologação, sem dados reais.

## Testes automatizados

Antes de iniciar a homologação manual, rode:

- `npm ci`: instala dependências em ambiente limpo.
- `npm run prisma:generate`: gera o Prisma Client.
- `npm run prisma:migrate:deploy`: aplica migrations versionadas no banco de staging.
- `npm run prisma:seed`: prepara dados de demonstração, se as variáveis de seed estiverem configuradas.
- `npm run test`: executa a suíte automatizada com Vitest.
- `npm run test:watch`: executa os testes em modo contínuo durante desenvolvimento.
- `npm run test:coverage`: gera relatório de cobertura local.
- `npm run build`: valida build de produção.
- `npm start`: sobe o build já gerado.
- `npm run quality`: mantém formatação, lint, validação Prisma e build.

A suíte automatizada cobre validações de reserva, cálculo de estadia/preço, autorização administrativa por escopo, regras isoladas de 2FA e transições críticas de reserva/pagamento com mocks. Ela não usa chaves reais, banco de produção, Mercado Pago, Stripe ou Resend.

## Credenciais de homologação

Não registre senhas neste arquivo. As senhas devem ser compartilhadas por canal seguro e trocadas após a homologação.

| Perfil         | E-mail                                | Senha                   | Escopo esperado                             |
| -------------- | ------------------------------------- | ----------------------- | ------------------------------------------- |
| Super admin    | `[preencher e-mail do super admin]`   | Enviar por canal seguro | Acesso à rede e a todos os hotéis           |
| Admin de hotel | `[preencher e-mail do hotel admin]`   | Enviar por canal seguro | Acesso apenas ao hotel vinculado            |
| Usuário comum  | `[preencher e-mail do usuário comum]` | Enviar por canal seguro | Cadastro/login público, sem acesso ao admin |

## Pré-requisitos para testar reserva

- Existe pelo menos um hotel publicado.
- O hotel possui quarto ativo, tarifa ativa em BRL e disponibilidade futura com unidades disponíveis para todas as noites testadas.
- O hotel possui configuração Mercado Pago habilitada no admin.
- `NEXT_PUBLIC_APP_URL` aponta para a URL pública de staging.
- O webhook Mercado Pago está configurado para `/api/mercado-pago/webhook` na URL pública de staging.
- Use apenas cartões, documentos, e-mails e dados de sandbox/fictícios.
- Se o webhook não estiver acessível pelo Mercado Pago, teste apenas até o redirecionamento para checkout e registre que a confirmação automática não pôde ser validada.

## Fluxos por conta

### Super admin

1. Acessar `/login`.
2. Entrar com o e-mail do super admin.
3. Se o 2FA por e-mail estiver habilitado, validar recebimento e verificação do código de 6 dígitos.
4. Acessar o Painel administrativo.
5. Validar visão geral da rede, hotéis, administradores, auditoria e segurança.
6. Editar um hotel, revisar quartos, tarifas e disponibilidade.

### Admin de hotel

1. Acessar `/login`.
2. Entrar com o e-mail do admin de hotel.
3. Se o 2FA por e-mail estiver habilitado, validar o código recebido por e-mail.
4. Confirmar que apenas o hotel vinculado aparece no painel.
5. Editar dados permitidos do hotel vinculado.
6. Criar ou alterar quartos, tarifas e disponibilidade.
7. Confirmar que não há acesso a hotéis fora do escopo.

### Usuário comum

1. Acessar a home pública.
2. Criar conta em `/cadastro`.
3. Entrar em `/login`.
4. Validar que não há acesso ao Painel administrativo.
5. Navegar por hotéis, favoritos e fluxo público de reserva.

## Checklist de validação

### Pré-flight de staging

- `DATABASE_URL` aponta para PostgreSQL de staging, separado de produção.
- `AUTH_SECRET` está configurada com segredo forte.
- `TWO_FACTOR_ENCRYPTION_KEY` está em base64 de 32 bytes.
- `PAYMENT_SECRETS_ENCRYPTION_KEY` está em base64 de 32 bytes quando pagamentos por hotel estiverem ativos.
- `NEXT_PUBLIC_APP_URL` aponta para a URL pública de staging.
- Mercado Pago sandbox está configurado com token e webhook, usando aliases `PAYMENT_*` ou variáveis `MERCADO_PAGO_*`.
- `ALLOW_LOCAL_HOTEL_DATA_FALLBACK` está `false`.
- Railway Volume está configurado se uploads locais forem testados em staging.
- Migrations foram aplicadas com `npm run prisma:migrate:deploy`.
- Seed foi executado somente se for necessário preparar dados de demonstração.

### Home pública

- A home abre sem erro.
- Hotéis publicados aparecem com imagem, cidade, preço inicial e CTA.
- Busca por cidade funciona.
- Cards levam para a página pública do hotel.
- Favoritos podem ser adicionados e removidos.

### Página de hotel

- Dados principais aparecem corretamente: nome, descrição, cidade, endereço, contato e horários.
- Galeria e imagem de capa carregam.
- Comodidades e políticas aparecem com textos claros.
- Quartos aparecem com imagem, capacidade, camas, tamanho, comodidades e preço inicial.
- Botão `Consultar disponibilidade` navega para `/hoteis/[slug]/reservar`, a página dedicada de reserva.

### Fluxo de reserva

- Página dedicada ocupa a largura disponível sem overlay, sem botão de fechar e sem bloquear o scroll da página.
- Timeline exibe as etapas: Datas e viajantes, Escolha do quarto, Dados do hóspede, Pagamento e Confirmação.
- Datas, adultos e crianças são preservados ao voltar etapas.
- Etapa de quartos mostra quartos compatíveis e só permite reservar quartos com disponibilidade configurada como `Disponível`.
- Dados do hóspede validam nome, e-mail, telefone e CPF/passaporte.
- Etapa de pagamento permite escolher Pix, cartão de crédito, cartão de débito ou boleto.
- Botão `Criar reserva e iniciar pagamento` só habilita após escolher forma de pagamento.
- Ao iniciar o pagamento, a reserva fica `awaiting_payment`/`pending` e segura uma unidade de disponibilidade para as noites selecionadas.
- O usuário é enviado ao checkout Mercado Pago sandbox ou recebe instruções do meio de pagamento quando aplicável.
- O sistema não confirma reserva antes do webhook de pagamento aprovado pelo provedor.
- Pagamento pendente não marca reserva como paga.
- Pagamento recusado, cancelado, expirado, estornado ou com chargeback marca a reserva como falha/cancelada e devolve a disponibilidade.
- Webhook duplicado de pagamento aprovado não cria nova reserva, não envia confirmação novamente e não baixa disponibilidade duas vezes.
- Antes de confirmar pagamento aprovado, o sistema revalida a disponibilidade configurada para todas as noites.
- E-mails transacionais de reserva são enviados somente após pagamento aprovado e reserva confirmada.
- O painel financeiro passa a considerar a reserva somente quando houver pagamento aprovado.
- Mensagens de erro são compreensíveis.

#### Cenários críticos de pagamento e disponibilidade

| Cenário                      | Procedimento                                                                        | Resultado esperado                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Pagamento aprovado           | Criar reserva com disponibilidade e concluir pagamento sandbox aprovado.            | Reserva muda para `confirmed`, pagamento para `paid` e a unidade permanece reservada.           |
| Pagamento pendente           | Iniciar checkout e manter o pagamento pendente.                                     | Reserva permanece `awaiting_payment`; não há confirmação nem e-mail de confirmação.             |
| Pagamento recusado/cancelado | Recusar ou cancelar o pagamento sandbox.                                            | Reserva muda para `payment_failed` ou `cancelled`; a unidade retida é liberada uma única vez.   |
| Webhook duplicado            | Reenviar o mesmo evento aprovado do provedor.                                       | Nenhuma reserva nova é criada, a disponibilidade não é reduzida novamente e não há novo e-mail. |
| Sem disponibilidade          | Tentar reservar datas sem unidades ou simultaneamente até esgotar a última unidade. | A requisição é rejeitada com mensagem segura; não existe reserva confirmada em excesso.         |
| Hotel despublicado           | Despublicar o hotel antes de iniciar a reserva ou antes da confirmação.             | O fluxo público não cria/confirma reserva para o hotel.                                         |
| Quarto inativo               | Inativar o quarto antes de iniciar a reserva ou antes da confirmação.               | O fluxo público não cria/confirma reserva para o quarto.                                        |

### Login

- Login aceita credenciais válidas.
- Login rejeita credenciais inválidas com mensagem segura.
- Admins são direcionados ao 2FA quando necessário.
- Usuário comum não acessa `/admin`.

### Cadastro

- Cadastro valida nome, e-mail, senha e confirmação.
- Mensagens de erro são claras.
- Conta criada consegue fazer login.

### 2FA

- Para administradores com `emailTwoFactorEnabled=true`, o código de 6 dígitos chega por e-mail.
- Código inválido ou expirado é rejeitado.
- Reenvio respeita cooldown.
- Acesso admin só é liberado após verificação quando o 2FA por e-mail está habilitado.
- Administradores com `emailTwoFactorEnabled=false` entram com e-mail e senha, conforme configuração atual.

### Admin

- Dashboard abre para super admin.
- Dashboard do hotel admin mostra apenas o escopo permitido.
- Cards, métricas e alertas carregam sem telas vazias indevidas.
- Botão `Sair` encerra a sessão.

### Permissões super_admin

- Enxerga todos os hotéis cadastrados.
- Acessa administradores, auditoria, financeiro, reservas e segurança.
- Consegue criar/editar vínculos administrativos permitidos.
- Não consegue desativar/remover o último `super_admin` ativo.

### Permissões hotel_admin

- Enxerga apenas hotéis vinculados.
- Não acessa reservas, logs ou dados financeiros de hotéis fora do escopo.
- Não cria `super_admin`.
- Não altera papel global próprio ou de outros usuários.
- Não manipula permissões fora dos hotéis vinculados.

### Edição de hotel

- Dados principais podem ser alterados.
- Localização, contato, descrições, comodidades, políticas e horários podem ser salvos.
- Upload de capa e galeria funciona.
- Alterações aparecem na página pública.

### Quartos

- Lista de quartos carrega.
- Criar quarto funciona com nome, descrição, upload de imagem, capacidade, camas, tamanho e comodidades.
- Editar quarto mantém dados já preenchidos.
- Ativar/desativar quarto reflete no site público.

### Pagamentos do hotel

- Configuração de pagamento do hotel carrega na edição do hotel.
- Mercado Pago pode ser selecionado e salvo com credencial de sandbox.
- Credenciais sensíveis salvas não aparecem novamente em texto aberto.
- Hotel sem pagamento habilitado não deve iniciar reserva pública.
- Alteração de pagamento registra auditoria.

### Reservas no admin

- `/admin/reservas` lista reservas com hotel, quarto, hóspede, datas, valor, status, pagamento, provedor e criação.
- Filtros por hotel, status da reserva, status do pagamento, período de check-in e busca por hóspede funcionam.
- Super admin enxerga reservas da rede.
- Hotel admin enxerga apenas reservas dos hotéis vinculados.
- Detalhe da reserva abre em modo somente leitura.
- A tela não permite confirmar pagamento manualmente.

### Tarifas

- Lista de tarifas por quarto carrega.
- Criar tarifa com período, preço, hóspedes e regras funciona.
- Editar, ativar e desativar tarifa funciona.
- Preço público reflete tarifas ativas.

### Disponibilidade

- Seleção de quarto funciona.
- Cadastro por período respeita limite de datas.
- Unidades totais e disponíveis são validadas.
- Fechamento de período e observação interna são salvos.
- Consulta pública reflete disponibilidade configurada.

### Auditoria

- Logs aparecem para alterações administrativas.
- Filtros por hotel, usuário, ação, período e busca funcionam.
- Detalhe do log abre.
- Dados sensíveis não aparecem nos logs.

### Uploads

- Upload de capa funciona com imagem JPG, PNG ou WEBP válida.
- Upload de galeria funciona com imagens válidas.
- Upload de imagem de quarto funciona.
- Arquivo acima do limite configurado é rejeitado com mensagem segura.
- Arquivo não imagem é rejeitado.
- Imagens enviadas continuam acessíveis após reload da página.
- Em Railway, confirmar persistência após redeploy/restart somente se houver Volume.

### Responsividade

- Home funciona em mobile, tablet e desktop.
- Página de hotel não apresenta rolagem horizontal indevida.
- Página `/hoteis/[slug]/reservar` funciona no mobile sem overlay, sem corte de conteúdo e sem scroll horizontal.
- Formulários admin permanecem utilizáveis em mobile.
- Botões e campos têm área de toque confortável.

## Bloqueadores de produção

- Upload local em `public/uploads` só é seguro em produção se houver disco persistente; recomendação: migrar para storage externo antes do uso definitivo.
- Não há rotina automática para expirar/liberar reservas abandonadas em `awaiting_payment`.
- Não há remarcação ou cancelamento manual de reservas no admin.
- Não há estorno automático integrado.
- Convite por e-mail para administradores ainda não existe.
- `npm audit` ainda precisa ser revisado antes da produção.
- Stripe permanece apenas como webhook legado; não validar como checkout público novo.

## Como reportar bugs

Ao encontrar um problema, envie:

- URL da página.
- Perfil usado no teste.
- Passos para reproduzir.
- Resultado esperado.
- Resultado obtido.
- Print ou vídeo curto, se possível.
- Data e horário aproximado do teste.

## Orientações de segurança

- Não use senhas pessoais.
- Não cadastre dados reais de hóspedes, cartões ou documentos.
- Não compartilhe credenciais fora do grupo de testes.
- Não publique prints com e-mails, telefones ou documentos.
- O ambiente de homologação pode ser reiniciado ou receber novos seeds.
- Credenciais de homologação devem ser removidas ou trocadas antes de produção.

## Roteiro curto para o cliente

1. Acesse a URL de homologação.
2. Navegue pela home e abra a página de um hotel.
3. Teste o fluxo de reserva até o checkout Mercado Pago sandbox, usando dados fictícios.
4. Entre no painel com a conta indicada para seu perfil.
5. Edite informações simples de hotel, quartos, tarifas e disponibilidade.
6. Confira se as alterações aparecem no site público.
7. Registre qualquer problema seguindo o modelo de reporte acima.

## O que não validar nesta rodada

- Pagamentos reais de produção.
- Repasses financeiros reais.
- Convite por e-mail para administradores.
- Remarcação ou cancelamento manual de reservas no admin.
- Calendário visual avançado de disponibilidade.
- Stripe como checkout público novo.
