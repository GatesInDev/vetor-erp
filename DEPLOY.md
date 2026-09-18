# Deploy na Supabase e Vercel

Este guia usa **GitHub → Vercel** para os deploys e **Supabase PostgreSQL** para o banco. Os comandos são para PowerShell, a partir da pasta raiz do projeto. A primeira configuração leva alguns passos manuais; depois, cada push para a branch de produção gera um novo deploy na Vercel.

## 1. Criar o projeto e copiar as URLs do banco

1. Entre no [dashboard da Supabase](https://supabase.com/dashboard) e crie um projeto. Guarde a senha do banco definida na criação.
2. Abra o projeto e clique em **Connect**, na parte superior. A [documentação da Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) mostra os três modos de conexão e onde copiar cada URL.
3. Selecione **Transaction pooler** e copie a string completa para `DATABASE_URL`. É a conexão usada pelas funções serverless. Ela costuma usar o usuário `postgres.<PROJECT-REF>` e a porta `6543`, mas copie os valores exibidos no seu projeto.
4. Selecione **Direct connection** e copie a string completa para `DIRECT_URL`. É a conexão usada pelo Prisma Migrate. Ela costuma usar o usuário `postgres` e a porta `5432`.
5. Substitua `[YOUR-PASSWORD]` nas duas strings pela senha do banco. Se a senha contiver caracteres reservados de URL, como `@`, `#`, `?`, `/` ou `&`, codifique esses caracteres na URL. **Não use** a URL de API do projeto nem a chave `anon` da Supabase: este projeto se conecta diretamente ao PostgreSQL.

Para este projeto com Prisma 6, os formatos ficam assim. Os hosts e usuários abaixo são exemplos; use as strings fornecidas pelo botão **Connect**:

```dotenv
DATABASE_URL="postgresql://postgres.PROJECT_REF:SENHA_CODIFICADA@HOST_DO_POOLER:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://postgres:SENHA_CODIFICADA@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require"
```

O parâmetro `pgbouncer=true` é necessário para o Prisma no pooler de transações, que não oferece prepared statements. `connection_limit=1` limita conexões por instância serverless, e `sslmode=require` exige conexão criptografada. Veja as [limitações do modo de transação](https://supabase.com/docs/guides/database/connecting-to-postgres#transaction-mode-limitations) e as [orientações de pool da Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres#configure-your-client).

**Se a conexão direta falhar na sua máquina:** o endpoint direto normalmente requer IPv6 ou o adicional IPv4. No menu **Connect**, copie **Session pooler** para `DIRECT_URL` como alternativa em uma rede somente IPv4; esse modo usa a porta `5432` e mantém uma sessão para o comando de migração. Não coloque `pgbouncer=true` nessa URL. Consulte a [tabela de modos e IP da Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres#endpoints-and-ip-versions).

## 2. Configurar as variáveis locais

Copie o modelo:

```powershell
Copy-Item .env.example .env
```

Preencha `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `DATA_ENCRYPTION_KEY` e as quatro variáveis `INITIAL_*` em `.env`. Gere **dois valores independentes** com o comando abaixo, executado duas vezes: use um resultado para `JWT_SECRET` e o outro para `DATA_ENCRYPTION_KEY`.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

`DATA_ENCRYPTION_KEY` deve permanecer igual depois que houver dados criptografados no banco; perdê-la impede a leitura desses dados. O arquivo `.env` está no `.gitignore`: não o envie ao GitHub e não cole seu conteúdo em issues, prints ou logs.

## 3. Criar as tabelas e o primeiro administrador

Instale as dependências e aplique a migração versionada:

```powershell
npm ci
npx prisma migrate deploy
npm run db:seed
```

`npm run db:seed` executa `prisma generate` antes do seed. Assim, ele também funciona após uma instalação limpa, quando `@prisma/client` ainda não foi gerado.

O seed usa `INITIAL_COMPANY_NAME`, `INITIAL_COMPANY_TAX_ID`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` para criar a empresa, o primeiro administrador, o plano inicial de contas e o checklist mensal. Ele deve ser executado **uma vez** para essa empresa e falha se o e-mail inicial já existir. Confirme que as URLs em `.env` apontam para o projeto Supabase correto antes de executar os comandos.

`prisma migrate deploy` aplica as migrações pendentes sem criar uma nova migração; é o [comando de produção do Prisma Migrate](https://docs.prisma.io/docs/cli/migrate/deploy) usado neste projeto com Prisma 6. O comando `npm run db:migrate` do projeto usa `migrate dev` e serve para desenvolver novas alterações de schema localmente.

## 4. Enviar o código ao GitHub

O diretório ainda não foi inicializado como repositório Git. Crie um repositório **vazio** no [GitHub](https://github.com/new), sem adicionar README ou `.gitignore` pela interface, e então execute:

```powershell
git init -b main
git add .
git commit -m "Initial ERP application"
git remote add origin https://github.com/SEU_USUARIO/vetor-erp.git
git push -u origin main
```

Troque `SEU_USUARIO` e o nome do repositório pelos seus. Se você já tiver um repositório Git configurado, use a branch e o remote existentes. Antes do push, `git status --short` ajuda a conferir o que será enviado; `.env`, `.env.local`, `node_modules` e `.next` não devem aparecer.

## 5. Importar o repositório na Vercel

1. Entre no [dashboard da Vercel](https://vercel.com/dashboard), clique em **Add New → Project** (ou **New Project**) e conecte sua conta GitHub.
2. Selecione o repositório `vetor-erp` e clique em **Import**. A Vercel identifica o framework como **Next.js**. Mantenha o diretório raiz do projeto e o comando de build do `package.json` (`npm run build`).
3. Antes de clicar em **Deploy**, abra **Environment Variables** e adicione as variáveis da tabela abaixo para **Production**. Elas também podem ser editadas depois em **Project → Settings → Environment Variables**. Consulte o [guia de importação Git](https://vercel.com/docs/git) e a [documentação de variáveis de ambiente](https://vercel.com/docs/environment-variables) da Vercel.

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL **Transaction pooler** com os parâmetros mostrados acima |
| `DIRECT_URL` | URL **Direct connection** ou **Session pooler** conforme sua conectividade |
| `JWT_SECRET` | O mesmo segredo usado localmente para esta instalação |
| `DATA_ENCRYPTION_KEY` | Exatamente a mesma chave de criptografia usada no seed e na aplicação |

As variáveis `INITIAL_*` são necessárias apenas ao executar o seed. Não precisam ficar na Vercel. Não use o prefixo `NEXT_PUBLIC_` para nenhuma dessas variáveis; esse prefixo expõe o valor ao navegador.

4. Clique em **Deploy**. O build executa `prisma generate && next build`. A aplicação deve abrir no domínio fornecido pela Vercel; entre com `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` usados no seed.

Configure variáveis de **Preview** somente se também houver um banco separado para previews. Branches de preview recebem deploys automáticos, e usar o banco de produção nelas permitiria que testes alterassem dados reais. A Vercel [separa variáveis por ambiente](https://vercel.com/docs/environment-variables#environments).

## 6. Próximos deploys

Para alterações só de aplicação, faça commit e push para `main`; a integração Git da Vercel inicia o deploy automaticamente. Para alterações no `prisma/schema.prisma`, crie e revise a nova migração no ambiente de desenvolvimento, envie o arquivo da migração ao GitHub e execute `npx prisma migrate deploy` contra o banco de produção **antes** de publicar código que depende das novas tabelas/colunas. O build da Vercel gera o cliente Prisma, mas **não aplica migrações**. Esse fluxo evita executar alterações de banco concorrentemente em vários builds.

## Verificação rápida

- O deploy na Vercel terminou com **Ready** e a página `/login` abre.
- O login do administrador funciona e o dashboard abre sem erro de banco.
- O projeto Supabase mostra as tabelas `Company`, `User`, `Account`, `Project` e `_prisma_migrations` no schema público.
- Se houver falha de conexão, confira primeiro host, usuário, senha codificada, porta e modo de pool no botão **Connect** da Supabase. Em seguida, veja os logs do deploy e das funções na Vercel sem publicar os valores das variáveis.
