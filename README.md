# Vetor ERP

Para colocar o projeto no ar pela Supabase, GitHub e Vercel, siga o [guia de deploy](DEPLOY.md).

Base de um ERP para uma empresa de pisos industriais, com Next.js na Vercel, PostgreSQL na Supabase e Prisma. O projeto entrega um núcleo transacional para contratos e medições de mão de obra, notas de serviço registradas internamente, contas a receber e pagar, conciliação OFX e lançamentos por partidas dobradas. A interface usa dados reais da empresa autenticada.

## Arquitetura

```text
src/app                    Next.js App Router, páginas e endpoints
src/modules                Slices: workspace, dashboard, billing, finance, inventory, registrations
src/components             Login e componentes visuais compartilhados
src/lib/auth.ts            Sessões, JWT, RBAC e cookies
src/lib/crypto.ts          Criptografia autenticada e hash
src/lib/idempotency.ts     Controle transacional de reexecução
src/lib/finance.ts         Plano inicial de contas e razão
src/lib/ofx.ts             Leitura de transações OFX
src/middleware.ts          Verificação inicial de JWT, RBAC e origem
prisma/schema.prisma       Modelo relacional multiempresa
prisma/seed.ts             Cadastro inicial de empresa, admin e contas
```

Os registros de negócio carregam `companyId`. Cada endpoint valida a empresa do usuário antes de acessar entidades relacionadas. O middleware verifica assinatura e papel do JWT; o handler consulta a sessão no banco para considerar revogação e alterações de papel. Operações financeiras usam transações PostgreSQL com isolamento `Serializable`.

O lançamento contábil é uma linha com conta de débito, conta de crédito e um valor positivo. As contas precisam pertencer à mesma empresa do evento. Um evento com retenções gera várias linhas que, em conjunto, representam o valor bruto. A chave única de origem evita repetir o mesmo par de contas no evento.

## Instalação

1. Use Node.js 20 ou superior e execute `npm install`.
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL` com a URL **pooled** da Supabase e `DIRECT_URL` com a conexão direta usada pelo Prisma Migrate. Crie `JWT_SECRET` aleatório de pelo menos 32 caracteres e `DATA_ENCRYPTION_KEY` com 32 bytes codificados em base64.
3. Execute `npm run db:migrate` e depois `npm run db:seed`. O seed lê `INITIAL_COMPANY_NAME`, `INITIAL_COMPANY_TAX_ID`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` do ambiente e recusa recriar o administrador.
4. Execute `npm run dev` e abra `http://localhost:3000`.

Para produção, siga o guia de deploy: configure as variáveis na Vercel, aplique as migrações com `prisma migrate deploy` antes de publicar código que depende delas e use o pool de conexões da Supabase. Não coloque chaves de criptografia ou URLs de banco em variáveis `NEXT_PUBLIC_`.

## Fluxos implementados

### Módulos da interface

Após entrar, a página inicial apresenta os módulos e os atalhos de cadastro. A navegação lateral permanece disponível em todas as telas.

| Módulo | Rota | Operações disponíveis |
| --- | --- | --- |
| Início | `/` | Busca de módulos e atalhos para cadastros e indicadores |
| Cadastros | `/registrations` | Criar e editar obras, clientes e fornecedores; ativar/inativar obras |
| Faturamento | `/billing` | Registrar serviços, contratos e medições; aprovar medições |
| Financeiro | `/finance` | Contas a pagar e receber, baixa de pagamento, importação OFX, conciliação de créditos e exportação do razão |
| Estoque | `/inventory` | Cadastrar e editar produtos, registrar entradas e saídas por obra, consultar saldos e últimas 100 movimentações |
| Dashboard | `/dashboard` | Indicadores com atalhos, gráfico por mês e período, checklist mensal e últimos lançamentos |

Para começar, cadastre uma obra e os parceiros em **Cadastros**. Depois, registre um serviço em **Faturamento** para gerar a conta a receber. Contratos e medições aprovadas geram contas a pagar. No **Estoque**, cadastre o produto e registre uma entrada para informar o saldo inicial. Saídas exigem uma obra ativa e saldo suficiente.

A barra **Telas abertas** permite alternar entre módulos e formulários. As abas usam visual plano, com a tela ativa indicada por uma linha discreta. Criar ou editar abre uma página própria, com campos organizados em seções recolhíveis. As abas de formulário preservam os campos preenchidos durante a navegação; alterações pendentes aparecem com um indicador e o fechamento exige confirmação na própria página. Os rascunhos ficam apenas na memória da sessão da página e não são recuperados depois de recarregar, sair ou fechar o navegador.

Até 8 telas ficam carregadas localmente para troca rápida entre abas, preservando filtros e estado da tela. O módulo **Configurações** centraliza tema persistido, idioma (`pt-BR`/`en-US`), casas decimais de exibição e limite de telas mantidas em memória. Essas preferências são salvas por usuário no banco. Consulte [docs/SETTINGS.md](docs/SETTINGS.md) para uso, comportamento do cache, endpoints e migração necessária.

A tipografia usa base de 16 px, campos com fonte de 16 px e controles maiores. Em telas pequenas, os formulários passam para uma coluna e as abas permitem rolagem horizontal.

Os formulários mostram os erros da operação, impedem envios repetidos enquanto salvam e atualizam as listas ao concluir. As ações disponíveis dependem do papel do usuário. Valores e indicadores são consultados no banco da empresa autenticada. O tema claro/escuro pode ser alternado no topo da aplicação.

O estoque possui uma migração própria em `prisma/migrations/20260918120000_inventory`. Em instalações existentes, execute `npx prisma migrate deploy` antes de publicar a atualização. Não execute novamente o seed para atualizar uma empresa já cadastrada.

### Endpoints

| Endpoint | Ação | Papel |
| --- | --- | --- |
| `POST /api/auth/login` | Login com Argon2 e abertura de sessão | Público |
| `POST /api/auth/refresh` | Rotação de refresh token | Sessão válida |
| `POST /api/auth/logout` | Revogação de sessão | Autenticado |
| `GET/POST /api/projects`, `PATCH /api/projects/:id` | Consulta, criação e edição de obras | Leitura: todos; escrita: admin, contador, financeiro, operação |
| `GET/POST /api/partners`, `PATCH /api/partners/:id` | Consulta, criação e edição de clientes e fornecedores | Leitura: todos; escrita: admin, contador, financeiro, operação |
| `GET/POST /api/inventory/products`, `PATCH /api/inventory/products/:id` | Produtos e estoque mínimo | Leitura: todos; escrita: admin, contador, financeiro, operação |
| `GET/POST /api/inventory/movements` | Histórico, entradas e saídas de estoque | Leitura: todos; escrita: admin, contador, financeiro, operação |
| `PATCH /api/monthly-tasks/:id` | Marcar ou desmarcar tarefa mensal | Admin, contador, financeiro |
| `POST /api/contracts` | Cadastro do contrato vinculado à obra | Admin, contador, financeiro, operação |
| `POST /api/contracts/:id/measurements` | Registro de medição dentro do valor contratado | Admin, contador, operação |
| `POST /api/measurements/:id/approve` | Aprovação, obrigação e custo da obra | Admin, contador, financeiro |
| `POST /api/invoices` | Registro da nota, recebível líquido e receita bruta | Admin, contador, financeiro |
| `POST /api/bank-statements/ofx` | Importação de transações OFX | Admin, contador, financeiro |
| `POST /api/receivables/:id/reconcile` | Conciliação de crédito bancário e baixa parcial ou integral | Admin, contador, financeiro |
| `POST /api/payables/:id/pay` | Baixa de prestador vinculada à obra | Admin, contador, financeiro |
| `GET /api/reports/financial` | DRE acumulada, saldos patrimoniais e margem por obra | Admin, contador, financeiro, leitura |
| `GET /api/reports/tax-preview` | RBT12 e prévia de alíquota por anexo configurado | Admin, contador, financeiro, leitura |
| `GET /api/exports/accounting` | Razão estruturado em TXT tabulado para conferência do contador | Admin, contador, financeiro |

As mutações de contrato, medição, nota e baixas exigem `X-Idempotency-Key`, com letras, números, `_` ou `-`, até 128 caracteres. A resposta é guardada na mesma transação que a operação e será repetida para a mesma entrada. A mesma chave com outra entrada retorna HTTP 409. As chaves expiram logicamente em 30 dias; adicione uma rotina de limpeza no banco antes de operar em escala. A importação OFX usa hash do arquivo e unicidade de `FITID` por extrato.

### Exemplos de lançamentos

| Evento | Débito | Crédito |
| --- | --- | --- |
| Nota de serviço sem retenção | Clientes a receber | Receita de serviços |
| Nota com ISS/INSS retidos | Clientes a receber, retenções a recuperar | Receita de serviços |
| Recebimento por OFX | Bancos | Clientes a receber |
| Medição aprovada de prestador | Custo direto de mão de obra | Contratos a pagar, tributos retidos a recolher |
| Pagamento de prestador | Contratos a pagar | Bancos |

Os valores de retenção do contrato são informados explicitamente e distribuídos proporcionalmente entre medições aprovadas, com acerto de arredondamento na última medição. O sistema não escolhe incidência nem calcula tributos automaticamente. A prévia do Simples lê faixas cadastradas e calcula `(RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12`. Ela não substitui o PGDAS-D e precisa da classificação da receita, tratamento das retenções e revisão do contador.

## API mobile e relatórios personalizados

A API aceita autenticação Bearer para aplicativos nativos, com login, renovação e logout em `/api/auth/mobile/*`. O guia [docs/API.md](docs/API.md) contém exemplos e a lista dos endpoints disponíveis.

O módulo **Relatórios** oferece biblioteca de modelos, editor por arrastar e soltar, campos manuais, fontes do ERP e impressão/PDF pelo navegador. Veja [docs/REPORTS.md](docs/REPORTS.md) para criar uma ficha de abastecimento ou um relatório com tabela. A migração `20260926120000_report_templates` precisa estar aplicada no banco de cada ambiente antes do uso.

O elemento **Tabela para preenchimento** permite configurar colunas e linhas em branco para completar depois da impressão, independentemente da fonte de dados.

Em **Financeiro → Títulos**, cadastre boletos, duplicatas e outros documentos vinculados às contas a pagar ou a receber. Os vínculos permitem consultar parceiro, obra e documento de origem; os saldos acompanham a conta financeira. Consulte [docs/FINANCIAL_TITLES.md](docs/FINANCIAL_TITLES.md) para o funcionamento, a migration e a API.

Em **Relatórios**, gere **Balanço patrimonial** por data de referência e **Balancete** por período, com conferência de totais e impressão/PDF. Os cálculos usam os lançamentos contábeis existentes. Consulte [docs/ACCOUNTING_REPORTS.md](docs/ACCOUNTING_REPORTS.md) para os filtros, critérios de cálculo e endpoints.

Em **Locações**, relacione equipamentos alugados com a obra e a empresa locadora. Cada locação reúne as cobranças recebidas, suas contas a pagar, títulos e anexos XML/PDF. A leitura do XML sugere campos para revisão antes de registrar a cobrança. Obras e fornecedores também têm uma aba de locações vinculadas. Consulte [docs/EQUIPMENT_RENTALS.md](docs/EQUIPMENT_RENTALS.md) para o fluxo, os limites dos anexos, as permissões, a migration e as APIs.

## Verificação local

```powershell
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
```

Os testes cobrem atualização condicional de saldo, recusa de estoque insuficiente, isolamento de empresa, precisão de quantidades, validação de origem, autenticação Bearer, rotação concorrente de tokens, navegação das abas internas, validação dos modelos e paginação dos relatórios. Usam transações simuladas, sem alterar o banco. A verificação completa dos fluxos financeiros deve ser feita com dados de teste em um banco separado.

## Documentos recebidos por e-mail

O módulo **Caixa de entrada** sincroniza uma pasta do Gmail/Google Workspace por empresa e mantém XMLs e PDFs para revisão. Configure a conta em **Configurações → Conexão de e-mail**. Após conferir os anexos e escolher a locação, confirme a cobrança para criar a conta a pagar e acessar o cadastro do título. A sincronização não cria lançamentos financeiros sozinha.

Consulte [o guia de integração de e-mail](docs/EMAIL_IMPORT.md) para gerar a senha de app do Google, definir o período de importação e ativar o agendamento da Vercel com `CRON_SECRET`. PDFs de notas e boletos são anexados sem OCR; o preenchimento sugerido vem de XMLs compatíveis.

## Segurança

- JWT de acesso expira em 15 minutos. O refresh token é aleatório, armazenado apenas como SHA-256 no banco e rotacionado mediante atualização condicional da sessão.
- Cookies são `HttpOnly`, `SameSite=Strict`, com `Secure` em produção. Alterações por cookie exigem origem igual ao host da aplicação.
- CNPJ, documento e dados bancários têm campos para ciphertext AES-256-GCM com IV aleatório e tag de autenticação. A chave vem do ambiente. Para buscar por documento no futuro, crie um índice de hash separado; não pesquise no ciphertext.
- A senha inicial e as senhas futuras são armazenadas como hash Argon2. A aplicação não registra tokens ou dados sensíveis em logs.
- A consulta do relatório é isolada por empresa. Valores monetários do banco usam `Decimal(18,2)` e o relatório devolve strings decimais.

## Limites atuais

Esta base **não emite NFS-e nem remessa CNAB pronta para envio**. A tabela de NFS-e armazena rascunhos internos; `ISSUED` só deve ser usado após confirmação externa, que ainda não existe. XML nacional e ABRASF exigem seleção de versão, município, regras de preenchimento, assinatura e validação contra XSD. CNAB exige banco, convênio, serviço e layout versionado. Esses adaptadores devem ser desenvolvidos e homologados antes de exportar arquivos operacionais. Não há integração direta com SEFAZ ou convênios.

O parser OFX cobre transações `STMTTRN` comuns de OFX SGML e XML. É necessário validar amostras dos bancos usados pela empresa antes de conciliar em produção. O relatório financeiro mostra acumulado desde o início dos registros, sem fechamento por competência nem ajustes contábeis. O RBT12 soma notas de serviço e vendas de mercadorias registradas, mas ainda não há fluxo de cadastro de venda de mercadorias na interface. O TXT é um extrato estruturado próprio, que exige mapeamento com o sistema do contador antes da importação. Antes de usar como escrituração oficial, complete permissões por operação, auditoria imutável, estornos, reconciliação de extratos de saída, exportação PDF no servidor, geração de contratos em arquivo, testes de integração e revisão contábil/fiscal.

## Referências oficiais

- [Documentação técnica atual da NFS-e nacional](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual)
- [Layouts FEBRABAN, incluindo CNAB 240](https://portal.febraban.org.br/pagina/3425/33/pt-br/layout-febraban)
- [Manual PGDAS-D](https://www8.receita.fazenda.gov.br/simplesnacional/arquivos/manual/manual_pgdas-d_2018_v4.pdf)
