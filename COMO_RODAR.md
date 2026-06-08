# Corá Arthaus — Como rodar o app

## Pré-requisitos
- Node.js 18+ instalado (https://nodejs.org)

---

## 1. Instalar dependências

Abra o terminal na pasta `cora-arthaus` e execute:

```bash
# Backend
cd backend
npm install

# Frontend (nova aba do terminal)
cd ../frontend
npm install
```

---

## 2. Configurar variáveis de ambiente

```bash
# Na pasta backend:
copy .env.example .env
# Edite o .env se quiser mudar porta ou chave JWT
```

---

## 3. Rodar localmente (desenvolvimento)

Abra **duas abas** do terminal:

**Aba 1 — Backend:**
```bash
cd backend
npm run dev
# Roda em http://localhost:3001
```

**Aba 2 — Frontend:**
```bash
cd frontend
npm run dev
# Roda em http://localhost:5173
```

Acesse: **http://localhost:5173**

Login inicial:
- Email: `leandro@coraarthaus.com.br`
- Senha: `admin123`

---

## 4. Primeira importação

1. Acesse **Importação** no menu lateral
2. Faça upload do `Cronograma Corá.xlsm`
3. Faça upload do `Orçamento Corá.xlsm`
4. Acesse o **Dashboard** para ver os indicadores

---

## 5. Deploy em nuvem (Railway)

1. Crie conta em https://railway.app
2. Faça build do frontend:
   ```bash
   cd frontend
   npm run build
   ```
3. No backend, sirva a pasta `frontend/dist` (já configurado para NODE_ENV=production)
4. Configure as variáveis de ambiente no Railway:
   - `PORT` (Railway injeta automaticamente)
   - `JWT_SECRET` (string aleatória segura)
   - `NODE_ENV=production`
   - `DB_PATH=./cora.db` (ou configure PostgreSQL com `DATABASE_URL`)

---

## Estrutura de arquivos

```
cora-arthaus/
├── backend/
│   ├── src/
│   │   ├── db/           schema.sql + conexão SQLite
│   │   ├── parsers/      cronogramaParser.js, orcamentoParser.js
│   │   ├── routes/       auth, importacao, dashboard, lb, cronograma, orcamento
│   │   ├── middleware/   auth.js (JWT)
│   │   └── index.js      servidor Express
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/        Dashboard, LinhaBalanco, Cronograma, Orcamento, Importacao, Login
    │   ├── components/   Layout
    │   ├── hooks/        useAuth
    │   └── api/          client axios
    └── package.json
```
