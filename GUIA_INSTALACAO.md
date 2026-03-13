# Guia de Instalação e Deployment - EmbasaSAC v5

## 🚀 Instalação Local

### 1. Clonar/Extrair Projeto
```bash
unzip embasasac-v5-final-corrigido.zip
cd embasasac-project
```

### 2. Configurar Credenciais
```bash
cp .env.example .env
```

Edite `.env` e adicione suas credenciais do TURSO:
```env
TURSO_DATABASE_URL=libsql://seu-database.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=seu-token-aqui
```

### 3. Instalar Dependências
```bash
npm install
```

### 4. Rodar em Desenvolvimento
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

---

## 🏗️ Build para Produção

### Build Local
```bash
npm run build
```

Isso irá:
1. Compilar o React/TypeScript com Vite
2. Compilar o servidor Node.js com esbuild
3. Gerar arquivos em `dist/`

### Verificar Build
```bash
# Ver tamanho dos arquivos
ls -lh dist/

# Esperado:
# - dist/public/ (frontend)
# - dist/index.js (servidor)
```

---

## 🌐 Deployment no Netlify

### 1. Conectar Repositório
1. Faça push do projeto para GitHub
2. Vá para https://app.netlify.com
3. Clique "New site from Git"
4. Selecione seu repositório

### 2. Configurar Variáveis de Ambiente
No Netlify Dashboard:
1. Site settings → Environment
2. Adicione as variáveis:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`

### 3. Deploy Automático
Netlify irá:
1. Executar `npm install`
2. Executar `npm run build`
3. Publicar `dist/public/`
4. Configurar funções serverless em `netlify/functions/`

---

## ⚙️ Configuração do Netlify (netlify.toml)

O arquivo `netlify.toml` já está configurado com:

```toml
[build]
  command = "npm run build"
  publish = "dist/public"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 🔍 Troubleshooting

### Erro: "vite: not found"
**Solução**: Instale as dependências
```bash
npm install
```

### Erro: "TURSO_AUTH_TOKEN not found"
**Solução**: Configure o arquivo `.env`
```bash
cp .env.example .env
# Edite .env com suas credenciais
```

### Erro: "Build failed"
**Solução**: Verifique o log completo
```bash
npm run build 2>&1 | head -100
```

### Erro: "Port 5173 already in use"
**Solução**: Use outra porta
```bash
npm run dev -- --port 3000
```

---

## 📝 Variáveis de Ambiente

### Desenvolvimento (.env)
```env
TURSO_DATABASE_URL=libsql://seu-database.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=seu-token-aqui
```

### Produção (Netlify)
Adicione as mesmas variáveis no Netlify Dashboard:
- Site settings → Environment

**Nunca** commit `.env` com credenciais reais!

---

## 🧪 Testes Antes de Deploy

### 1. Build Local
```bash
npm run build
```
✅ Deve completar sem erros

### 2. Verificar Arquivos
```bash
ls -lh dist/
```
✅ Deve ter `dist/public/` e `dist/index.js`

### 3. Testar Localmente
```bash
npm run dev
```
✅ Deve abrir em http://localhost:5173

### 4. Testar Funcionalidades
- [ ] Login funciona
- [ ] Criar horários funciona
- [ ] Deletar horários funciona
- [ ] Exclusão em massa funciona
- [ ] Agendamentos funcionam

---

## 📊 Estrutura de Arquivos Gerados

```
dist/
├── public/
│   ├── index.html
│   ├── assets/
│   │   ├── index-*.css
│   │   └── index-*.js
│   └── favicon.ico
└── index.js (servidor Node.js)
```

---

## 🔐 Segurança

### ✅ Checklist de Segurança

- [ ] `.env` não está commitado (verificar `.gitignore`)
- [ ] Credenciais não estão no código
- [ ] `.env.example` existe como template
- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] HTTPS habilitado (automático no Netlify)
- [ ] Validação de entrada implementada
- [ ] Autenticação obrigatória

---

## 📈 Performance

### Tamanhos de Build
- Frontend: ~495 KB (147 KB gzip)
- Servidor: ~30 KB

### Otimizações Implementadas
- ✅ Code splitting automático (Vite)
- ✅ CSS minificado
- ✅ JavaScript minificado
- ✅ Gzip compression

---

## 🚨 Logs e Debugging

### Logs Locais
```bash
npm run dev
# Logs aparecem no console
```

### Logs no Netlify
1. Vá para Netlify Dashboard
2. Clique no seu site
3. Vá para "Deploys"
4. Clique no deploy
5. Vá para "Deploy log"

---

## 🔄 Atualizar Código

### Atualizar no Repositório
```bash
git add .
git commit -m "Atualizar código"
git push origin main
```

Netlify irá automaticamente:
1. Detectar o push
2. Executar build
3. Fazer deploy

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique o `.env` está configurado
2. Verifique as dependências estão instaladas
3. Verifique o log de build
4. Verifique as variáveis de ambiente no Netlify

---

**Data**: 13 de Março de 2026  
**Versão**: 5.0  
**Status**: ✅ Testado e Pronto para Deploy
