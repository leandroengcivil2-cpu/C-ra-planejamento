# Corá Arthaus — Guia de Deploy (nuvem, grátis, multi-PC)

Arquitetura: **Neon** (banco PostgreSQL) + **Render** (servidor) + **GitHub** (código).
Tudo no navegador, sem instalar nada e sem direitos de admin.

---

## PASSO 1 — Criar o banco no Neon (PostgreSQL grátis)

1. Acesse https://neon.tech e clique em **Sign up** (login com Google ou GitHub)
2. Crie um projeto: nome **cora-arthaus**, região mais próxima (ex: AWS São Paulo / us-east)
3. Após criar, o Neon mostra a **Connection string**. Algo como:
   ```
   postgresql://usuario:senha@ep-xxxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```
4. **Copie essa string inteira** — vamos usá-la em dois lugares.

---

## PASSO 2 — Subir o código para o GitHub

1. Acesse https://github.com e crie conta (se ainda não tiver)
2. Clique em **New repository**:
   - Nome: **cora-arthaus**
   - Visibilidade: **Private** (recomendado)
   - Não marque nada além disso → **Create repository**
3. Para enviar os arquivos, a forma mais simples sem Git instalado:
   - Na página do repositório vazio, clique em **"uploading an existing file"**
   - Arraste **todo o conteúdo da pasta `cora-arthaus`** (não a pasta em si, mas os arquivos de dentro: `backend/`, `frontend/`, `package.json`, `render.yaml`, etc.)
   - **NÃO** inclua: `node_modules/`, `.env`, `frontend/dist/` (o `.gitignore` já cuida disso se usar Git, mas no upload manual evite-os)
   - Clique em **Commit changes**

> Se preferir, posso te ajudar a instalar o Git portátil para automatizar isso.

---

## PASSO 3 — Criar o servidor no Render

1. Acesse https://render.com e faça **Sign up com GitHub**
2. Clique em **New +** → **Web Service**
3. Conecte e selecione o repositório **cora-arthaus**
4. Configure:
   | Campo | Valor |
   |---|---|
   | Name | cora-arthaus |
   | Region | mais próxima |
   | Branch | main |
   | Runtime | Node |
   | Build Command | `npm run build` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
5. Em **Environment Variables**, adicione:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | *(cole a connection string do Neon do Passo 1)* |
   | `JWT_SECRET` | *(qualquer texto aleatório longo)* |
6. Clique em **Create Web Service**

O Render vai instalar tudo, fazer o build e subir. Leva ~3-5 min na primeira vez.
No fim, você recebe uma URL pública tipo: `https://cora-arthaus.onrender.com`

---

## PASSO 4 — Primeiro acesso e importação

1. Abra a URL do Render no navegador (de qualquer PC)
2. Login: `leandro@coraarthaus.com.br` / senha `admin123`
3. Vá em **Importação** e suba o `Cronograma Corá.xlsm` e o `Orçamento Corá.xlsm`
4. Pronto — todos os PCs acessam a mesma URL e os mesmos dados

---

## Observações importantes

- **Plano free do Render:** o servidor "dorme" após 15 min sem uso. O primeiro acesso depois disso demora ~30-50s para acordar. Os dados **nunca** se perdem (ficam no Neon). Se isso incomodar, o upgrade para o plano pago (~US$7/mês) remove a hibernação.
- **Segurança:** troque a senha padrão assim que possível (a implementar na próxima fase — login com bcrypt).
- **Atualizações:** quando eu alterar o código, basta subir os arquivos novos no GitHub que o Render reconstrói sozinho.
