// ESM syntax is supported in Netlify Functions
import express from 'express';
import serverless from 'serverless-http';
import { createClient } from "@libsql/client/web";
import cors from 'cors';

// Configuração básica do Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

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

// Middleware de autenticação básica
const authenticate = async (req, res, next) => {
  try {
    // Para simplificar, vamos usar um sistema básico de autenticação por código
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Aqui você pode implementar validação do token
      req.user = { id: parseInt(token) }; // Simplificado para exemplo
    }
    next();
  } catch (error) {
    res.status(401).json({ message: 'Não autorizado' });
  }
};

// Rotas de autenticação
app.post('/api/auth/login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Código é obrigatório' });
    }

    const result = await client.execute({
      sql: 'SELECT * FROM access_codes WHERE code = ? AND is_active = 1',
      args: [code]
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Código inválido' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      code: user.code,
      userType: user.user_type,
      userName: user.user_name,
      isActive: user.is_active,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Rota para criar agendamentos
app.post('/api/appointments', async (req, res) => {
  try {
    const { clientName, ssNumber, comments, timeSlotId, sacCodeId } = req.body;
    
    if (!clientName || !ssNumber || !timeSlotId || !sacCodeId) {
      return res.status(400).json({ message: 'Dados obrigatórios não fornecidos' });
    }

    // Verificar se o time slot ainda está disponível
    const timeSlotCheck = await client.execute({
      sql: 'SELECT is_available FROM time_slots WHERE id = ?',
      args: [timeSlotId]
    });

    if (timeSlotCheck.rows.length === 0 || !timeSlotCheck.rows[0].is_available) {
      return res.status(400).json({ message: 'Horário não disponível' });
    }

    // Criar o agendamento
    const appointmentResult = await client.execute({
      sql: `INSERT INTO appointments (time_slot_id, sac_code_id, client_name, ss_number, comments, is_confirmed, created_at) 
            VALUES (?, ?, ?, ?, ?, 0, strftime('%s', 'now'))`,
      args: [timeSlotId, sacCodeId, clientName, ssNumber, comments || null]
    });

    // Marcar time slot como indisponível
    await client.execute({
      sql: 'UPDATE time_slots SET is_available = 0 WHERE id = ?',
      args: [timeSlotId]
    });

    res.status(201).json({
      id: appointmentResult.meta.last_row_id,
      timeSlotId,
      sacCodeId,
      clientName,
      ssNumber,
      comments,
      isConfirmed: false,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Falha ao criar agendamento',
      error: error.message,
      stack: error.stack
    });
  }
});

// Rota para confirmar agendamentos
app.patch('/api/appointments/:id/confirm', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    if (isNaN(appointmentId)) {
      return res.status(400).json({ message: 'ID do agendamento inválido' });
    }

    // Verificar se o agendamento existe
    const appointmentCheck = await client.execute({
      sql: 'SELECT * FROM appointments WHERE id = ?',
      args: [appointmentId]
    });

    if (appointmentCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Agendamento não encontrado' });
    }

    // Confirmar o agendamento
    const result = await client.execute({
      sql: 'UPDATE appointments SET is_confirmed = 1, confirmed_at = strftime(\'%s\', \'now\') WHERE id = ?',
      args: [appointmentId]
    });

    res.json({
      id: appointmentId,
      isConfirmed: true,
      confirmedAt: new Date()
    });
  } catch (error) {
    console.error('Erro ao confirmar agendamento:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Rota para buscar horários disponíveis
app.get('/api/time-slots/available', async (req, res) => {
  try {
    const result = await client.execute(`
      SELECT 
        ts.*,
        ac.id as embasa_id,
        ac.code as embasa_code,
        ac.user_type as embasa_user_type,
        ac.user_name as embasa_user_name,
        ac.is_active as embasa_is_active,
        ac.created_at as embasa_created_at
      FROM time_slots ts
      JOIN access_codes ac ON ts.embasa_code_id = ac.id
      WHERE ts.is_available = 1
      ORDER BY ts.date, ts.start_time
    `);

    const timeSlots = result.rows.map(row => ({
      id: row.id,
      embasaCodeId: row.embasa_code_id,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      isAvailable: row.is_available,
      createdAt: row.created_at,
      embasa: {
        id: row.embasa_id,
        code: row.embasa_code,
        userType: row.embasa_user_type,
        userName: row.embasa_user_name,
        isActive: row.embasa_is_active,
        createdAt: row.embasa_created_at
      }
    }));

    res.json(timeSlots);
  } catch (error) {
    console.error('Erro ao buscar horários:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Rota para buscar agendamentos do SAC
app.get('/api/appointments/sac', async (req, res) => {
  try {
    const sacId = req.query.sacId;
    if (!sacId) {
      return res.status(400).json({ message: 'SAC ID é obrigatório' });
    }

    const result = await client.execute(`
      SELECT 
        a.*,
        ts.*,
        sac.user_name as sac_user_name,
        embasa.id as embasa_id,
        embasa.user_name as embasa_user_name
      FROM appointments a
      JOIN time_slots ts ON a.time_slot_id = ts.id
      JOIN access_codes sac ON a.sac_code_id = sac.id
      JOIN access_codes embasa ON ts.embasa_code_id = embasa.id
      WHERE a.sac_code_id = ?
      ORDER BY ts.date, ts.start_time
    `, [sacId]);

    const appointments = result.rows.map(row => ({
      id: row.id,
      timeSlotId: row.time_slot_id,
      sacCodeId: row.sac_code_id,
      clientName: row.client_name,
      ssNumber: row.ss_number,
      comments: row.comments,
      isConfirmed: Boolean(row.is_confirmed),
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at * 1000) : null,
      createdAt: new Date(row.created_at * 1000),
      timeSlot: {
        id: row.time_slot_id,
        embasaCodeId: row.embasa_code_id,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        isAvailable: row.is_available,
        createdAt: new Date(row.created_at * 1000),
        embasa: {
          id: row.embasa_id,
          userName: row.embasa_user_name
        }
      },
      sac: {
        userName: row.sac_user_name
      }
    }));

    res.json(appointments);
  } catch (error) {
    console.error('Erro ao buscar agendamentos do SAC:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Rota catch-all para outras rotas da API
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

// Handler para Netlify/Vercel
export const handler = serverless(app);