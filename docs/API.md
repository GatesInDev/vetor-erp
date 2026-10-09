# API HTTP e aplicativos mobile

A API pode ser consumida diretamente por aplicativos Android, iOS e outros clientes HTTP, sem carregar as telas do ERP. Os endpoints usam o mesmo domínio da aplicação: `https://seu-erp.vercel.app/api`. O frontend e a API continuam no mesmo deploy; não é necessário hospedar um segundo servidor.

O aplicativo nativo usa `Authorization: Bearer <accessToken>`. O site continua usando cookies `HttpOnly` e proteção de origem nas operações que alteram dados. Não envie cookies no cliente mobile. A API não habilita CORS irrestrito; um aplicativo nativo não depende de CORS. Uma SPA hospedada em outro domínio exige uma configuração específica de origens autorizadas.

## 1. Fazer login

`POST /api/auth/mobile/login`

Cabeçalho obrigatório: `Content-Type: application/json`. Não é necessário enviar `Origin`.

```json
{
  "email": "usuario@empresa.com.br",
  "password": "senha-do-usuario"
}
```

Resposta `200`:

```json
{
  "accessToken": "<jwt-assinado>",
  "refreshToken": "<token-opaco>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshExpiresAt": "2026-10-26T12:00:00.000Z",
  "user": {
    "id": "<uuid>",
    "companyId": "<uuid>",
    "email": "usuario@empresa.com.br",
    "role": "OPERATIONS"
  }
}
```

Os valores acima são ilustrativos. O access token dura 15 minutos. A sessão e o refresh token expiram 30 dias após o login; renovar o access token não estende esse prazo. As respostas de login e renovação têm `Cache-Control: no-store` e não definem cookies.

## 2. Consumir os dados

Exemplo para React Native ou outro cliente que implemente `fetch`:

```ts
const response = await fetch(`${baseUrl}/api/inventory/products`, {
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
});

if (!response.ok) throw new Error(`Request failed: ${response.status}`);
const { products } = await response.json();
```

A empresa é obtida da sessão autenticada no servidor. Não envie `companyId` para escolher outra empresa. A cada chamada, o servidor confirma a existência e validade da sessão, o usuário ativo, sua empresa e sua permissão atual. Revogar a sessão bloqueia inclusive access tokens cujo prazo ainda não venceu.

Quando houver um cabeçalho `Authorization`, ele tem prioridade absoluta. Um Bearer inválido ou um esquema diferente não pode ser compensado por um cookie válido. Mutações autenticadas por cookie continuam exigindo `Origin` correspondente ao host e protocolo da requisição.

### Escritas e tentativas repetidas

Nas operações abaixo indicadas como idempotentes, envie `X-Idempotency-Key`. Gere uma chave por operação lógica, com até 128 caracteres entre letras, números, `_` e `-`; um UUID é adequado. Reenvie a mesma chave **e o mesmo corpo** se a conexão cair ou o servidor responder que houve atualização concorrente. Uma nova intenção de cadastro precisa de outra chave.

```ts
const response = await fetch(`${baseUrl}/api/inventory/products`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": operationId,
  },
  body: JSON.stringify({
    sku: "FUEL-DIESEL",
    name: "Diesel",
    unit: "L",
    minimumQuantity: "100.000",
    active: true,
  }),
});
```

Esse exemplo cria um produto se executado com credenciais reais. Quantidades e valores monetários devem seguir o contrato da operação; campos decimais são enviados como strings com ponto decimal. Não derive saldos no cliente para executar uma movimentação: o servidor valida a quantidade disponível e a concorrência.

## 3. Renovar os tokens

`POST /api/auth/mobile/refresh`

```http
Content-Type: application/json
```

```json
{
  "refreshToken": "<ultimo-refresh-token-recebido>"
}
```

A resposta tem o mesmo formato do login, com um novo access token e um novo refresh token. A renovação troca o hash armazenado na sessão de forma atômica. O refresh token anterior deixa de funcionar. O servidor guarda apenas o hash do refresh token.

Serialize a renovação no aplicativo: várias requisições recebendo `401` devem aguardar uma única renovação em andamento. Guarde o novo par de tokens antes de repetir a operação original. Se a resposta da renovação for perdida depois de o servidor efetuar a rotação, o token antigo já não poderá ser reutilizado; será necessário entrar novamente.

Um `401` durante a renovação indica sessão inexistente, expirada, revogada ou usuário inativo. Limpe as credenciais locais e apresente o login. Não faça um ciclo infinito de tentativas de renovação.

## 4. Sair da conta

`POST /api/auth/mobile/logout`

Envie `Content-Type: application/json` e o mesmo formato de corpo da renovação, com o **refresh token mais recente**. A rota revoga a sessão correspondente e responde `{ "ok": true }`; funciona mesmo quando o access token já expirou. Repetir o logout é seguro. Após a resposta, remova o par de tokens do armazenamento local. Se o aparelho estiver offline, remover apenas os tokens locais não revoga a sessão no servidor.

## Endpoints disponíveis

Todas as rotas abaixo exigem autenticação e respeitam a empresa da sessão. Os perfis são `ADMIN`, `ACCOUNTANT`, `FINANCE`, `OPERATIONS` e `VIEWER`; as operações aplicam suas permissões no servidor. `VIEWER` não pode gravar dados.

| Área | Método e caminho | Observação |
| --- | --- | --- |
| Obras | `GET /api/projects` | Lista de obras |
| Obras | `POST /api/projects`, `PATCH /api/projects/{id}` | Cadastro e edição idempotentes |
| Clientes/fornecedores | `GET /api/partners` | Lista de parceiros |
| Clientes/fornecedores | `POST /api/partners`, `PATCH /api/partners/{id}` | Cadastro e edição idempotentes |
| Produtos | `GET /api/inventory/products` | Lista de produtos e saldos |
| Produtos | `POST /api/inventory/products`, `PATCH /api/inventory/products/{id}` | Cadastro e edição idempotentes |
| Estoque | `GET /api/inventory/movements`, `POST /api/inventory/movements` | Histórico e movimentação idempotente; saídas exigem obra |
| Faturamento | `POST /api/invoices` | Criação idempotente de serviço e conta a receber |
| Contratos | `POST /api/contracts` | Criação idempotente de contrato |
| Medições | `POST /api/contracts/{id}/measurements` | Registro idempotente de medição |
| Medições | `POST /api/measurements/{id}/approve` | Aprovação idempotente e geração da obrigação |
| Financeiro | `POST /api/payables/{id}/pay` | Baixa idempotente de conta a pagar |
| Financeiro | `POST /api/receivables/{id}/reconcile` | Conciliação idempotente de recebimento |
| Títulos | `GET /api/financial-titles`, `GET /api/financial-titles/{id}` | Documentos e situação da conta vinculada |
| Títulos | `GET /api/financial-titles/links` | Contas disponíveis para vincular |
| Títulos | `POST /api/financial-titles`, `PATCH /api/financial-titles/{id}` | Cadastro e edição idempotentes; edição exige revisão atual |
| Demonstrativos | `GET /api/reports/balance-sheet?asOf=YYYY-MM-DD` | Balanço patrimonial na data de referência |
| Demonstrativos | `GET /api/reports/trial-balance?from=YYYY-MM-DD&to=YYYY-MM-DD` | Balancete com saldos e movimentos do período |
| Banco | `POST /api/bank-statements/ofx` | Corpo é texto OFX; deduplicação por arquivo |
| Rotina mensal | `PATCH /api/monthly-tasks/{id}` | Atualiza conclusão da tarefa |
| Relatórios | `GET /api/reports/financial`, `GET /api/reports/tax-preview` | Indicadores financeiros e prévia tributária |
| Contabilidade | `GET /api/exports/accounting` | Exportação contábil |
| Modelos de relatório | `GET /api/report-templates`, `GET /api/report-templates/{id}` | Lista e leitura dos modelos da empresa |
| Modelos de relatório | `POST /api/report-templates` | Cadastro idempotente do modelo visual |
| Modelos de relatório | `PATCH /api/report-templates/{id}` | Edição idempotente, com `revision` para evitar sobrescrever outra edição |
| Modelos de relatório | `DELETE /api/report-templates/{id}` | Arquivamento idempotente; corpo `{ "revision": 1 }` |
| Dados de relatório | `GET /api/report-data?source=inventory` | Dados formatados para emissão; acesso varia conforme a fonte |

Os métodos de cada rota estão explicitamente relacionados acima. As rotas originais de faturamento e baixas não são um CRUD genérico; os comandos mantêm suas regras de negócio.

### Modelos e dados de relatório

O modelo visual é um documento JSON validado. Seu contrato está em `src/modules/reports/schema.ts`. A edição precisa incluir a revisão retornada pela consulta; um `409` informa que outra edição alterou o modelo. Recarregue o registro e reconcilie as alterações antes de salvar novamente.

O endpoint de dados aceita `source` e filtros permitidos pela fonte, como `recordId`, `projectId`, `from` e `to` (`YYYY-MM-DD`). As fontes e campos disponíveis estão em `src/modules/reports/sources.ts`. A resposta contém dados preparados para impressão, por isso quantidades, valores e datas já podem estar formatados em português. Para operações de negócio use o contrato do endpoint da respectiva área.

## Respostas de erro

O formato básico é `{ "error": "mensagem" }`. Erros de validação de relatórios podem incluir `details`.

| Status | Tratamento no aplicativo |
| --- | --- |
| `400` | Corrigir campos, filtros ou chave de idempotência |
| `401` | Tentar uma renovação; se ela falhar, exigir login |
| `403` | Usuário sem permissão ou origem inválida no fluxo com cookies |
| `404` | Registro não encontrado na empresa autenticada |
| `409` | Conflito de edição/concorrência ou chave reutilizada com outro corpo |
| `415` | Usar `application/json` nas rotas de autenticação mobile |
| `500` | Exibir falha e manter o rascunho; não confirmar a operação no cliente |

## Locações de equipamentos

As rotas abaixo aceitam a sessão web ou autenticação Bearer. As consultas são restritas à empresa autenticada. Cadastros e edições de locações aceitam `ADMIN`, `ACCOUNTANT`, `FINANCE` e `OPERATIONS`; registrar cobranças e ler XML exige `ADMIN`, `ACCOUNTANT` ou `FINANCE`.

| Método e rota | Uso |
| --- | --- |
| `GET /api/equipment-rentals` | Listar locações; filtros `search`, `projectId`, `supplierId` e `status` |
| `POST /api/equipment-rentals` | Cadastrar equipamento, obra, locadora, datas e referência |
| `GET /api/equipment-rentals/options` | Obras e fornecedores disponíveis; aceita `currentRentalId` para edição |
| `GET /api/equipment-rentals/{id}` | Consultar locação, cobranças e metadados dos anexos |
| `PATCH /api/equipment-rentals/{id}` | Atualizar cadastro com revisão otimista |
| `GET /api/equipment-rentals/{id}/charges` | Consultar documentos e contas vinculadas |
| `POST /api/equipment-rentals/{id}/charges` | Registrar cobrança e criar sua conta a pagar e lançamento contábil |
| `POST /api/equipment-rentals/{id}/documents/preview` | Validar arquivos e sugerir campos de um XML, sem gravar |
| `GET /api/equipment-rentals/{id}/charges/{chargeId}/files/{fileId}` | Baixar anexo autenticado |

Os POSTs de cadastro/cobrança e o PATCH exigem `X-Idempotency-Key`. A prévia de XML não exige essa chave. Arquivos são enviados em JSON como `{ fileName, mediaType, contentBase64 }`: até três arquivos e 2 MiB de conteúdo binário somado, tipos `application/xml` e `application/pdf`. O limite do corpo JSON nas rotas com arquivos é 3 MiB. O download não usa URL pública permanente.

O contrato e as regras financeiras estão em [EQUIPMENT_RENTALS.md](EQUIPMENT_RENTALS.md).

## Caixa de entrada de e-mail

As rotas de e-mail aceitam cookie da aplicação ou Bearer do aplicativo mobile. As consultas são isoladas pela empresa autenticada; não envie `companyId` ou `userId`. A configuração da conexão exige perfil `ADMIN`; a consulta, sincronização e revisão exigem `ADMIN`, `ACCOUNTANT` ou `FINANCE`.

| Endpoint | Finalidade |
| --- | --- |
| `GET /api/mail/connection` | Consultar configuração sem devolver a senha |
| `PUT /api/mail/connection` | Salvar conta Gmail, senha de app opcional na atualização, pasta, data inicial e opções de sincronização |
| `POST /api/mail/sync` | Sincronizar o próximo lote de mensagens e anexos para revisão |
| `GET /api/mail/messages` | Listar mensagens; filtros `search`, `status=PENDING\|IMPORTED` e `cursor` |
| `GET /api/mail/messages/{id}` | Ler texto, avisos, anexos e seus vínculos |
| `GET /api/mail/messages/{id}/attachments/{attachmentId}` | Baixar o anexo autenticado |
| `POST /api/mail/messages/{id}/preview` | Sugerir campos do XML; corpo `{ "attachmentIds": ["uuid"] }` |
| `POST /api/mail/messages/{id}/import-charge` | Confirmar uma cobrança revisada com anexos já recebidos |

O `PUT` da conexão e a confirmação de cobrança exigem `X-Idempotency-Key`. A sincronização usa uma trava temporária por empresa e um cursor IMAP persistido. As respostas de mensagens usam `{ "messages": [...], "nextCursor": null }` e `{ "message": {...} }`; a configuração usa `{ "connection": {...} }` ou `null` quando não cadastrada.

A confirmação recebe `{ "rentalId": "uuid", "attachmentIds": ["uuid"], "charge": { "documentKind": "NFSE", "documentNumber": "000123", "issuedAt": "2026-10-01", "dueAt": "2026-10-10", "amount": "100.25" } }`. `charge` segue as regras de cobrança de locação e não aceita `files`: o servidor recupera os anexos selecionados. A resposta é `{ "rentalId": "uuid", "chargeId": "uuid", "payableId": "uuid" }`. Cada anexo só pode ser confirmado uma vez, inclusive entre requisições concorrentes. A mesma mensagem pode originar outras cobranças usando seus anexos restantes.

O agendador usa `GET /api/cron/mail-sync`, autenticado exclusivamente por `Authorization: Bearer <CRON_SECRET>`. Esse segredo fica no servidor e não deve ser distribuído ao aplicativo mobile. Consulte [EMAIL_IMPORT.md](EMAIL_IMPORT.md) para ativação, limites de importação e frequência na Vercel.

## Configuração do aplicativo

Preferências pessoais podem ser consultadas com `GET /api/settings/preferences` e atualizadas com `PATCH /api/settings/preferences`. Os endpoints usam a identidade autenticada e aceitam tema, idioma, casas decimais de exibição e limite de telas carregadas. Consulte [SETTINGS.md](SETTINGS.md) para o contrato e os limites dos campos.

- Use HTTPS em produção. Em um aparelho físico, `localhost` aponta para o próprio aparelho; use o domínio HTTPS do deploy para consumir o ERP.
- Guarde o refresh token no armazenamento seguro do sistema, como Keychain no iOS ou armazenamento protegido por Android Keystore. Mantenha o access token em memória ou no mesmo armazenamento seguro.
- Não grave senha, tokens, `JWT_SECRET`, chave de criptografia ou URL do banco em logs, analytics ou arquivos públicos do aplicativo. O mobile só precisa do domínio da API e das credenciais fornecidas pelo usuário.
- Respeite `refreshExpiresAt`, serialize a renovação e preserve a chave de idempotência ao repetir escritas.
- As rotas `/api/auth/login`, `/api/auth/refresh` e `/api/auth/logout` continuam reservadas ao fluxo web com cookies e validação de origem.

## Testes de autenticação

```powershell
node --import tsx --test src/lib/auth-credentials.test.ts src/lib/access-token.test.ts src/lib/refresh-session.test.ts src/lib/request-origin.test.ts
```

Esses testes são isolados e não acessam o banco. Cobrem prioridade do Bearer, proibição de fallback para cookies, proteção de origem, assinatura e expiração, vínculo da sessão com usuário/empresa, revogação, permissão atual e rotação concorrente do refresh token.
