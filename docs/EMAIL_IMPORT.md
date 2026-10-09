# Receber documentos pelo Gmail

O Vetor possui uma caixa de revisão em `/mail`. Ela recebe mensagens e anexos de uma conta Gmail ou Google Workspace por empresa, usando IMAP com TLS em `imap.gmail.com:993`.

A sincronização salva mensagens e documentos para conferência. A criação de cobrança, conta a pagar e lançamento contábil acontece somente quando uma pessoa confirma a importação. O título, como um boleto, é cadastrado pelo vínculo **Vincular título** após essa confirmação.

## 1. Preparar a conta Google

Esta integração usa uma **senha de app do Google**, com 16 caracteres. A senha normal da conta não atende a essa configuração. O fluxo OAuth com botão “Fazer login com o Google” não está implementado.

1. Entre na conta que recebe os documentos.
2. Ative a verificação em duas etapas nas configurações de segurança da Conta Google.
3. Abra [Senhas de app](https://myaccount.google.com/apppasswords), crie uma senha para o Vetor e copie o valor exibido para o campo de configuração do sistema.
4. Se a opção não aparecer, verifique as políticas da organização, o uso exclusivo de chaves de segurança e a Proteção Avançada. Essas condições podem impedir a criação da senha. A alteração da senha principal da conta também revoga as senhas de app existentes. [Orientações oficiais do Google](https://support.google.com/mail/answer/185833?hl=pt-BR).

No Gmail pessoal, o acesso IMAP fica sempre habilitado desde janeiro de 2025; não é necessário procurar o antigo botão de ativação. [Gmail em outros clientes](https://support.google.com/mail/answer/7126229?hl=pt-BR).

No Google Workspace, o administrador deve conferir **Apps → Google Workspace → Gmail → Acesso do usuário final → Acesso POP e IMAP** para a unidade organizacional da conta. A política precisa permitir IMAP e o método de autenticação utilizado. Organizações que permitem somente clientes OAuth não são compatíveis com esta implementação por senha de app. A disponibilidade deve ser confirmada pelo administrador; não reduza a política da organização apenas para habilitar a integração. [Configuração administrativa de IMAP](https://knowledge.workspace.google.com/admin/sync/turn-pop-and-imap-on-or-off-for-users), [clientes e senhas de app no Workspace](https://knowledge.workspace.google.com/admin/sync/set-up-gmail-with-a-third-party-email-client).

## 2. Configurar no Vetor

Entre como administrador e abra **Configurações → Integrações → Conexão de e-mail**, em `/settings/email`.

| Campo | Como preencher |
| --- | --- |
| Endereço do Gmail | Endereço completo da caixa que recebe os documentos |
| Senha de app do Google | Valor gerado na Conta Google; os espaços de agrupamento são removidos |
| Pasta de e-mail | `INBOX` para a caixa de entrada ou o nome exato da pasta/marcador disponível por IMAP |
| Importar mensagens desde | Data inicial para pesquisar mensagens nessa pasta |
| Conexão ativa | Permite a sincronização manual e automática |
| Receber documentos automaticamente | Inclui essa empresa nas execuções do agendador |

Salve e abra **Caixa de revisão → Sincronizar Gmail**. Salvar a configuração não verifica a conexão; a primeira sincronização valida autenticação, pasta e acesso. Se houver mais mensagens, repita a sincronização para continuar do ponto salvo.

Ao editar a mesma conta, deixe a senha em branco para manter a existente. Ao trocar de conta, informe outra senha de app. A senha digitada é limpa ao enviar o formulário ou sair da aba e não entra no rascunho local. A resposta da API informa apenas se existe senha salva.

Alterar conta, pasta ou data inicial reinicia a pesquisa a partir da data configurada. Mensagens já importadas permanecem disponíveis. A identificação pela empresa, caixa, UIDVALIDITY e UID evita duplicar o mesmo registro durante a continuidade da sincronização. Mover ou copiar uma mensagem no Gmail pode atribuir outro UID; confira os documentos antes de confirmar uma cobrança repetida.

## 3. Revisar XML, NFS-e e boleto

1. Em `/mail`, filtre por assunto, remetente ou mensagens com anexos para revisar.
2. Abra **Revisar documentos**. O sistema apresenta remetente, assunto, data, texto e anexos recebidos.
3. Selecione os arquivos da mesma cobrança: por exemplo, **XML + NFS-e em PDF + boleto em PDF**. São permitidos até três arquivos, com até **2 MiB no total**, e no máximo um XML.
4. Use **Ler XML selecionado** e confira os dados encontrados. **Aplicar dados do XML** preenche número, tipo, emissão e valor quando reconhecidos. Complete manualmente os campos ausentes, especialmente vencimento.
5. Escolha a locação. A obra e a locadora vêm desse registro. Se o texto citar uma referência única, como `Locação LOC-2026-001`, o sistema pode sugerir um vínculo, que precisa ser aplicado e conferido.
6. Confira anexos, obra, locadora e valores; marque a confirmação e clique em **Importar cobrança e gerar conta**.
7. Use os links para abrir a locação, a conta a pagar ou **Vincular título**. No cadastro do título, complete os dados do boleto recebido.

**PDFs são anexados sem OCR ou leitura automática de código de barras.** A linha digitável, vencimento e demais dados do boleto precisam ser conferidos e preenchidos. Não há emissão bancária nem pagamento automático. XMLs desconhecidos podem exigir preenchimento manual; arquivos inválidos são ignorados com aviso. Se a mensagem contiver cobranças distintas, revise cada conjunto de anexos separadamente.

Administradores, contadores e usuários do financeiro podem sincronizar e revisar mensagens. Somente administradores podem alterar a conexão. Os vínculos e downloads ficam restritos à empresa autenticada.

## 4. Ativar a sincronização automática na Vercel

Primeiro, aplique as migrations no banco do ambiente e publique a versão que contém o módulo:

```powershell
npx prisma migrate deploy
npm run build
```

A migration `20261002160000_mail_inbox` cria as estruturas de conexão, mensagens e anexos. O build da Vercel não aplica migrations. Consulte também [o guia de deploy](../DEPLOY.md).

1. Em **Vercel → Project → Settings → Environment Variables**, configure `CRON_SECRET` em Production com um segredo aleatório de pelo menos **32 caracteres**. Ele é independente de `JWT_SECRET`, `DATA_ENCRYPTION_KEY` e da senha de app do Gmail.
2. Mantenha o mesmo `DATA_ENCRYPTION_KEY` do banco existente. Configure as demais variáveis descritas no guia de deploy.
3. Confirme que **Fluid compute** está habilitado. A rota agendada usa runtime Node.js e `maxDuration = 300`; o plano Hobby permite essa duração com Fluid compute. [Limites das Vercel Functions](https://vercel.com/docs/functions/limitations).
4. Faça o deploy de produção pelo Git. O `vercel.json` já agenda `GET /api/cron/mail-sync` diariamente às **09:00 UTC**, equivalente a **06:00 em São Paulo (UTC−03)**. O cron da Vercel usa UTC e só é ativado em deployments de produção. [Funcionamento do cron](https://vercel.com/docs/cron-jobs), [publicação do agendamento](https://vercel.com/docs/cron-jobs/quickstart).
5. Confira **Settings → Cron Jobs** e os logs das execuções. A Vercel envia `Authorization: Bearer <CRON_SECRET>` automaticamente; a rota valida esse segredo antes de acessar as caixas. [Proteção e gerenciamento do cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
6. No Vetor, marque **Conexão ativa** e **Receber documentos automaticamente** para cada empresa desejada.

No Hobby, cron jobs podem executar somente uma vez por dia e podem iniciar em qualquer minuto da hora configurada. Neste projeto, isso significa aproximadamente entre 06:00 e 06:59 em São Paulo. Para intervalos menores, use um plano compatível ou um agendador externo autorizado. [Frequência e precisão por plano](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Cada execução seleciona até **cinco empresas**, priorizando as que nunca foram consultadas ou cuja tentativa é mais antiga. Processa um lote de até **20 mensagens por empresa**, sem paralelizar as conexões. Há limite de 25 segundos para a leitura IMAP de cada lote, orçamento global de 220 segundos e reserva de tempo para gravar os dados. Com mais de cinco empresas, elas se alternam entre execuções; nem toda empresa será necessariamente atendida todos os dias. O retorno informa `completed`, `failed`, `imported`, `skipped`, `hasMore` e `deferred`.

Para uma caixa movimentada, o agendamento diário pode deixar mensagens pendentes. A sincronização manual continua disponível. Um agendador externo deve chamar a mesma rota HTTPS com o cabeçalho de autorização, guardar o segredo no próprio cofre de credenciais e respeitar os limites da hospedagem. O endpoint não instala um serviço permanente nem mantém IMAP IDLE aberto; o agendamento não roda automaticamente em `npm run dev`.

## 5. Limites e tratamento dos dados

| Etapa | Limite |
| --- | --- |
| Leitura de mensagens | Até 20 por lote e 25 segundos de conexão |
| Anexos por mensagem recebida | Primeiros 10 anexos XML/PDF, até 2 MiB por arquivo e 10 MiB no total |
| Texto da mensagem | Prévia de até 16 KiB, apenas texto simples |
| Arquivos por cobrança confirmada | Até 3, somando 2 MiB; no máximo um XML |

A caixa é aberta somente para leitura. A integração não envia mensagens, não exclui e-mails nem altera o estado de leitura no Gmail. HTML, imagens remotas e anexos de formatos diferentes de XML/PDF não são exibidos. O transporte usa conexão TLS e downloads limitados por bytes reais.

A senha de app, o texto e os arquivos são criptografados no banco com AES-256-GCM. Assunto, remetente, datas e metadados ficam disponíveis para listagem e busca. Preserve `DATA_ENCRYPTION_KEY` nos backups e deploys; sua perda impede recuperar o conteúdo criptografado.

O cursor só é gravado com o lote persistido. Em caso de timeout durante uma mensagem, ela fica para a próxima tentativa; mensagens concluídas podem ser salvas. Falhas de rede rejeitam o lote para nova tentativa. A mudança de UIDVALIDITY faz a pesquisa reiniciar com a data configurada. A sincronização possui bloqueio por empresa para impedir execuções concorrentes da mesma caixa.

## 6. Resolver problemas

| Situação | Ação |
| --- | --- |
| Configuração salva, mas nenhuma mensagem foi recebida | Execute **Sincronizar Gmail**; confira pasta, data inicial e eventual erro de autenticação |
| Senha de app indisponível | Confira a verificação em duas etapas e as políticas do Workspace; contas que exigem OAuth não são atendidas por esta versão |
| Autenticação parou após trocar a senha Google | Gere outra senha de app e atualize a conexão |
| Mensagens continuam pendentes | Repita a sincronização manual ou ajuste a frequência no servidor |
| Anexo foi ignorado | Consulte o aviso de formato, tamanho ou XML inválido; a mensagem original permanece no Gmail |
| Cron retorna 503 | Configure `CRON_SECRET` com pelo menos 32 caracteres no ambiente correto |
| Cron retorna 401 | Confira o cabeçalho Bearer e se o segredo é o mesmo do servidor |
| Configuração de criptografia inválida | Restaure a chave correta do ambiente; não substitua a chave de um banco existente por outra aleatória |

A conexão real só pode ser confirmada depois que a conta e uma senha de app válida forem configuradas e a primeira sincronização terminar com sucesso. O código e seus testes simulados não comprovam, por si só, que o Google autorizou acesso à caixa da empresa.
