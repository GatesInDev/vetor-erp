# Modelos de relatório e documentos para impressão

Abra **Relatórios** no menu lateral ou na página inicial. O módulo contém uma biblioteca por empresa e um editor visual com papel A4/Carta, retrato ou paisagem. Não é preciso abrir um modal para editar ou emitir documentos.

## Criar uma ficha de abastecimento

1. Em **Relatórios**, escolha **Ficha de abastecimento**.
2. Defina nome e descrição. O exemplo já inclui data, veículo, placa, responsável, combustível, quantidade, hodômetro/horímetro, local, observações e assinaturas.
3. Arraste os elementos no papel. Selecione um elemento para editar suas propriedades. A alça inferior altera o tamanho; os campos de posição e dimensão usam milímetros.
4. Para movimentação por teclado, selecione o elemento e use as setas. `Shift` + seta desloca 5 mm. `Delete` remove o elemento selecionado.
5. Use **Prévia** para conferir a folha. Preencha os campos manuais ou marque **Deixar os campos manuais em branco** para preencher à mão depois de imprimir.
6. Clique em **Salvar modelo**. Na biblioteca, **Visualizar** abre a emissão do modelo salvo.
7. Clique em **Imprimir / salvar PDF**. Na janela do navegador, use escala 100%, desative cabeçalhos/rodapés do navegador e escolha a impressora ou **Salvar como PDF**.

Os valores preenchidos na emissão são temporários. Salvar o modelo grava seu desenho e a definição dos campos; não cria um lançamento de abastecimento, não baixa estoque e não mantém histórico das fichas emitidas.

## Elementos disponíveis

| Elemento | Uso |
| --- | --- |
| Texto livre | Títulos, instruções e etiquetas |
| Campo de dados | Empresa, data de emissão, número de página, campo da fonte ou preenchimento manual |
| Linha / retângulo | Separadores e contornos |
| Espaço pautado | Área com linhas para escrever depois de imprimir |
| Assinatura | Linha com identificação abaixo |
| Tabela de registros | Colunas configuráveis, largura proporcional e paginação automática |
| Tabela para preenchimento | Grade com títulos e células vazias para escrever à mão depois de imprimir |
| Imagem / logo | Arquivo PNG ou JPEG incorporado ao modelo, com proporção preservada |

Você pode adicionar campos clicando ou arrastando a paleta. **Criar campo** adiciona um campo manual de texto, número ou data; **Inserir no papel** inclui sua posição no documento. Adicione um texto livre se também quiser uma etiqueta visível no papel.

As propriedades permitem duplicar, excluir, ordenar elementos, ajustar fonte, negrito, alinhamento e contorno. A tabela permite escolher campos, títulos, ordem e peso de largura das colunas.

### Adicionar uma tabela para preenchimento manual

1. Arraste **Tabela para preenchimento** da paleta até a folha ou clique no elemento para adicioná-lo.
2. Nas propriedades, escolha de **1 a 15 linhas em branco**.
3. Edite os títulos e os pesos de largura das colunas. É possível adicionar, remover e reordenar até **8 colunas**.
4. Ajuste a posição e o tamanho. A altura se adapta para preservar pelo menos 8 mm por linha e 12 mm por coluna; títulos longos podem exigir mais espaço. A prévia bloqueia a impressão quando o conteúdo não cabe.
5. Confira a grade em **Prévia** e imprima. As células ficam vazias para escrita no papel; os títulos fazem parte do modelo salvo.

É possível usar várias tabelas para preenchimento no mesmo documento, inclusive junto da tabela de registros. Elas não dependem da fonte de dados, não são alteradas ao trocar a fonte e se repetem em cada página sem mudar a paginação dos registros.

### Adicionar uma imagem ou logo

1. Clique em **Imagem / logo** na paleta ou arraste o elemento até a folha.
2. Nas propriedades do elemento, use **Enviar imagem / logo** e escolha um PNG ou JPEG de até **512 KB**. Para preservar o fundo transparente do logo, use PNG.
3. Preencha a descrição da imagem e ajuste posição, largura e altura em milímetros, ou use a alça no papel. A imagem cabe na área definida sem distorcer nem cortar.
4. Confira em **Prévia** e clique em **Salvar modelo**. O arquivo é incorporado ao modelo e continua disponível ao reabrir, duplicar e imprimir, sem depender de um endereço externo.
5. Para trocar o arquivo, selecione o elemento e use **Substituir imagem**. Para removê-lo, use **Excluir elemento**.

As imagens podem somar até **1 MB por modelo**. O upload aceita dimensões de até **4096 × 4096 pixels**. A imagem se repete em cada página, assim como os demais elementos fixos. A prévia aguarda o carregamento das imagens e bloqueia a impressão quando algum arquivo está ausente ou não pode ser exibido. SVG, GIF, WebP e links externos não são aceitos.

## Usar dados do ERP

As fontes disponíveis são documento livre, obras, parceiros, produtos/saldos, movimentações de estoque, serviços faturados, contas a pagar e contas a receber. Trocar a fonte reconfigura os campos vinculados e as colunas da tabela; confira a prévia depois da troca.

- **Com tabela de registros:** os registros são distribuídos na área da tabela. O cabeçalho da tabela e os outros elementos do modelo se repetem em cada página.
- **Sem tabela de registros:** cada registro gera uma folha independente, mesmo quando existem tabelas para preenchimento manual. É útil para imprimir uma ficha de uma obra ou parceiro.
- **Campo avulso da fonte em relatório com tabela:** mostra o valor do primeiro registro daquela página.
- Na prévia, filtre por período/obra quando disponíveis ou selecione um registro da consulta. Aplique os filtros para atualizar a emissão.
- Períodos incluem os dois dias informados, com limites em UTC. Horários de movimentações são apresentados no fuso de Brasília.

Dados financeiros exigem perfil administrador, contabilidade, financeiro ou consulta. O perfil operações pode editar modelos, mas não consultar fontes financeiras. As consultas sempre usam a empresa da sessão; o cliente não escolhe outra empresa.

## Biblioteca, abas e edições concorrentes

Use busca e filtro de situação para localizar modelos. Você pode editar, duplicar, arquivar e reativar um modelo. Arquivamento preserva o registro.

O desenho em edição é mantido ao alternar entre abas internas. Fechar uma aba com alterações pede confirmação no próprio conteúdo. Recarregar o navegador pode perder o rascunho; salve antes de sair.

Cada modelo tem uma revisão. Se outra pessoa salvou uma alteração depois de sua abertura, a API retorna conflito e preserva o rascunho local. Confira as alterações antes de recarregar; o sistema não sobrescreve automaticamente a edição mais recente.

## Limites desta versão

- Até 80 elementos, 30 campos manuais e uma tabela de registros de até 8 colunas por modelo. Tabelas para preenchimento manual contam como elementos e podem ser repetidas, com até 15 linhas e 8 colunas cada.
- Até 500 registros por consulta e 100 páginas por emissão. Quando exceder o limite da consulta, a impressão é bloqueada; restrinja os filtros para obter um documento completo.
- Textos maiores que sua área são identificados na prévia. Aumente o elemento ou reduza a fonte. Uma linha de tabela precisa caber inteira em uma página.
- Exportação PDF pela impressão do navegador. Não há renderização PDF no servidor, importação de arquivos `.rpt`, fórmulas, agrupamentos, subtotais ou sub-relatórios nesta versão.
- Imagens PNG/JPEG de até 512 KB cada e 1 MB no conjunto do modelo. A API limita a requisição de criação/edição a 2 MB, incluindo a codificação das imagens e os demais campos.
- A prévia não salva os dados preenchidos nem gera automaticamente documentos fiscais, contratos ou movimentações de negócio.

## Instalação e API

Esta versão adiciona a migração `20260926120000_report_templates`. Em cada ambiente, antes de executar o código novo:

```powershell
npx prisma migrate deploy
npm run db:generate
```

O deploy da Vercel gera o client Prisma durante o build, mas não aplica migrações. Consulte [DEPLOY.md](../DEPLOY.md) para configurar as URLs do banco e o deploy por Git.

As rotas `/api/report-templates` e `/api/report-data` também aceitam Bearer token. O contrato e o fluxo mobile estão em [API.md](API.md). O formato validado do modelo está em `src/modules/reports/schema.ts`; o catálogo de fontes e filtros, em `src/modules/reports/sources.ts`.
