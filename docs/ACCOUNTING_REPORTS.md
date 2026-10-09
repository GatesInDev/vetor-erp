# Balanço patrimonial e balancete

Abra **Relatórios → Balanço patrimonial** ou **Relatórios → Balancete**. As telas também estão disponíveis no menu lateral. Administradores, contadores, usuários do financeiro e usuários de consulta podem gerar os demonstrativos da própria empresa.

Os demonstrativos usam exclusivamente o plano de contas e os lançamentos contábeis registrados no ERP. Gerar ou imprimir um relatório não cria lançamentos nem altera saldos.

## Balanço patrimonial

1. Informe a **data de referência**.
2. Clique em **Gerar demonstrativo**.
3. Confira as contas e os totais de Ativo, Passivo e Patrimônio Líquido.
4. Use **Imprimir / salvar PDF** para imprimir ou exportar pelo navegador.

O relatório acumula os lançamentos até o fim da data selecionada. As contas seguem os grupos cadastrados no plano de contas. Saldos negativos são preservados, inclusive em contas redutoras ou com saldo de natureza contrária.

O resultado ainda presente nas contas de receita, custo e despesa aparece separadamente como **resultado não encerrado**, integrando o total do patrimônio líquido. Quando houver lançamentos reais de encerramento transferindo esses valores para patrimônio líquido, os respectivos saldos de resultado serão reduzidos; o relatório não simula lançamentos de encerramento.

A conferência compara **Ativo** com **Passivo + Patrimônio Líquido, incluindo resultado não encerrado** e apresenta a diferença encontrada.

## Balancete

1. Informe as datas inicial e final.
2. Clique em **Gerar demonstrativo**.
3. Confira, por conta, o saldo inicial, os débitos e créditos do período e o saldo final.
4. Use a impressão do navegador para salvar em PDF.

O saldo inicial inclui os lançamentos anteriores à data inicial. Os movimentos incluem as duas datas informadas. Saldos devedores e credores são identificados na apresentação. Os totais permitem conferir a igualdade entre débitos e créditos e entre saldos devedores e credores.

Contas inativas com histórico continuam fazendo parte do cálculo. A opção de ocultar contas sem saldo ou movimento modifica apenas a apresentação.

## Datas, precisão e interpretação

- O recorte usa a data contábil `JournalEntry.occurredAt`, com início às 00:00 UTC e limite exclusivo às 00:00 UTC do dia seguinte ao final informado.
- Todos os cálculos usam valores decimais. A API retorna strings com duas casas decimais; estes demonstrativos também exibem duas casas para permitir a conferência dos totais, independentemente da preferência geral de exibição.
- A posição financeira deriva dos lançamentos existentes, não apenas da situação de notas, boletos ou contas a pagar/receber. Alterar metadados de um título não altera a contabilidade.
- Os relatórios refletem a cobertura do razão disponível. Saldos de abertura, capital, despesas e ajustes precisam estar registrados para compor uma posição completa.
- O plano de contas atual informa os grupos de Ativo, Passivo, Patrimônio Líquido, Receita, Custo e Despesa. Não há classificação específica de circulante/não circulante, comparativo de exercício, notas explicativas ou assinatura profissional nesta versão.

O CFC apresenta a estrutura do balanço com Ativo, Passivo e Patrimônio Líquido e suas subdivisões. O relatório do ERP utiliza os grupos que existem no cadastro atual; uma demonstração para entrega formal depende da classificação e revisão contábil aplicáveis à empresa. [Referência do CFC](https://cfc.org.br/tecnica/perguntas-frequentes/nova-estrutura-do-balanco/).

## API

As rotas aceitam sessão web ou `Authorization: Bearer <accessToken>` e usam a empresa da sessão. Respostas de sucesso são privadas e não devem ser armazenadas em cache compartilhado.

### `GET /api/reports/balance-sheet?asOf=2026-09-30`

Retorna empresa, data de referência, contas e totais por grupo, resultado não encerrado e conferência do balanço. Sem `asOf`, utiliza a data atual em UTC.

### `GET /api/reports/trial-balance?from=2026-09-01&to=2026-09-30`

Retorna empresa, período, linhas com saldos inicial/final e movimentos, totais e resultado da conferência. Sem datas, utiliza o primeiro dia do mês atual e a data atual em UTC.

Datas inválidas, período invertido e parâmetros desconhecidos ou repetidos são rejeitados. Não é permitido selecionar outra empresa por parâmetro. A leitura reúne as contas e as somas dos lançamentos na mesma transação com isolamento de leitura consistente.

Os dois demonstrativos reutilizam as tabelas existentes e não exigem uma nova migration.
