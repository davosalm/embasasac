// ESM syntax is supported in Netlify Functions
import express from 'express';
import serverless from 'serverless-http';
import { createClient } from "@libsql/client/web";

// Configuração básica do Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Middleware para logging de solicitações
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Body:`, req.body);
  next();
});

// Configuração do Turso DB
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios');
}

// Usando o cliente web (HTTP) em vez do nativo
const tursoUrl = process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://');
console.log(`Conectando ao Turso em: ${tursoUrl}`);

const client = createClient({
  url: tursoUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Configuramos rotas básicas da API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando corretamente!' });
});

// Teste de conexão com o banco
app.get('/api/db-test', async (req, res) => {
  try {
    console.log('Testando conexão com o banco de dados...');
    const result = await client.execute('SELECT 1 as test');
    console.log('Resultado do teste:', result.rows);
    res.json({ 
      status: 'ok', 
      message: 'Conexão com o banco de dados estabelecida com sucesso!',
      data: result.rows
    });
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Falha ao conectar ao banco de dados', 
      error: String(error),
      stack: error.stack
    });
  }
});

// Rota para verificar a estrutura da tabela access_codes
app.get('/api/db-schema', async (req, res) => {
  try {
    console.log('Verificando esquema da tabela access_codes...');
    const result = await client.execute("PRAGMA table_info('access_codes')");
    console.log('Estrutura da tabela:', result.rows);
    res.json({
      status: 'ok',
      message: 'Estrutura da tabela obtida com sucesso',
      schema: result.rows
    });
  } catch (error) {
    console.error('Erro ao verificar esquema da tabela:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao verificar esquema da tabela',
      error: String(error)
    });
  }
});

// Rota para listar todos os códigos de acesso (para debug)
app.get('/api/access-codes', async (req, res) => {
  try {
    console.log('Listando todos os códigos de acesso...');
    const result = await client.execute("SELECT * FROM access_codes");
    console.log('Códigos encontrados:', result.rows);
    res.json({
      status: 'ok',
      message: 'Códigos de acesso listados com sucesso',
      data: result.rows
    });
  } catch (error) {
    console.error('Erro ao listar códigos de acesso:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao listar códigos de acesso',
      error: String(error)
    });
  }
});

// Rota de login - implementação simplificada
app.post('/api/login', handleLogin);
app.post('/api/auth/login', handleLogin);

// Função para lidar com o login
async function handleLogin(req, res) {
  try {
    console.log('Recebendo solicitação de login:', req.body);
    const { code } = req.body;
    
    if (!code) {
      console.log('Erro: código de acesso não fornecido');
      return res.status(400).json({ message: 'Código de acesso obrigatório' });
    }
    
    console.log(`Tentativa de login com código: ${code}`);
    
    // Verificar se a tabela existe
    try {
      const tableCheck = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='access_codes'");
      console.log('Verificando existência da tabela access_codes:', tableCheck.rows);
      
      if (tableCheck.rows.length === 0) {
        console.log('A tabela access_codes não existe. Isso pode ser um problema de configuração do banco.');
        return res.status(500).json({ 
          message: 'Erro de configuração do banco de dados: tabela access_codes não existe'
        });
      }
    } catch (error) {
      console.error('Erro ao verificar a tabela access_codes:', error);
    }
    
    // Consulta o banco para verificar o código
    console.log('Executando consulta para verificar o código...');
    const result = await client.execute({
      sql: 'SELECT * FROM access_codes WHERE code = ?',
      args: [code]
    });
    
    console.log(`Resultado da consulta:`, result.rows);
    
    if (result.rows.length === 0) {
      console.log(`Código inválido: ${code}`);
      return res.status(401).json({ message: 'Código de acesso inválido' });
    }
    
    // Obter o usuário da resposta
    const user = result.rows[0];
    console.log(`Usuário encontrado:`, user);
    
    // IMPORTANTE: Verificar o campo user_type que é o campo real no banco de dados
    if (!user.user_type) {
      console.error('ERRO: O objeto de usuário não tem um campo user_type:', user);
      return res.status(500).json({ message: 'Erro de configuração do usuário no banco de dados' });
    }
    
    // Adaptar os dados para o formato esperado pelo frontend
    // Mantendo EXATAMENTE o valor de user_type como o valor de userType
    const adaptedUser = {
      ...user,
      code: code,  // Garantir que o código esteja presente
      userType: user.user_type,  // Usar SEMPRE o user_type e não outros campos
      userName: user.user_name   // Usar o user_name original do banco
    };
    
    // Remover campos que possam causar conflito
    delete adaptedUser.type; // Garantir que não há campo type
    
    console.log(`Usuário adaptado para o frontend:`, adaptedUser);
    
    // Retorna os dados do código encontrado
    console.log(`Login bem-sucedido para o código: ${code}, tipo: ${adaptedUser.userType}`);
    return res.json(adaptedUser);
  } catch (error) {
    console.error('Erro ao processar login:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor', 
      error: String(error),
      stack: error.stack 
    });
  }
}

// Tratamento de erros
app.use((err, _req, res, _next) => {
  console.error('Erro na aplicação:', err);
  res.status(500).json({ 
    message: 'Erro interno do servidor',
    error: String(err),
    stack: err.stack
  });
});

// Exports para o Netlify Functions
export const handler = serverless(app);