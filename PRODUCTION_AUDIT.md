# Auditoria final de produção - LPH Hotéis

Data da auditoria: 25 de maio de 2026.

Escopo revisado: rotas públicas, home e hotéis, consulta/reserva, APIs, administração, autenticação e 2FA, pagamentos, uploads, seed, variáveis de ambiente, CI e documentação.

## Pronto para produção

Itens implementados corretamente no código, condicionados à homologação dos serviços externos:

- A home, a busca, as recomendações e a página pública consultam apenas hotéis com `isPublished: true`.
- Hotéis inexistentes ou despublicados não acessam `/hoteis/[slug]` nem `/hoteis/[slug]/reservar`; as páginas retornam `404`.
- O fluxo público de disponibilidade/reserva existe em página dedicada e mantém datas, viajantes, quarto, hóspede, pagamento e retorno ao hotel.
- A criação de reserva valida payload com Zod, hotel publicado, quarto ativo, ocupação, tarifa e disponibilidade.
- Reservas novas são criadas como `awaiting_payment`/`pending`; não há confirmação direta no pedido público.
- Pagamento aprovado confirma a reserva apenas pelo webhook; falha/cancelamento libera disponibilidade e não confirma a reserva.
- Atualizações de reserva e disponibilidade usam transações Prisma; a transição de confirmação usada pelo webhook possui teste de idempotência para evento aprovado duplicado.
- O webhook Mercado Pago valida assinatura e consulta o status no provedor; Stripe permanece isolado como compatibilidade legada.
- Erros de API usam respostas controladas; falhas internas não expõem detalhes em produção.
- Administração possui escopo por hotel, bloqueio de recurso fora de escopo, auditoria nas escritas verificadas e proteção do último `super_admin` ativo.
- Uploads validam tamanho, MIME, extensão e assinatura binária da imagem.
- Existem testes Vitest para validações de reserva, preço/disponibilidade, autorização, 2FA isolado, upload e transições de pagamento.
- O workflow de CI executa instalação limpa, Prisma Client, `quality` e testes com variáveis falsas.

## Precisa corrigir antes de produção

### Bloqueadores

1. **Expiração de reservas aguardando pagamento.** `/api/reservas` retém unidades ao criar uma reserva `awaiting_payment`, mas não há rotina automática para expirar checkout abandonado e liberar o inventário. Além de indisponibilidade incorreta, a rota pública pode ser usada para bloquear quartos sem pagar. Implementar expiração/liberação automática e proteção contra abuso antes de liberar reserva pública.

2. **2FA administrativo não é obrigatório de fato.** O login libera administradores com `emailTwoFactorEnabled=false` apenas com senha; o seed cria administradores com a flag desativada. A interface afirma política obrigatória, mas a regra atual permite acesso sem segundo fator. Exigir ativação no primeiro acesso ou provisionar contas administrativas já protegidas antes da produção.

3. **Persistência de imagens no deploy.** `UPLOAD_STORAGE_PROVIDER=local` grava em `public/uploads`. Sem Railway Volume corretamente montado, imagens são perdidas em restart/redeploy. O provider externo é apenas um bloqueio seguro, não uma integração. Configurar e testar Volume antes da homologação com uploads ou implementar storage externo antes do uso produtivo.

### Pendências de liberação

- Configurar em staging/produção todas as variáveis obrigatórias: `DATABASE_URL`, `AUTH_SECRET`, `TWO_FACTOR_ENCRYPTION_KEY`, `PAYMENT_SECRETS_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`, credenciais/webhook Mercado Pago e credenciais Resend.
- Validar em sandbox Mercado Pago o ciclo completo: checkout, webhook assinado, aprovação, cancelamento/recusa, webhook duplicado, e-mails e disponibilidade.
- Aplicar e confirmar migrations em banco de staging limpo com `npm run prisma:migrate:deploy`; o CI atual não sobe PostgreSQL nem executa teste de integração real.
- Confirmar política de pagamentos de cada hotel publicado; um hotel sem configuração ativa não consegue iniciar reserva.

## Pode ficar para depois

- Migrar a camada de imagens de Volume local para S3, R2 ou Supabase Storage, caso o Volume seja adotado e validado no lançamento.
- Renomear o componente legado `HotelAvailabilityModalTrigger`, que agora funciona apenas como link para a página `/reservar`.
- Consolidar a marcação duplicada do modal de hotéis recomendados em `ExperienceSection` para reduzir manutenção, sem impacto funcional imediato.
- Adicionar cabeçalhos de endurecimento HTTP, como CSP, após inventário definitivo de imagens e integrações externas.
- Ampliar testes E2E de interface com navegador para fluxos públicos e administração.

## Riscos conhecidos

- O limitador de tentativas de login é mantido em memória do processo; em múltiplas instâncias ou reinícios, a proteção não é compartilhada.
- O cadastro público e a criação pública de reserva exigem proteção operacional contra automação/abuso antes de tráfego relevante.
- A confirmação depende da entrega do webhook Mercado Pago; indisponibilidade de rede ou configuração incorreta exige conciliação operacional.
- E-mails de confirmação e 2FA dependem do Resend; falhas de configuração impedem 2FA por e-mail e notificações.
- A rota Stripe é legada; deve permanecer com segredo válido somente se eventos antigos ainda precisarem ser recebidos.
- O seed publica hotéis e substitui quartos/tarifas/disponibilidade dos hotéis de demonstração; não deve ser executado indiscriminadamente em produção.
- A configuração atual de imagens remotas autoriza `images.unsplash.com`; revisar origem das imagens definitivas antes do lançamento.

## Checklist final de homologação

- [ ] Definir política de expiração de reservas pendentes e confirmar liberação automática da disponibilidade.
- [ ] Confirmar que nenhum administrador produtivo acessa o painel sem 2FA ativo.
- [ ] Configurar secrets somente no ambiente de deploy e revisar rotação/acesso.
- [ ] Subir PostgreSQL de staging, aplicar migrations e executar seed somente com contas de teste controladas.
- [ ] Validar home, busca, quiz, recomendações e ausência de hotéis despublicados.
- [ ] Validar página de hotel publicada, `404` para slug inválido/despublicado e página `/hoteis/[slug]/reservar`.
- [ ] Completar reserva sandbox: seleção, dados do hóspede, checkout, aprovação, recusa/cancelamento e webhook duplicado.
- [ ] Verificar que reserva pendente não aparece como confirmada/paga no admin.
- [ ] Verificar reservas, financeiro e auditoria com `super_admin` e com `hotel_admin` restrito ao próprio hotel.
- [ ] Testar login, 2FA, logout, usuário inativo e proteção do último `super_admin`.
- [ ] Configurar e validar envio Resend para código 2FA e confirmação de pagamento.
- [ ] Configurar Volume Railway ou storage externo; enviar imagem e validar persistência após redeploy/restart.
- [ ] Verificar responsividade e navegação por teclado nas telas públicas e administrativas críticas.
- [ ] Executar `npm ci`, `npm run prisma:generate`, `npm run prisma:migrate:deploy`, `npm run build`, `npm run test` e `npm run quality` no ambiente de staging.
- [ ] Monitorar logs de webhook, pagamento, e-mail, autenticação e upload após publicação.
