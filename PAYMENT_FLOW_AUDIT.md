# Auditoria do fluxo de reserva, disponibilidade, pagamento e webhooks

Data da auditoria: 2026-05-30

Escopo: criação de reserva, consulta de disponibilidade, seleção de quarto, cálculo de preço, pagamento Mercado Pago, webhook Mercado Pago, webhook Stripe legado, confirmação, cancelamento/falha e retenção/liberação de disponibilidade.

Esta auditoria é documental. Nenhuma regra de negócio, schema Prisma ou migration foi alterado.

## Arquivos principais

- Página pública de reserva: `src/app/hoteis/[slug]/reservar/page.tsx`
- Fluxo visual de reserva: `src/components/BookingFlow.tsx`
- Página pública do hotel e retorno de checkout: `src/app/hoteis/[slug]/page.tsx`
- Criação pública de reserva: `src/app/api/reservas/route.ts`
- Consulta, noites, capacidade, preço e disponibilidade: `src/lib/stay-query.ts`
- Ordenação/resultado de quartos disponíveis: `src/lib/availability-results.ts`
- Configuração e início de pagamento: `src/lib/payments/index.ts`
- Mercado Pago: `src/lib/payments/mercado-pago.ts`
- Webhook Mercado Pago: `src/app/api/mercado-pago/webhook/route.ts`
- Webhook Stripe legado: `src/app/api/stripe/webhook/route.ts`
- Confirmação/cancelamento transacional: `src/lib/reservation-confirmation.ts`
- Transações financeiras: `src/lib/finance/payment-transactions.ts`
- Models envolvidos: `Reservation`, `PaymentTransaction`, `RoomAvailability`, `HotelPaymentSettings`, `HotelRoom`, `Hotel`

## Fluxo atual

1. O usuário acessa `/hoteis/[slug]/reservar`.
2. A página carrega apenas hotel publicado. Hotel inexistente ou despublicado retorna 404.
3. Os quartos enviados ao `BookingFlow` incluem disponibilidade, tarifas ativas e dados de capacidade.
4. O usuário escolhe datas, viajantes e quarto.
5. `BookingFlow` calcula disponibilidade/valor estimado no cliente com `getCompatibleRoomAvailabilityResults`.
6. Ao enviar dados do hóspede e método de pagamento, o frontend chama `POST /api/reservas`.
7. A API valida payload, check-in, check-out, hotel publicado, quarto ativo, capacidade, disponibilidade, tarifa e configuração de pagamento.
8. Em transação Prisma, a API decrementa `RoomAvailability.availableUnits` para cada noite e cria:
   - `Reservation` com `status=awaiting_payment`, `paymentStatus=pending`, `availabilityHeld=true`;
   - `PaymentTransaction` com `status=pending`.
9. Após criar a reserva, a API chama `startReservationPayment`.
10. `startReservationPayment` cria preferência Mercado Pago e atualiza reserva/transação para `awaiting_payment`, salvando `providerPaymentId` inicial.
11. O usuário é redirecionado para o checkout Mercado Pago.
12. O webhook Mercado Pago recebe evento, valida assinatura, busca o pagamento no provedor, valida vínculo, valor e moeda.
13. Pagamento aprovado chama `confirmPaidReservation`.
14. Pagamento recusado, cancelado, estornado ou chargeback chama `closeUnpaidReservation`.
15. Stripe continua disponível somente como webhook legado.

## Estados possíveis

### Reservation.status

- `pending`: existe no enum, mas a criação pública atual já cria como `awaiting_payment`.
- `awaiting_payment`: reserva criada, disponibilidade retida e aguardando pagamento.
- `confirmed`: pagamento aprovado e reserva confirmada.
- `paid`: existe no enum, mas o fluxo atual de confirmação usa `confirmed`; aparece como estado possível legado/inconsistente.
- `payment_failed`: pagamento recusado/falhou e disponibilidade deve ser liberada.
- `cancelled`: pagamento cancelado/estornado/chargeback ou checkout expirado e disponibilidade deve ser liberada.

### Reservation.paymentStatus e PaymentTransaction.status

- `pending`: registro inicial antes de iniciar checkout.
- `awaiting_payment`: checkout externo iniciado.
- `paid`: pagamento aprovado confirmado por webhook.
- `payment_failed`: pagamento recusado/falhou.
- `cancelled`: pagamento cancelado/estornado/chargeback ou checkout expirado.

### Reservation.availabilityHeld

- `false`: sem retenção ativa.
- `true`: disponibilidade já decrementada e associada à reserva.

## Transições atuais

| Origem                     | Evento                                          | Destino                                                                            |
| -------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| sem reserva                | `POST /api/reservas` válido                     | `Reservation.awaiting_payment` + `paymentStatus.pending` + `availabilityHeld=true` |
| `awaiting_payment/pending` | preferência Mercado Pago criada                 | `status.awaiting_payment` + `paymentStatus.awaiting_payment`                       |
| `awaiting_payment`         | webhook Mercado Pago aprovado                   | `status.confirmed` + `paymentStatus.paid` + `PaymentTransaction.paid`              |
| `awaiting_payment`         | webhook recusado                                | `status.payment_failed` + `paymentStatus.payment_failed` + libera disponibilidade  |
| `awaiting_payment`         | webhook cancelado/refund/chargeback             | `status.cancelled` + `paymentStatus.cancelled` + libera disponibilidade            |
| `awaiting_payment`         | Stripe `checkout.session.completed` legado pago | `status.confirmed` + `paymentStatus.paid`                                          |
| `awaiting_payment`         | Stripe `checkout.session.expired` legado        | `status.cancelled` + libera disponibilidade                                        |
| `awaiting_payment`         | Stripe `payment_intent.payment_failed` legado   | `status.payment_failed` + libera disponibilidade                                   |

## Pontos de falha

1. **Falha ao iniciar Mercado Pago após reserva criada.**
   - A reserva e a retenção são criadas antes da chamada externa.
   - Em caso de erro, a API tenta chamar `closeUnpaidReservation`.
   - Se essa compensação falhar, a reserva fica órfã em `awaiting_payment` e mantém disponibilidade retida.

2. **Webhook Mercado Pago indisponível ou mal configurado.**
   - A cobrança pode ser paga no provedor, mas a reserva não muda para `confirmed`.
   - Não há rotina de reconciliação automática para buscar pagamentos pendentes no provedor.

3. **Reservas abandonadas.**
   - Não há expiração automática de reservas `awaiting_payment`.
   - A disponibilidade pode ficar bloqueada indefinidamente.

4. **E-mail não é parte da transação.**
   - A confirmação da reserva é transacional.
   - O envio de e-mail ocorre depois e pode falhar sem reverter reserva/pagamento.
   - Não há fila/retry persistente de e-mails.

5. **Retorno visual do checkout tem lógica legada.**
   - Mercado Pago retorna `?checkout=success&reservation=...`.
   - A página do hotel ainda procura `session_id` de Stripe para localizar reserva.
   - Mesmo com pagamento aprovado, o usuário tende a ver mensagem de processamento.
   - Além disso, a página compara `Reservation.status` com `paid`, mas o fluxo atual confirma como `confirmed`.

6. **Estado `paid` em `ReservationStatus` parece legado/inutilizado.**
   - Confirmação atual usa `confirmed`.
   - O enum mantém `paid`, criando possibilidade de estado morto ou confuso.

## Riscos de duplicação

1. **Webhook duplicado aprovado.**
   - Mitigado parcialmente: `confirmPaidReservation` usa `paymentStatus != paid` e retorna `confirmed=false` quando já pago.
   - `PaymentTransaction` é `upsert` por `reservationId`.
   - Risco residual: e-mail só é enviado quando `confirmed=true`, então duplicação de e-mail aprovado está mitigada.

2. **Webhook aprovado com providerPaymentId diferente.**
   - O webhook valida valor, moeda e vínculo por `external_reference`.
   - Se já pago e `providerPaymentId` divergir, há `ConflictError`.
   - Antes de pago, o `providerPaymentId` inicial pode ser o ID da preferência Mercado Pago e depois virar o ID real do pagamento. Isso é funcional, mas mistura dois tipos de identificador no mesmo campo.

3. **Múltiplas reservas para o mesmo hóspede/datas/quarto.**
   - Não há idempotency key no `POST /api/reservas`.
   - Clique duplo, retry do navegador ou automação pode criar mais de uma reserva pendente se ainda houver disponibilidade.
   - Cada reserva decrementa disponibilidade, então o risco é bloqueio/overselling operacional por reservas duplicadas do mesmo usuário.

4. **Webhook Stripe legado e Mercado Pago no mesmo banco.**
   - Stripe opera por `stripeCheckoutSessionId`/`stripePaymentIntentId`.
   - Mercado Pago opera por `providerPaymentId`.
   - A convivência é compatível, mas aumenta superfície de eventos legados confirmarem reservas antigas.

## Idempotencia de webhooks

- Helper reutilizavel: `src/lib/payments/webhook-idempotency.ts`.
- Mercado Pago valida assinatura, busca o pagamento no provedor, usa `external_reference` como `reservationId` e usa `providerPaymentId` como identificador do evento financeiro.
- Stripe legado usa `metadata.reservationId`/`client_reference_id`, `stripeCheckoutSessionId` e `stripePaymentIntentId`.
- Webhook ja processado retorna sucesso sem chamar confirmacao, fechamento, baixa de disponibilidade, envio de e-mail ou auditoria.
- Pagamento ja `paid` nao chama `confirmPaidReservation` novamente.
- Falha/cancelamento ja finalizado nao chama `closeUnpaidReservation` novamente.
- Identificador divergente em reserva ja finalizada gera conflito em vez de sobrescrever o vinculo anterior.

## Riscos de concorrência

1. **Criação concorrente de reservas.**
   - A API usa `updateMany` com `availableUnits > 0` e exige `count === nights`.
   - Isso reduz o risco de overbooking por concorrência.
   - Risco residual: se uma das noites falha, a transação inteira reverte, o que é correto.

2. **Webhook aprovado e webhook cancelado quase simultâneos.**
   - `closeUnpaidReservation` não altera reserva se `paymentStatus=paid` ou transação já está `paid`.
   - `confirmPaidReservation` só confirma se status ainda estiver `pending/awaiting_payment`.
   - A ordem do primeiro evento processado vence. Se o provedor emitir status temporariamente rejeitado/cancelado antes de aprovado, o aprovado posterior pode não confirmar porque a reserva já saiu de `awaiting_payment`.

3. **Confirmação quando disponibilidade já foi liberada.**
   - Se `availabilityHeld=false`, `confirmPaidReservation` tenta decrementar disponibilidade novamente.
   - Isso permite confirmar pagamento aprovado tardio desde que ainda exista disponibilidade.
   - Se não existir disponibilidade, lança conflito e a reserva paga pode ficar sem confirmação operacional.

4. **Liberação de disponibilidade.**
   - `closeUnpaidReservation` e `releaseReservationAvailability` usam `availabilityHeld=true` como trava.
   - Isso reduz risco de incremento duplicado em webhook repetido.

## Riscos de disponibilidade

1. **Retenção sem TTL.**
   - Maior risco atual. Reservas pendentes bloqueiam `availableUnits` sem expiração.

2. **Admin pode alterar disponibilidade manualmente enquanto há reservas pendentes.**
   - O sistema revalida disponibilidade na confirmação quando `availabilityHeld=false`.
   - Quando `availabilityHeld=true`, a unidade já foi retida; alterações manuais podem deixar contagem operacional difícil de reconciliar.

3. **Disponibilidade é contagem diária, não inventário por unidade física.**
   - Não há identificação de quarto/unidade específica.
   - Isso é aceitável para inventário agregado, mas exige rotina clara para disponibilidade manual.

4. **Fallback de preço.**
   - Se não houver `priceEstimate`, a API usa `room.priceFrom` como fallback.
   - A disponibilidade precisa estar `available`, mas tarifa compatível ausente pode gerar preço por fallback, o que pode ser indesejado comercialmente.

## Mercado Pago

Pontos positivos:

- Checkout público atual usa Mercado Pago.
- Webhook valida assinatura (`x-signature`, `x-request-id`) quando segredo está configurado.
- Webhook consulta o pagamento no Mercado Pago antes de confirmar.
- Valida `external_reference` contra reserva.
- Valida valor e moeda contra `Reservation` e `PaymentTransaction`.
- Pagamento aprovado é idempotente.
- Pagamento recusado/cancelado libera disponibilidade se ainda não pago.

Riscos:

- `providerPaymentId` começa como ID da preferência e depois vira ID do pagamento. O campo suporta o fluxo, mas o significado muda.
- Se o webhook falhar permanentemente, não existe reconciliação.
- Se o evento de falha/cancelamento chegar antes de um aprovado real posterior, o aprovado posterior pode não confirmar por causa da transição para `payment_failed/cancelled`.

## Stripe legado

Status atual:

- `src/app/api/stripe/webhook/route.ts` permanece ativo.
- Usa assinatura Stripe.
- Trata `checkout.session.completed`, `checkout.session.expired` e `payment_intent.payment_failed`.
- Confirma ou fecha reservas pelo mesmo `reservation-confirmation.ts`.

Riscos:

- Não parece haver criação pública atual de checkout Stripe.
- Mantém dependência de `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` se o endpoint for usado.
- A página pública do hotel ainda contém lógica de retorno por `session_id`, sinal de resíduo legado.
- Deve permanecer documentado como legado até confirmar ausência total de reservas antigas dependentes dele.

## Código morto ou legado provável

- `ReservationStatus.paid`: enum existe, mas confirmação atual usa `confirmed`.
- `stripeCheckoutSessionId` e `stripePaymentIntentId`: campos legados ainda usados apenas pelo webhook Stripe.
- `src/lib/stripe.ts` e `/api/stripe/webhook`: legado, não checkout público novo.
- Lógica de retorno `session_id` na página do hotel: legado Stripe.
- `upsertInitialPaymentTransactionForReservation`: não apareceu no fluxo principal auditado; possível helper legado/não usado.
- `PaymentProvider.manual`: existe para configuração/compatibilidade, mas checkout público exige provedor real configurado.

## Reservas órfãs

Cenários possíveis:

- Reserva criada e disponibilidade retida, mas `startReservationPayment` falha e `closeUnpaidReservation` também falha.
- Reserva `awaiting_payment` cujo checkout foi abandonado pelo hóspede.
- Reserva paga no Mercado Pago cujo webhook não chegou ou falhou sempre.
- Reserva com `PaymentTransaction.pending/awaiting_payment` e `Reservation.paymentStatus` divergente por falha parcial antiga.

Não há rotina automática de limpeza, expiração ou reconciliação.

## Estados impossíveis ou inconsistentes a monitorar

- `Reservation.status=confirmed` com `paymentStatus!=paid`.
- `Reservation.paymentStatus=paid` com `status` diferente de `confirmed` ou `paid`.
- `PaymentTransaction.status=paid` com `Reservation.paymentStatus!=paid`.
- `availabilityHeld=false` em reserva `awaiting_payment`.
- `availabilityHeld=true` em reserva `payment_failed` ou `cancelled`.
- `providerPaymentId` nulo em reserva/transação `awaiting_payment` Mercado Pago após checkout iniciado.
- `providerPaymentId` contendo ID de preferência Mercado Pago em uma reserva já paga, quando deveria conter ID real do pagamento.
- `Reservation.status=paid`, caso apareça em dados novos.

## Recomendações antes de produção

1. Implementar rotina de expiração para reservas `awaiting_payment`.
2. Implementar reconciliação periódica com Mercado Pago para reservas pendentes.
3. Ajustar retorno visual de checkout para usar `reservation` e status `confirmed/paid`, não apenas `session_id`.
4. Separar semanticamente ID da preferência Mercado Pago e ID do pagamento, ou documentar explicitamente a troca de significado de `providerPaymentId`.
5. Adicionar idempotency key no `POST /api/reservas` para evitar reservas duplicadas por retry/clique duplo.
6. Criar painel/rotina operacional para reservas órfãs e pendentes antigas.
7. Manter Stripe como legado até confirmar que não existem reservas antigas dependentes.
8. Criar consultas administrativas para detectar estados inconsistentes listados acima.

## Conclusão

O fluxo principal impede confirmação antes de pagamento aprovado e usa transações para reservar/liberar disponibilidade. Os maiores riscos antes de produção não são de confirmação indevida imediata, mas de operação: reservas pendentes sem expiração, reconciliação ausente quando webhook falha, retorno visual legado do checkout e possíveis duplicações de reservas por falta de idempotência na criação pública.
