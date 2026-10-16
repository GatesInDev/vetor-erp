# Relatórios de planilhas financeiras

Acesse **Relatórios → Planilhas financeiras** para carregar um arquivo `.xlsx` no formato da planilha de boletos. A funcionalidade está disponível para os perfis Administrador, Contador, Financeiro e Consulta.

1. Selecione a planilha no computador.
2. Escolha a aba reconhecida: **Títulos** ou **Obras**.
3. Confira as linhas importadas e eventuais problemas apresentados na leitura.
4. Defina os filtros e a organização do relatório.
5. Clique em **Gerar relatório**.
6. Use **Imprimir / salvar PDF** para abrir a impressão do navegador. Escolha a opção de salvar como PDF para obter um arquivo.

O relatório usa os filtros aplicados na última geração. Alterar qualquer filtro exige gerar novamente antes de imprimir. As datas inicial e final incluem os dois dias.

## Títulos

O cabeçalho pode aparecer abaixo do painel de resumo. As colunas do modelo são: Nº Documento, Tipo, Categoria, Favorecido / Pagador, Data Emissão, Data Vencimento, Valor Nominal, Juros / Multa, Valor Total, Data Pagamento, Status, Forma de Pagamento e Observações.

Os filtros permitem selecionar tipo, situação informada na planilha, categoria, favorecido/pagador, forma de pagamento, período de emissão/vencimento/pagamento, faixa de valores e busca textual. O filtro de vencimento usa a data de referência escolhida e considera somente títulos em aberto. Títulos pagos, recebidos, quitados, liquidados, com data de pagamento ou cancelados não aparecem como vencidos em aberto.

Os totais de títulos a pagar e a receber somam todos os registros selecionados, incluindo situações quitadas e canceladas quando presentes no filtro. A diferença entre receber e pagar se refere a esses registros; não representa automaticamente o saldo financeiro em aberto. Para analisar somente uma situação, aplique o filtro correspondente.

O valor de cada título é conferido com a soma do valor nominal e dos juros/multa. Os cálculos monetários preservam centavos e os documentos mantêm seus zeros à esquerda.

## Obras

O modelo reconhece as colunas Nº da Obra, Nome da obra, Cliente, CNPJ do cliente, Cidade/UF, Endereço da obra, Responsável comercial, Responsável técnico, Tipo de piso, Área total (m²), Valor do contrato (R$), Data do orçamento, Data de aprovação, Início previsto, Término previsto, Status da obra e Observações.

Filtre por cliente, cidade, situação, período, faixa de valores e texto. O total desta aba representa **valores de contratos**, sem presumir que correspondam a recebíveis em aberto. As abas são analisadas separadamente, pois o modelo não define um vínculo inequívoco entre cada título e cada obra.

## Dados e formato

- A leitura e a geração acontecem no navegador. O arquivo não é enviado ao servidor nem gravado no banco de dados.
- Os dados ficam disponíveis enquanto a tela permanecer carregada. Fechar a tela, recarregar o navegador, sair da conta ou remover a tela do cache pode exigir selecionar o arquivo novamente.
- A importação não cria parceiros, obras, contas a pagar/receber ou lançamentos contábeis.
- Use `.xlsx` com até 5 MiB; arquivos antigos `.xls`, arquivos com macros ou mais de 20 abas, 10.000 linhas ou 100 colunas por aba são recusados. A leitura também limita o conteúdo descompactado a 25 MiB.
- Linhas inválidas são identificadas para conferência. Os totais do relatório incluem somente as linhas aceitas e selecionadas pelos filtros.
- Fórmulas não são executadas. Campos calculados precisam ter valores salvos pelo Excel; salve novamente a planilha se esses valores estiverem ausentes.
- Linhas e colunas ocultas ou filtros salvos no Excel não substituem os filtros desta tela. A importação considera os registros existentes na aba.

Não é necessária migração de banco de dados para habilitar esta funcionalidade.
