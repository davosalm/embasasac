// ESM syntax is supported in Netlify Functions
import express from 'express';
import serverless from 'serverless-http';
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

// Configuração básica do Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configuração do Turso DB
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios');
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Configuramos rotas básicas da API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando corretamente!' });
});

// Teste de conexão com o banco
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await client.execute('SELECT 1 as test');
    res.json({ 
      status: 'ok', 
      message: 'Conexão com o banco de dados estabelecida com sucesso!',
      data: result.rows
    });
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
    res.status(500).json({ status: 'error', message: 'Falha ao conectar ao banco de dados' });
  }
});

// Tratamento de erros
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Erro interno do servidor' });
});

// Exports para o Netlify Functions
export const handler = serverless(app);