# Guia de homologação - LPH Hotéis

## Objetivo

Validar a plataforma LPH em ambiente de homologação antes da liberação para uso do cliente. O foco é testar a navegação pública, o fluxo de reserva, autenticação com 2FA e a operação administrativa básica.

## Ambiente

- URL da homologação: `[preencher URL da Railway]`
- Data da rodada de testes: `[preencher data]`
- Responsável pelo acompanhamento: `[preencher nome]`

## Credenciais de homologação

Não registre senhas neste arquivo. As senhas devem ser compartilhadas por canal seguro e trocadas após a homologação.

| Perfil         | E-mail                                | Senha                   | Escopo esperado                             |
| -------------- | ------------------------------------- | ----------------------- | ------------------------------------------- |
| Super admin    | `[preencher e-mail do super admin]`   | Enviar por canal seguro | Acesso à rede e a todos os hotéis           |
| Admin de hotel | `[preencher e-mail do hotel admin]`   | Enviar por canal seguro | Acesso apenas ao hotel vinculado            |
| Usuário comum  | `[preencher e-mail do usuário comum]` | Enviar por canal seguro | Cadastro/login público, sem acesso ao admin |

## Fluxos por conta

### Super admin

1. Acessar `/login`.
2. Entrar com o e-mail do super admin.
3. Validar recebimento e verificação do código de 6 dígitos por e-mail.
4. Acessar o Painel administrativo.
5. Validar visão geral da rede, hotéis, administradores, auditoria e segurança.
6. Editar um hotel, revisar quartos, tarifas e disponibilidade.

### Admin de hotel

1. Acessar `/login`.
2. Entrar com o e-mail do admin de hotel.
3. Validar 2FA por e-mail.
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
- Botão `Consultar disponibilidade` abre o modal de reserva.

### Fluxo de reserva

- Modal ocupa a tela corretamente e bloqueia o scroll do fundo.
- Timeline exibe as etapas: Datas e viajantes, Escolha do quarto, Dados do hóspede, Pagamento e Confirmação.
- Datas, adultos e crianças são preservados ao voltar etapas.
- Etapa de quartos mostra apenas opções compatíveis ou informa indisponibilidade com clareza.
- Dados do hóspede validam nome, e-mail, telefone e CPF/passaporte.
- Etapa de pagamento permite escolher Pix, cartão de crédito, cartão de débito ou boleto.
- Botão `Ir para pagamento` só habilita após escolher forma de pagamento.
- O sistema não confirma reserva antes do pagamento aprovado pelo provedor.
- Mensagens de erro são compreensíveis.

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

- Código de 6 dígitos chega por e-mail.
- Código inválido ou expirado é rejeitado.
- Reenvio respeita cooldown.
- Acesso admin só é liberado após verificação.

### Admin

- Dashboard abre para super admin.
- Dashboard do hotel admin mostra apenas o escopo permitido.
- Cards, métricas e alertas carregam sem telas vazias indevidas.
- Botão `Sair` encerra a sessão.

### Edição de hotel

- Dados principais podem ser alterados.
- Localização, contato, descrições, comodidades, políticas e horários podem ser salvos.
- Upload de capa e galeria funciona.
- Alterações aparecem na página pública.

### Quartos

- Lista de quartos carrega.
- Criar quarto funciona com nome, descrição, imagem, capacidade, camas, tamanho e comodidades.
- Editar quarto mantém dados já preenchidos.
- Ativar/desativar quarto reflete no site público.

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
3. Teste o fluxo de reserva até a etapa de pagamento, usando dados fictícios.
4. Entre no painel com a conta indicada para seu perfil.
5. Edite informações simples de hotel, quartos, tarifas e disponibilidade.
6. Confira se as alterações aparecem no site público.
7. Registre qualquer problema seguindo o modelo de reporte acima.
