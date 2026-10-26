# Ambientes

## Manutenção de reservas

O workflow `.github/workflows/reservation-maintenance.yml` chama `POST /api/internal/reservas/expirar` a cada 10 minutos, uma vez por ambiente do GitHub (`production` e `staging`).

### Secrets por Environment

Cada Environment (`production` e `staging`) precisa ter os próprios secrets, com estes nomes:

- `APP_INTERNAL_BASE_URL`
- `INTERNAL_API_TOKEN`
- `HEARTBEAT_URL` (opcional; sem ele o batimento é ignorado com um aviso)

Nunca registre valores neste repositório.

### Regras

- Um Environment sem secret próprio herda o secret do repositório. Por isso os secrets `APP_INTERNAL_BASE_URL` e `INTERNAL_API_TOKEN` do repositório só devem ser removidos depois que o novo workflow estiver na `main`. Antes disso, o workflow antigo ainda os usa.
- O `schedule` só roda a versão do workflow da branch padrão (`main`). Alterações em outras branches não mudam o agendamento até serem promovidas para a `main`.
- Se o Environment `production` tiver revisores obrigatórios ou restrição de branches, a execução agendada pode ficar aguardando aprovação ou ser recusada.
