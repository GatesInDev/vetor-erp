# Preferências pessoais

As preferências pertencem ao usuário autenticado e são persistidas na tabela `UserPreference`, vinculada a `User.id` por uma relação de um para um. A exclusão do usuário remove suas preferências. A identidade e a empresa vêm da sessão validada; o cliente não pode selecionar outro usuário ou empresa.

| Campo | Valores aceitos | Padrão |
| --- | --- | --- |
| `theme` | `light`, `dark` | `dark` |
| `locale` | `pt-BR`, `en-US` | `pt-BR` |
| `decimalPlaces` | Inteiro de 0 a 6 | `2` |
| `loadedScreenLimit` | Inteiro de 1 a 8 | `8` |

`decimalPlaces` controla somente a apresentação dos números na interface. Esta preferência não altera a precisão dos campos no banco, valores monetários persistidos, arredondamentos de cálculos, tributos ou lançamentos contábeis. Valores digitados nos formulários continuam sujeitos à precisão aceita por cada operação.

## Usar as configurações

Abra **Configurações** pelo menu lateral, pelo cartão na tela inicial ou pelo ícone de engrenagem no cabeçalho. As seções Aparência e idioma, Exibição de números e Telas mantidas em memória ficam na mesma tela. Clique em **Salvar preferências** para aplicar as escolhas. O atalho de tema no cabeçalho também salva a alteração no banco.

O idioma da interface, a formatação de datas e a apresentação de números acompanham a preferência do usuário. Português do Brasil e inglês dos Estados Unidos estão disponíveis nos módulos e formulários. Nomes de clientes, descrições e o conteúdo personalizado dos modelos de relatório são preservados. A moeda da operação continua sendo BRL; escolher inglês não faz conversão cambial. Os campos de dados já formatados pelo servidor para impressão continuam seguindo o formato documental brasileiro.

## Abas e memória

Até oito telas permanecem montadas na memória da sessão do navegador; o usuário pode reduzir esse limite para qualquer valor entre um e oito. O contador no cabeçalho mostra quantas telas estão prontas. Ao alternar entre elas, o sistema preserva filtros, seções abertas, estado dos componentes e posição de rolagem, sem uma nova consulta para abrir a tela.

Ao atingir o limite, a tela menos recentemente utilizada sai da memória. Sua aba continua disponível e o rascunho de formulário é mantido separadamente. Ao selecioná-la novamente, o conteúdo é carregado e os campos do rascunho são recuperados. Fechar uma aba com alterações pede confirmação na própria barra, sem modal.

Após gravar dados, as telas são marcadas para atualização. Telas sem alterações locais também são revalidadas ao serem reabertas depois de cinco minutos. Formulários com alterações ou operação pendente preservam seus valores. O cache e os rascunhos existem somente durante a sessão da página; recarregar ou fechar o navegador limpa essas telas, com aviso quando há alterações não salvas. As preferências salvas no banco permanecem.

## Publicação

Antes de executar uma versão que consulta as preferências, aplique a migration `20260927120000_user_preferences` no banco de destino. No PowerShell, na raiz do projeto e com `DATABASE_URL` e `DIRECT_URL` configuradas:

```powershell
npx prisma migrate deploy
npm run db:generate
npm run build
```

Em um deploy pela Vercel, aplique a migration separadamente antes de publicar a aplicação. O build gera o Prisma Client, mas não aplica migrations. Consulte [DEPLOY.md](../DEPLOY.md) para a configuração das URLs do banco.

Usuários sem registro em `UserPreference` recebem os padrões acima. O primeiro salvamento cria o registro. A leitura não grava dados.

## API

Todos os perfis autenticados podem ler e editar as próprias preferências. Os dois endpoints aceitam a sessão web por cookie ou `Authorization: Bearer <access-token>` para clientes nativos. As respostas de sucesso usam `Cache-Control: private, no-store`.

### `GET /api/settings/preferences`

Retorna as preferências atuais, sem aceitar parâmetros de consulta:

```json
{
  "preferences": {
    "theme": "dark",
    "locale": "pt-BR",
    "decimalPlaces": 2,
    "loadedScreenLimit": 8
  }
}
```

### `PATCH /api/settings/preferences`

Envie `Content-Type: application/json` e pelo menos um campo. Os campos omitidos preservam os valores atuais. Para a sessão web por cookie, o `Origin` deve corresponder à origem da aplicação. Clientes nativos com Bearer válido não precisam enviar `Origin`.

```json
{
  "theme": "light",
  "decimalPlaces": 3
}
```

A resposta tem o mesmo formato do `GET`, com todas as preferências após a atualização. O cliente deve usar os valores retornados pelo servidor.

| Status | Situação |
| --- | --- |
| `200` | Leitura ou atualização concluída |
| `400` | JSON inválido, corpo vazio, campo desconhecido, valor fora dos limites ou parâmetro de consulta não suportado |
| `401` | Sessão ou Bearer ausente, expirado ou inválido |
| `403` | Origem inválida para autenticação por cookie, ou tentativa de enviar `userId`/`companyId` no corpo ou na consulta |
| `415` | Atualização sem `Content-Type: application/json` |

Não existe endpoint para editar preferências de outro usuário. Mesmo administradores utilizam apenas a própria identidade nessa API.
