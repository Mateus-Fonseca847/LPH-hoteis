# Auditoria técnica inicial de produção - LPH Hotéis

Data da auditoria: 29 de maio de 2026.

Escopo auditado: página inicial pública, quiz de perfil, cards de experiências, modal de hotéis recomendados, páginas públicas de hotéis, consulta de disponibilidade, reserva, pagamento, webhooks, admin, autenticação, 2FA, permissões, uploads e documentação.

## Funcionalidades prontas

- A página inicial pública carrega hotéis publicados via banco e não usa fallback local fora de desenvolvimento autorizado.
- Busca pública consulta apenas hotéis com `isPublished=true`.
- Página pública `/hoteis/[slug]` retorna 404 para hotel inexistente/despublicado.
- Página legada `/hoteis/[slug]/disponibilidade` redireciona para `/hoteis/[slug]/reservar`.
- Fluxo `/hoteis/[slug]/reservar` possui etapas de datas/viajantes, quarto, hóspede e pagamento.
- API `/api/reservas` valida payload, hotel publicado, quarto ativo, ocupação, tarifa e disponibilidade.
- Criação de reserva usa transação, retém disponibilidade e cria transação financeira pendente.
- Mercado Pago está integrado para iniciar checkout por preferência externa.
- Webhook Mercado Pago valida assinatura, consulta pagamento no provedor, confere reserva, valor e moeda.
- Confirmação de reserva paga é transacional e idempotente para pagamentos já marcados como pagos.
- Pagamento recusado/cancelado/estornado/chargeback fecha reserva não paga e libera disponibilidade.
- Webhook Stripe existe apenas como compatibilidade legada.
- Admin possui dashboard, hotéis, quartos, tarifas, disponibilidade, pagamentos do hotel, reservas, financeiro, auditoria, administradores e segurança.
- Permissões de hotel são aplicadas no backend para edição e leitura administrativa.
- Uploads validam tamanho, MIME, extensão e assinatura binária da imagem.
- Documentação principal cobre setup, staging, Railway, pagamentos, uploads e homologação.

## Funcionalidades parcialmente prontas

- Quiz de perfil e recomendações funcionam, mas dependem de heurística local e dados cadastrados; não é motor inteligente externo.
- Cards de experiências e modal de hotéis recomendados existem, mas a manutenção é concentrada em um componente grande.
- Admin de reservas é somente leitura; não há cancelamento, remarcação, confirmação manual ou reenvio de e-mail.
- Financeiro exibe pagamentos e comissão, mas não faz repasse bancário nem conciliação externa completa.
- 2FA por e-mail está implementado para login admin, mas o provisionamento inicial precisa garantir a flag correta.
- Upload local funciona, mas só é seguro em produção com volume persistente ou storage externo real.
- Stripe permanece legado; checkout público novo usa Mercado Pago.

## Bloqueadores antes de produção

1. **Reservas abandonadas retêm disponibilidade sem expiração automática.** `/api/reservas` decrementa `RoomAvailability.availableUnits` e deixa a reserva em `awaiting_payment`; não há job, cron ou rotina para expirar checkout abandonado. Isso pode bloquear quartos sem pagamento e pode ser abusado.

2. **Admins criados pelo seed podem ficar impedidos de acessar o painel.** O login bloqueia administradores com `emailTwoFactorEnabled=false`, mas o seed não define essa flag. Antes de produção/staging real, as contas administrativas iniciais precisam ser provisionadas com `emailTwoFactorEnabled=true` ou haverá bloqueio no primeiro acesso.

3. **Persistência de uploads não está garantida por código.** O provider atual grava em `public/uploads`. Em Railway ou ambiente efêmero, imagens somem em redeploy/restart se não houver Volume no caminho correto. O provider `external_url` é placeholder e bloqueia novos uploads.

4. **Operação pós-venda de reserva não está pronta.** Não há cancelamento/remarcação manual no admin, nem estorno automático. Para produção com hóspedes reais, isso precisa existir ou virar procedimento operacional externo formal.

5. **Confirmação depende totalmente do webhook.** Se o webhook Mercado Pago não chegar ou estiver mal configurado, o pagamento pode ocorrer sem a reserva virar `confirmed`. Não há rotina de reconciliação ativa.

## Riscos de pagamento/reserva

- Reserva pendente pode segurar inventário indefinidamente.
- Retorno de sucesso do Mercado Pago usa `reservation`, mas a página pública ainda só consulta `session_id` de Stripe para identificar reserva paga; o usuário tende a ver "Pagamento em processamento" mesmo após retorno.
- Pix/boleto/cartão são escolhidos no app, mas a implementação Mercado Pago atual inicia checkout externo por preferência; instruções inline de Pix/boleto no componente são caminho alternativo não usado pelo provider atual.
- E-mails de confirmação dependem do webhook aprovado e do Resend configurado.
- Sem conciliação, divergências entre Mercado Pago, banco e painel exigem correção manual.
- Hotel sem pagamento habilitado ou credencial válida não consegue iniciar reserva pública.

## Riscos de UX

- Fluxo de reserva é denso para mobile e precisa homologação visual em dispositivos reais.
- Mensagem pós-checkout Mercado Pago pode parecer inconclusiva.
- Modal de experiências depende de hotéis publicados próximos; sem dados suficientes, muitos cards viram destino sugerido/estado vazio.
- Admin tem tabelas largas em reservas/financeiro; risco de leitura ruim em telas pequenas.
- Não há estado claro de "pagamento abandonado expirado" para o hóspede.

## Riscos de deploy

- `DATABASE_URL`, `AUTH_SECRET`, `TWO_FACTOR_ENCRYPTION_KEY`, `PAYMENT_SECRETS_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`, Mercado Pago e Resend são obrigatórios conforme recurso usado.
- `npm run build` executa `prisma generate`; deploy também precisa `npm run prisma:migrate:deploy` antes do start.
- CI usa valores fake e não sobe PostgreSQL real; não substitui homologação com banco/serviços externos.
- `ALLOW_LOCAL_HOTEL_DATA_FALLBACK` deve ficar `false` em staging/produção.
- Upload local exige Volume persistente; storage externo ainda não está implementado.
- Seed deve ser usado só em homologação/desenvolvimento e revisado por causa do 2FA inicial.

## Checklist técnico para publicar

- [ ] Aplicar migrations em banco limpo de staging com `npm run prisma:migrate:deploy`.
- [ ] Provisionar pelo menos um `super_admin` ativo com `emailTwoFactorEnabled=true`.
- [ ] Validar envio de e-mail 2FA e confirmação de reserva via Resend.
- [ ] Configurar Mercado Pago sandbox com webhook público assinado.
- [ ] Testar checkout aprovado, recusado, cancelado, duplicado e valor divergente.
- [ ] Implementar ou definir rotina operacional para expirar reservas `awaiting_payment`.
- [ ] Configurar Volume persistente ou implementar storage externo antes de usar uploads em produção.
- [ ] Validar hotel publicado com quarto ativo, tarifa ativa, disponibilidade futura e pagamento habilitado.
- [ ] Testar permissões de `super_admin` e `hotel_admin` fora do escopo.
- [ ] Homologar mobile da página inicial, hotel, reserva e principais telas admin.
- [ ] Revisar dependências com `npm audit` antes do go-live.
- [ ] Rodar `npm run format`, `npm run lint`, `npm run prisma:validate`, `npm run build` e `npm run quality`.
