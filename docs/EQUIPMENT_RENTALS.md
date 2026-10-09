# Locações de equipamentos

O módulo **Locações** relaciona o equipamento alugado à obra, à empresa locadora, aos documentos recebidos e às contas a pagar. O cadastro usa os parceiros e as obras já existentes no sistema.

## Preparar os cadastros

1. Em **Cadastros**, cadastre a locadora como parceiro e marque a opção de fornecedor.
2. Cadastre ou selecione uma obra ativa.
3. Abra **Locações → Nova locação** (`/rentals/new`).

Cada locação possui uma referência única na empresa, descrição do equipamento, identificador ou número de série opcional, quantidade, obra, locadora, data de retirada, previsão de devolução, devolução efetiva e observações. Para equipamentos diferentes ou números de série que precisem de acompanhamento individual, crie registros separados.

A situação é calculada a partir das datas: **Agendada**, **Em locação** ou **Devolvida**. A devolução efetiva deve ser preenchida quando o equipamento for devolvido. A listagem permite pesquisar por equipamento, referência, identificador, obra e locadora, além de filtrar por obra, locadora e situação.

Cadastrar a locação registra os dados operacionais. Os valores financeiros são registrados quando uma cobrança é confirmada.

## Registrar documentos e cobranças

1. Salve a locação e abra sua aba **Documentos e títulos**.
2. Selecione **Registrar cobrança**.
3. Escolha o tipo de documento: NFS-e, fatura, recibo de locação ou outro documento.
4. Informe número, emissão, vencimento e valor a pagar. O link externo e as observações são opcionais.
5. Se houver arquivos, selecione os documentos e confira os dados conforme a próxima seção.
6. Confirme em **Registrar cobrança e gerar conta**.

A confirmação cria, na mesma transação:

- A cobrança e os arquivos anexados.
- Uma conta a pagar vinculada à locação, à obra e à locadora.
- O lançamento de custo da locação e da obrigação a pagar.

Cada cobrança gera **uma conta a pagar**. Para várias cobranças de uma mesma locação, registre cada documento separadamente. Não há cálculo automático de diárias, mensalidades, proporcionalidade ou geração recorrente de cobranças.

O número do documento não pode se repetir para o mesmo tipo de documento e a mesma locação. A edição dos dados operacionais usa uma revisão para detectar alterações concorrentes. Depois da primeira cobrança, a obra e a locadora ficam bloqueadas para preservar os vínculos financeiros.

### Títulos e pagamento

A aba **Documentos e títulos** apresenta os documentos, anexos, situação da conta e os totais cobrado, pago e em aberto. Use **Ver conta a pagar** para abrir a conta ou **Vincular título** para cadastrar o boleto ou outro título associado. Se o título já existir, aparece o atalho **Ver título**.

A conta mantém a aba **Títulos**, e o título permite consultar sua conta e a locação de origem. O título acompanha o valor e a situação da conta. Conforme a regra atual do módulo financeiro, há no máximo um título por conta.

O pagamento é realizado pelo fluxo existente de contas a pagar, com baixa integral da conta. O lançamento do pagamento reduz a obrigação e o saldo bancário; o custo já foi registrado na cobrança. O cadastro e acompanhamento de títulos seguem o funcionamento descrito em [Títulos financeiros](FINANCIAL_TITLES.md).

### Correções após a confirmação

As cobranças e seus anexos não possuem edição ou exclusão nesta versão. Revise o documento antes de confirmar: número, valor, datas, locadora e obra são usados para criar a conta e o lançamento contábil. Também não existe fluxo específico de estorno, substituição de cobrança ou parcelamento neste módulo.

## Importação XML e anexos PDF

Os arquivos são opcionais. A cobrança aceita **até três arquivos**, sendo **no máximo um XML**, com **tamanho total de até 2 MiB (2.097.152 bytes)**. Esse é o total dos arquivos originais, antes da codificação Base64 usada pela API.

### XML

1. Selecione o XML em **Arquivos do documento**.
2. Clique em **Ler XML**.
3. Confira o painel **Conferir dados encontrados**.
4. Clique em **Aplicar dados do XML** para copiar os campos encontrados ao formulário.
5. Revise o vencimento e complete os campos ausentes antes de registrar.

A leitura reconhece estruturas comuns de NFS-e com `InfNfse`/`infNFSe` e NF-e com `infNFe`. Quando disponíveis, sugere tipo, número, data e valor. O número preserva zeros à esquerda, e os valores são tratados como strings decimais. Na NFS-e, a extração procura primeiro o valor líquido; quando ele não estiver disponível, procura o valor do serviço.

Cada cobrança recebe uma nota por vez: a prévia e a gravação rejeitam dois XMLs ou um lote com várias notas reconhecidas. XMLs de formatos não reconhecidos podem ser anexados, mas os dados precisam ser preenchidos manualmente. Campos do XML não substituem automaticamente a obra, a locadora ou o vencimento.

O XML precisa estar em **UTF-8**. Declarações `DOCTYPE` e `ENTITY`, XML malformado, mais de 64 níveis de elementos e documentos com mais de 10.000 marcações de elementos são rejeitados. Não há consulta a URLs ou resolução de entidades externas durante a leitura.

A importação é uma ajuda para preencher o cadastro. Ela não valida assinatura digital, autorização fiscal, autenticidade da nota, CNPJ do emitente/tomador ou correspondência entre o documento e a locadora selecionada. Essas informações devem ser conferidas no documento recebido.

### PDF

O PDF é anexado e disponibilizado para download. **Não há OCR nem preenchimento automático a partir de PDF**, inclusive para arquivos digitalizados. Preencha os dados do documento manualmente ou anexe também o XML correspondente.

O upload verifica extensão, identificação inicial de PDF e marcador de encerramento. Essa verificação de formato não é uma análise antivírus nem uma validação completa do conteúdo do PDF. O sistema entrega o arquivo como download autenticado.

### Quando os arquivos são salvos

Selecionar os arquivos, ler o XML e aplicar a prévia não gravam a cobrança. Os arquivos são persistidos junto com a confirmação da cobrança. Eles podem ser removidos do formulário antes dessa confirmação.

## Armazenamento e permissões

O conteúdo original dos anexos é criptografado com **AES-256-GCM**, usando `DATA_ENCRYPTION_KEY`, e armazenado no banco. O nome, o tipo e o tamanho ficam disponíveis como metadados. Não é necessário configurar um bucket ou escrever arquivos no disco da Vercel.

Preserve a mesma `DATA_ENCRYPTION_KEY` entre os ambientes que usam esse banco. A perda ou substituição da chave impede a leitura dos anexos existentes. O limite de upload reduz o tamanho de cada cobrança, mas o volume total de anexos aumenta o armazenamento e os backups do banco.

| Ação | Perfis autorizados |
|---|---|
| Consultar locações, documentos e baixar anexos | `ADMIN`, `ACCOUNTANT`, `FINANCE`, `OPERATIONS`, `VIEWER` |
| Criar e editar locações | `ADMIN`, `ACCOUNTANT`, `FINANCE`, `OPERATIONS` |
| Ler XML e registrar cobranças | `ADMIN`, `ACCOUNTANT`, `FINANCE` |
| Cadastrar títulos e realizar pagamentos | Permissões existentes do módulo financeiro |

As consultas usam a empresa do usuário autenticado. O download verifica a cadeia completa: empresa, locação, cobrança e arquivo. Os relacionamentos no banco também usam chaves que incluem a empresa. Os endpoints não aceitam escolher outra empresa no corpo ou nos filtros.

Os downloads retornam `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` e política de conteúdo restritiva. O conteúdo do arquivo não é incluído nas respostas de listagem e detalhe da locação.

## API para integrações

As rotas usam a autenticação existente por sessão ou `Authorization: Bearer <access_token>`. Nas gravações, envie JSON e `X-Idempotency-Key`; reutilize a mesma chave somente para repetir a mesma operação e o mesmo conteúdo. A prévia de XML não exige chave de idempotência porque não grava dados. Requisições autenticadas por cookie seguem a verificação de origem do sistema.

| Método | Endpoint | Finalidade |
|---|---|---|
| `GET` | `/api/equipment-rentals` | Listar locações |
| `POST` | `/api/equipment-rentals` | Cadastrar locação |
| `GET` | `/api/equipment-rentals/options` | Consultar obras e locadoras elegíveis |
| `GET` | `/api/equipment-rentals/{id}` | Detalhar locação, cobranças e metadados dos anexos |
| `PATCH` | `/api/equipment-rentals/{id}` | Atualizar os dados da locação com `revision` |
| `GET` | `/api/equipment-rentals/{id}/charges` | Listar cobranças da locação |
| `POST` | `/api/equipment-rentals/{id}/charges` | Registrar cobrança, conta a pagar e anexos |
| `POST` | `/api/equipment-rentals/{id}/documents/preview` | Validar arquivos e sugerir campos do XML |
| `GET` | `/api/equipment-rentals/{id}/charges/{chargeId}/files/{fileId}` | Baixar o arquivo original |

Filtros da listagem: `search`, `projectId`, `supplierId` e `status` (`SCHEDULED`, `ACTIVE` ou `RETURNED`). O endpoint de opções aceita `currentRentalId` para preservar os vínculos de uma locação existente durante a edição. Outros parâmetros e parâmetros repetidos são rejeitados.

O corpo da prévia é `{ "files": [...] }`. Na criação de cobrança, `files` é opcional. Cada item contém:

```json
{
  "fileName": "invoice.xml",
  "mediaType": "application/xml",
  "contentBase64": "BASE64_OF_ORIGINAL_FILE"
}
```

Use `application/xml` ou `application/pdf`. Envie somente o conteúdo Base64, sem o prefixo de uma URL `data:`. O nome do arquivo aceita até 180 caracteres e não pode conter separadores de caminho ou caracteres de controle.

A prévia retorna `{ "fields": { ... }, "warnings": [...] }`. Apenas os campos encontrados são retornados; uma prévia incompleta não impede o preenchimento manual. O cliente deve mostrar as sugestões para conferência antes de gravar. Os endpoints de prévia e criação de cobrança limitam o corpo JSON efetivamente recebido a **3 MiB**, independentemente de `Content-Length`, além do limite de 2 MiB para os arquivos decodificados.

Consulte também [API do ERP](API.md) para autenticação, títulos, contas a pagar e tratamento de erros.

## Migração e deploy

A implementação inclui a migração `20260930120000_equipment_rentals`. Ela cria as tabelas de locação, cobrança e arquivo, amplia a origem de contas a pagar e lançamentos contábeis e inclui as contas contábeis necessárias para empresas existentes.

Antes de executar o código novo em um ambiente, aplique as migrações pendentes com as conexões daquele ambiente configuradas:

```powershell
npm ci
npx prisma migrate deploy
npm run build
```

Para conferir o estado do banco:

```powershell
npx prisma migrate status
```

No deploy pela integração Git da Vercel:

1. Configure `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` e a mesma `DATA_ENCRYPTION_KEY` do ambiente. Preserve as demais variáveis já utilizadas pelo projeto.
2. Inclua a migração, o schema e o código no mesmo conjunto de alterações do repositório.
3. Aplique a migração no banco de destino antes de colocar em execução o código que depende das novas tabelas.
4. Publique pelo fluxo Git já configurado e confira a listagem de locações após o deploy.

O build executa `prisma generate`, mas não aplica migrações. Os endpoints de documentos usam o runtime Node.js. A aplicação trabalha com os anexos em memória durante a requisição e os persiste criptografados no banco; não depende de disco persistente entre invocações. Veja [DEPLOY.md](../DEPLOY.md) para obter as URLs do banco e configurar a Vercel.
