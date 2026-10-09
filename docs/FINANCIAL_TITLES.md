# Títulos financeiros e seus vínculos

Abra **Financeiro → Títulos** ou acesse `/finance?tab=titles`. Essa aba organiza boletos, duplicatas, notas promissórias e outros documentos vinculados às contas a pagar ou a receber da empresa.

## Cadastrar e consultar

1. Clique em **Novo título**. O cadastro abre uma tela própria, com seções expansíveis e suporte às abas internas.
2. Na aba **Dados do título**, em **Conta vinculada**, escolha a direção **A pagar** ou **A receber** e selecione a conta de origem.
3. Abra a aba **Vínculos** para conferir parceiro, obra, documento de origem, valor, vencimento, saldo e situação. Ao voltar para **Dados do título**, os campos preenchidos são preservados.
4. Em **Identificação do título**, escolha o tipo e informe o número ou referência do documento.
5. Se desejar, preencha banco, linha digitável, código de barras e observações.
6. Clique em **Cadastrar título**. Para editar, abra o título pela lista e use **Salvar alterações**.

A lista permite buscar por referência, parceiro, obra, banco ou tipo do documento e filtrar por direção e situação. O filtro **Vencido** encontra contas abertas ou parcialmente liquidadas cujo vencimento já passou.

## Uma conta por título

Cada título deve estar vinculado a exatamente uma conta da mesma empresa, e cada conta aceita **um título** nesta versão. O cadastro apresenta as contas que ainda não têm título. A edição também inclui a conta atualmente vinculada.

É possível alterar o vínculo para outra conta disponível. Uma conta cancelada não aceita novo título nem um novo vínculo; um título já associado a ela continua disponível para consulta e atualização dos dados do documento. Contas liquidadas podem receber um título para identificação e acompanhamento histórico.

O cadastro do título não cria outra obrigação, outra receita ou um lançamento contábil. **Valor, vencimento, valor liquidado, saldo e situação são obtidos da conta vinculada** a cada consulta; esses campos não são editáveis no título.

| Situação | Origem |
| --- | --- |
| Em aberto | A conta ainda possui saldo e não teve liquidação |
| Parcial | A conta a receber possui recebimento parcial e saldo restante |
| Liquidado | A conta não possui saldo em aberto |
| Cancelado | A conta a pagar foi cancelada ou o serviço da conta a receber foi cancelado |

Para contas a pagar, o valor liquidado acompanha a baixa integral da conta. Para contas a receber, acompanha o total recebido. A indicação de vencimento complementa a situação; não é um estado gravado separadamente no título.

## Navegar entre os vínculos

A aba **Vínculos** do formulário do título oferece atalhos para:

- **Cliente ou fornecedor:** abre o cadastro de parceiros com o registro selecionado.
- **Obra:** abre o cadastro de obras com o registro selecionado.
- **Contrato vinculado:** documento de origem de uma conta a pagar.
- **Serviço vinculado:** documento de origem de uma conta a receber.
- **Ver medição:** disponível quando a conta a pagar tem medição vinculada.
- **Ver conta vinculada:** abre a tela de detalhes da conta correspondente no Financeiro.
- **Registrar pagamento / Conciliar recebimento:** abre o fluxo financeiro existente quando há saldo e o usuário possui permissão.

As contas a pagar e a receber também oferecem acesso ao título existente ou ao cadastro com a conta previamente selecionada. Os formulários seguem o comportamento de rascunhos das abas internas: salve antes de recarregar a página ou fechar o navegador.

## Consultar os títulos dentro da conta

Em **Financeiro → Contas a pagar** ou **Contas a receber**, clique no nome do parceiro na linha da conta para abrir sua tela de detalhes. Também é possível acessá-la pelo botão **Ver conta vinculada** na aba **Vínculos** de um título.

Cada conta possui duas abas internas:

- **Dados da conta:** apresenta valores, vencimento, situação, parceiro, obra e documento de origem. Contas a pagar já liquidadas também mostram a data do pagamento.
- **Títulos:** mostra a quantidade de documentos vinculados, a lista dos títulos desta conta e os atalhos para consulta ou edição. Se ainda não existir título, usuários com permissão financeira podem usar **Vincular título**, com a conta preenchida automaticamente.

As rotas de detalhes são `/finance/payables/{id}` e `/finance/receivables/{id}`. Elas permitem consultar também contas liquidadas e canceladas. Contas canceladas não oferecem a criação de novo vínculo. O botão **Registrar pagamento** ou **Conciliar recebimento** aparece quando existe saldo e o usuário possui permissão para a operação. Consultar uma conta ou alternar suas abas não modifica dados financeiros.

## Dados bancários

Esses campos registram informações de um documento já existente e são opcionais:

| Campo | Regra |
| --- | --- |
| Banco / instituição | Até 120 caracteres |
| Linha digitável | 47 ou 48 dígitos, quando informada |
| Código de barras | 44 dígitos, quando informado |
| Observações | Até 2.000 caracteres |

Espaços, pontos e traços são aceitos na linha digitável e no código de barras e removidos antes do armazenamento. A validação confere caracteres e comprimento; **não verifica dígitos verificadores, autenticidade ou registro bancário**.

Este cadastro não emite nem registra boletos no banco, não produz remessa/retorno CNAB, não inicia pagamentos e não consulta automaticamente a liquidação bancária. A baixa e a conciliação continuam nos fluxos financeiros vinculados.

## Permissões e empresa

| Perfil | Consultar títulos e vínculos | Cadastrar e editar |
| --- | --- | --- |
| `ADMIN` | Sim | Sim |
| `ACCOUNTANT` | Sim | Sim |
| `FINANCE` | Sim | Sim |
| `OPERATIONS` | Sim | Não |
| `VIEWER` | Sim | Não |

As consultas e gravações usam a empresa da sessão autenticada. Os vínculos são protegidos também por chaves estrangeiras compostas no banco. Informar `companyId` ou `userId` no corpo ou nos parâmetros da API é rejeitado.

## API para aplicações externas

As rotas aceitam a sessão do site ou `Authorization: Bearer <accessToken>`. O fluxo de autenticação mobile está em [API.md](API.md). Mutações com cookie exigem a origem da aplicação; clientes com Bearer utilizam o fluxo da API.

| Método e rota | Entrada | Resposta |
| --- | --- | --- |
| `GET /api/financial-titles` | Filtros opcionais `accountType`, `kind`, `status`, `search` | `200`, `{ "titles": [...] }` |
| `GET /api/financial-titles/{id}` | UUID do título | `200`, `{ "title": { ... } }` |
| `GET /api/financial-titles/links` | `currentTitleId` opcional na edição | `200`, `{ "options": [...] }` |
| `POST /api/financial-titles` | Corpo completo do cadastro | `201`, `{ "title": { ... } }` |
| `PATCH /api/financial-titles/{id}` | Corpo completo com `revision` atual | `201`, `{ "title": { ... } }` |

Valores aceitos nos filtros:

- `accountType`: `PAYABLE` ou `RECEIVABLE`.
- `kind`: `BOLETO`, `DUPLICATE`, `PROMISSORY_NOTE` ou `OTHER`.
- `status`: `OPEN`, `PARTIAL`, `SETTLED` ou `CANCELLED`. `OVERDUE` é um filtro da interface; não é aceito como situação na API.
- `search`: até 120 caracteres, pesquisados em referência, banco, parceiro, obra e número do documento de origem.

Para criar, envie `Content-Type: application/json`, `X-Idempotency-Key` e o corpo abaixo, substituindo `accountId` por um UUID obtido em `/api/financial-titles/links`:

```json
{
  "accountType": "PAYABLE",
  "accountId": "11111111-1111-4111-8111-111111111111",
  "kind": "BOLETO",
  "number": "BOL-2026-001",
  "bankName": "",
  "digitLine": "",
  "barcode": "",
  "notes": ""
}
```

`accountType`, `accountId`, `kind` e `number` são obrigatórios. A referência aceita de 1 a 80 caracteres. Os campos opcionais omitidos assumem texto vazio.

Para editar, envie o mesmo conjunto de campos e acrescente `revision` com o valor retornado na última consulta. O `PATCH` representa a edição completa do cadastro: campos opcionais omitidos são limpos. Cada edição incrementa a revisão; uma revisão desatualizada retorna `409` e preserva o registro atual.

A resposta inclui os dados cadastrados, `id`, `revision` e o retrato atual da conta: `accountType`, `accountId`, `amount`, `settledAmount`, `remaining`, `dueAt`, `status`, `partner`, `project`, `origin` e `measurementId`. Valores monetários são strings decimais com duas casas e datas usam ISO 8601. `origin.type` indica `CONTRACT` ou `INVOICE`.

### Repetições e erros

Use uma nova `X-Idempotency-Key` por operação lógica, com até 128 caracteres entre letras, números, `_` e `-`. Em caso de interrupção da conexão ou conflito concorrente indicado pelo servidor, repita a mesma chave com o mesmo corpo. Uma repetição concluída retorna a resposta armazenada e `Idempotent-Replay: true`; a mesma chave com conteúdo diferente retorna `409`.

- `400`: campos, filtros, identificadores, revisão ou chave de idempotência inválidos; parâmetros repetidos ou desconhecidos.
- `401`: sessão ausente ou expirada.
- `403`: perfil sem permissão de escrita ou tentativa de escolher outra empresa/usuário.
- `404`: título ou conta não encontrados na empresa autenticada.
- `409`: conta já vinculada a outro título, novo vínculo com conta cancelada, revisão desatualizada ou conflito concorrente.

Não há rota de exclusão ou cancelamento independente do título nesta versão; a situação acompanha a conta de origem.

## Instalação e deploy

A migration **`20260927180000_financial_titles`** adiciona o cadastro, o enum de tipos e as restrições de vínculo por empresa e de um título por conta. Antes de iniciar a aplicação com esta versão, execute no ambiente de destino:

```powershell
npx prisma migrate deploy
npm run db:generate
```

O build gera o Prisma Client; o deploy da Vercel não aplica migrations automaticamente. Configure as URLs de conexão e execute a migration conforme [DEPLOY.md](../DEPLOY.md), antes de publicar o código dependente da nova tabela.
