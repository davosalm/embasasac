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

// Rota para verificar a estrutura das tabelas
app.get('/api/db-schema', async (req, res) => {
  try {
    console.log('Verificando esquemas das tabelas...');
    const accessCodesSchema = await client.execute("PRAGMA table_info('access_codes')");
    const timeSlotsSchema = await client.execute("PRAGMA table_info('time_slots')");
    console.log('Estrutura da tabela access_codes:', accessCodesSchema.rows);
    console.log('Estrutura da tabela time_slots:', timeSlotsSchema.rows);
    res.json({
      status: 'ok',
      message: 'Estrutura das tabelas obtida com sucesso',
      schemas: {
        accessCodes: accessCodesSchema.rows,
        timeSlots: timeSlotsSchema.rows
      }
    });
  } catch (error) {
    console.error('Erro ao verificar esquemas das tabelas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao verificar esquemas das tabelas',
      error: String(error)
    });
  }
});

// Rota para listar todos os códigos de acesso (para admin)
app.get('/api/access-codes', async (req, res) => {
  try {
    console.log('Listando todos os códigos de acesso...');
    const result = await client.execute("SELECT * FROM access_codes");
    console.log('Códigos encontrados:', result.rows);
    
    // IMPORTANTE: Retornar diretamente o array result.rows, não o objeto encapsulado
    // Isso garante compatibilidade com o componente AdminDashboard que espera um array
    res.json(result.rows.map(row => ({
      id: row.id,
      code: row.code,
      userType: row.user_type,
      userName: row.user_name,
      isActive: row.is_active === 1
    })));
  } catch (error) {
    console.error('Erro ao listar códigos de acesso:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao listar códigos de acesso',
      error: String(error)
    });
  }
});

// Helper para serializar BigInts em JSON
const safeJsonStringify = (obj) => {
  return JSON.stringify(obj, (key, value) => {
    // Converter BigInt para string
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
};

// Middleware para lidar com serialização segura de BigInt
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(body) {
    try {
      return originalJson.call(this, body);
    } catch (error) {
      if (error.message && error.message.includes('bigint')) {
        // Se houver erro de serialização de BigInt, usar nossa função segura
        console.log('Convertendo BigInt para string na resposta');
        this.send(safeJsonStringify(body));
        return this;
      }
      throw error;
    }
  };
  next();
});

// Rota para criar um novo código de acesso (para admin)
app.post('/api/access-codes', async (req, res) => {
  try {
    const { userType, userName, isActive = true } = req.body;
    
    if (!userType || !userName) {
      return res.status(400).json({ message: 'userType e userName são obrigatórios' });
    }
    
    // Gerar um código único baseado no tipo de usuário
    const prefix = userType.toUpperCase().substring(0, 3);
    const codesResult = await client.execute("SELECT * FROM access_codes WHERE user_type = ?", [userType]);
    const codeNumber = codesResult.rows.length + 1;
    const code = `${prefix}${codeNumber.toString().padStart(3, '0')}`;
    
    // Inserir o novo código
    const result = await client.execute({
      sql: `
        INSERT INTO access_codes (code, user_type, user_name, is_active, created_at) 
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [code, userType, userName, isActive ? 1 : 0, Math.floor(Date.now() / 1000)]
    });
    
    // Obter o ID do novo código inserido (convertendo BigInt para Number)
    const insertId = Number(result.lastInsertRowid);
    
    // Retornar o código criado
    res.status(201).json({
      id: insertId,
      code,
      userType,
      userName,
      isActive
    });
  } catch (error) {
    console.error('Erro ao criar código de acesso:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao criar código de acesso',
      error: String(error)
    });
  }
});

// Rota para excluir um código de acesso (para admin)
app.delete('/api/access-codes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Verificar se o código existe
    const checkResult = await client.execute("SELECT id FROM access_codes WHERE id = ?", [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Código não encontrado' });
    }
    
    // Excluir o código
    await client.execute("DELETE FROM access_codes WHERE id = ?", [id]);
    
    res.status(204).end(); // Sucesso sem conteúdo
  } catch (error) {
    console.error('Erro ao excluir código de acesso:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao excluir código de acesso',
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

// APIS para tabela time_slots (IMPORTANTE: usar underscores, não hifens)

// Rota para listar horários disponíveis
app.get('/api/time-slots/available', async (req, res) => {
  try {
    console.log('Listando horários disponíveis...');
    const result = await client.execute(`
      SELECT ts.*, ac.user_name as embasa_name 
      FROM time_slots ts
      JOIN access_codes ac ON ts.embasa_code_id = ac.id
      WHERE ts.is_available = 1
    `);
    console.log('Horários disponíveis encontrados:', result.rows);
    
    // Mapear para o formato esperado pelo frontend
    const timeSlots = result.rows.map(row => ({
      id: row.id,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      isAvailable: row.is_available === 1,
      embasa: {
        id: row.embasa_code_id,
        userName: row.embasa_name
      }
    }));
    
    res.json(timeSlots);
  } catch (error) {
    console.error('Erro ao listar horários disponíveis:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao listar horários disponíveis',
      error: String(error)
    });
  }
});

// Rota para listar horários de uma unidade EMBASA específica
app.get('/api/time-slots/embasa', async (req, res) => {
  try {
    const embasaId = req.query.embasaId;
    if (!embasaId) {
      return res.status(400).json({ message: 'ID da unidade EMBASA é obrigatório' });
    }
    
    console.log(`Listando horários para EMBASA ID ${embasaId}...`);
    const result = await client.execute({
      sql: 'SELECT * FROM time_slots WHERE embasa_code_id = ?',
      args: [embasaId]
    });
    
    console.log('Horários encontrados:', result.rows);
    
    // Mapear para o formato esperado pelo frontend
    const timeSlots = result.rows.map(row => ({
      id: row.id,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      isAvailable: row.is_available === 1,
      embasaCodeId: row.embasa_code_id
    }));
    
    res.json(timeSlots);
  } catch (error) {
    console.error('Erro ao listar horários da EMBASA:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao listar horários da EMBASA',
      error: String(error)
    });
  }
});

// Rota para criar um novo horário
app.post('/api/time-slots', async (req, res) => {
  try {
    const { date, startTime, endTime, embasaCodeId } = req.body;
    
    console.log('Criando novo horário com dados:', req.body);
    
    if (!date || !startTime || !embasaCodeId) {
      return res.status(400).json({ 
        message: 'date, startTime e embasaCodeId são obrigatórios' 
      });
    }
    
    // Calcular endTime se não fornecido (2 horas após startTime)
    let finalEndTime = endTime;
    if (!finalEndTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const endHours = hours + 2;
      finalEndTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    // Inserir o novo horário
    console.log('Executando consulta para inserir horário...');
    const result = await client.execute({
      sql: `
        INSERT INTO time_slots (date, start_time, end_time, is_available, embasa_code_id) 
        VALUES (?, ?, ?, 1, ?)
      `,
      args: [date, startTime, finalEndTime, embasaCodeId]
    });
    
    // Obter o ID do novo horário inserido (convertendo BigInt para Number para evitar erro de serialização)
    const insertId = Number(result.lastInsertRowid);
    console.log(`Horário criado com ID: ${insertId}, tipo: ${typeof insertId}`);
    
    // Retornar o horário criado
    res.status(201).json({
      id: insertId,
      date,
      startTime,
      endTime: finalEndTime,
      isAvailable: true,
      embasaCodeId: Number(embasaCodeId)
    });
  } catch (error) {
    console.error('Erro ao criar horário:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao criar horário',
      error: String(error),
      stack: error.stack
    });
  }
});

// Rota para excluir um horário
app.delete('/api/time-slots/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Verificar se o horário existe
    const checkResult = await client.execute("SELECT id FROM time_slots WHERE id = ?", [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Horário não encontrado' });
    }
    
    // Excluir o horário
    await client.execute("DELETE FROM time_slots WHERE id = ?", [id]);
    
    res.status(204).end(); // Sucesso sem conteúdo
  } catch (error) {
    console.error('Erro ao excluir horário:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao excluir horário',
      error: String(error)
    });
  }
});

// APIs para agendamentos (appointments)

// Rota para listar todos os agendamentos
app.get('/api/appointments', async (req, res) => {
  try {
    console.log('Listando todos os agendamentos...');
    const result = await client.execute(`
      SELECT 
        a.*, 
        ts.date, ts.start_time, ts.end_time, ts.embasa_code_id,
        ac_sac.user_name as sac_name,
        ac_embasa.user_name as embasa_name
      FROM appointments a
      JOIN time_slots ts ON a.time_slot_id = ts.id
      JOIN access_codes ac_sac ON a.sac_code_id = ac_sac.id
      JOIN access_codes ac_embasa ON ts.embasa_code_id = ac_embasa.id
    `);
    
    console.log('Agendamentos encontrados:', result.rows);
    
    // Mapear para o formato esperado pelo frontend
    const appointments = result.rows.map(row => ({
      id: Number(row.id),
      clientName: row.client_name,
      ssNumber: row.ss_number,
      comments: row.comments,
      timeSlot: {
        id: Number(row.time_slot_id),
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        embasa: {
          id: Number(row.embasa_code_id),
          userName: row.embasa_name
        }
      },
      sac: {
        id: Number(row.sac_code_id),
        userName: row.sac_name
      }
    }));
    
    res.json(appointments);
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao listar agendamentos',
      error: String(error)
    });
  }
});

// Rota para listar agendamentos de um SAC específico
app.get('/api/appointments/sac', async (req, res) => {
  try {
    const sacId = req.query.sacId;
    if (!sacId) {
      return res.status(400).json({ message: 'ID do SAC é obrigatório' });
    }
    
    console.log(`Listando agendamentos para SAC ID ${sacId}...`);
    const result = await client.execute({
      sql: `
        SELECT 
          a.*, 
          ts.date, ts.start_time, ts.end_time, ts.embasa_code_id,
          ac_embasa.user_name as embasa_name
        FROM appointments a
        JOIN time_slots ts ON a.time_slot_id = ts.id
        JOIN access_codes ac_embasa ON ts.embasa_code_id = ac_embasa.id
        WHERE a.sac_code_id = ?
      `,
      args: [sacId]
    });
    
    console.log('Agendamentos encontrados:', result.rows);
    
    // Mapear para o formato esperado pelo frontend
    const appointments = result.rows.map(row => ({
      id: Number(row.id),
      clientName: row.client_name,
      ssNumber: row.ss_number,
      comments: row.comments,
      timeSlot: {
        id: Number(row.time_slot_id),
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        embasa: {
          id: Number(row.embasa_code_id),
          userName: row.embasa_name
        }
      }
    }));
    
    res.json(appointments);
  } catch (error) {
    console.error('Erro ao listar agendamentos do SAC:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao listar agendamentos do SAC',
      error: String(error)
    });
  }
});

// Rota para criar um novo agendamento
app.post('/api/appointments', async (req, res) => {
  try {
    // Aceita tanto sacId quanto sacCodeId para compatibilidade
    const { clientName, ssNumber, comments, timeSlotId, sacId, sacCodeId } = req.body;
    const finalSacId = sacId || sacCodeId; // Usa sacId se disponível, caso contrário usa sacCodeId
    
    if (!clientName || !ssNumber || !timeSlotId || !finalSacId) {
      return res.status(400).json({ 
        message: 'clientName, ssNumber, timeSlotId e sacId são obrigatórios' 
      });
    }
    
    // Verificar se o horário está disponível
    const checkSlotResult = await client.execute({
      sql: 'SELECT is_available FROM time_slots WHERE id = ?',
      args: [timeSlotId]
    });
    
    if (checkSlotResult.rows.length === 0) {
      return res.status(404).json({ message: 'Horário não encontrado' });
    }
    
    if (checkSlotResult.rows[0].is_available !== 1) {
      return res.status(400).json({ message: 'Horário não está disponível' });
    }
    
    // Iniciar uma transação
    await client.execute('BEGIN TRANSACTION');
    
    try {
      // Atualizar o status do horário para indisponível
      await client.execute({
        sql: 'UPDATE time_slots SET is_available = 0 WHERE id = ?',
        args: [timeSlotId]
      });
      
      // Inserir o novo agendamento
      const result = await client.execute({
        sql: `
          INSERT INTO appointments (client_name, ss_number, comments, time_slot_id, sac_code_id) 
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [clientName, ssNumber, comments || '', timeSlotId, finalSacId]
      });
      
      // Confirmar a transação
      await client.execute('COMMIT');
      
      // Obter o ID do novo agendamento inserido (convertendo BigInt para Number)
      const insertId = Number(result.lastInsertRowid);
      
      // Retornar o agendamento criado
      res.status(201).json({
        id: insertId,
        clientName,
        ssNumber,
        comments: comments || '',
        timeSlotId: Number(timeSlotId),
        sacCodeId: Number(finalSacId)
      });
    } catch (error) {
      // Em caso de erro, reverter a transação
      await client.execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Falha ao criar agendamento',
      error: String(error),
      stack: error.stack
    });
  }
});

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