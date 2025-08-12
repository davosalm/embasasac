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
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const code = authHeader.substring(7);
      
      // Verificar se o código existe no banco
      const result = await client.execute({
        sql: 'SELECT * FROM access_codes WHERE code = ? AND is_active = 1',
        args: [code]
      });

      if (result.rows.length > 0) {
        req.user = {
          id: result.rows[0].id,
          code: result.rows[0].code,
          userType: result.rows[0].user_type,
          userName: result.rows[0].user_name
        };
      }
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
    
    console.log('Dados recebidos:', { clientName, ssNumber, comments, timeSlotId, sacCodeId });
    
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

    // Usar batch para executar múltiplas operações atomicamente
    const batch = [
      {
        sql: `INSERT INTO appointments (time_slot_id, sac_code_id, client_name, ss_number, comments, is_confirmed, created_at) 
              VALUES (?, ?, ?, ?, ?, 0, strftime('%s', 'now'))`,
        args: [timeSlotId, sacCodeId, clientName, ssNumber, comments || null]
      },
      {
        sql: 'UPDATE time_slots SET is_available = 0 WHERE id = ?',
        args: [timeSlotId]
      }
    ];

    const results = await client.batch(batch);
    
    res.status(201).json({
      id: results[0].meta.last_row_id,
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
      error: error.message
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

    console.log('Confirmando agendamento ID:', appointmentId);

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

    console.log('Agendamento confirmado:', result);

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
        ts.date as ts_date,
        ts.start_time as ts_start_time,
        ts.end_time as ts_end_time,
        ts.is_available as ts_is_available,
        ts.created_at as ts_created_at,
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
        date: row.ts_date,
        startTime: row.ts_start_time,
        endTime: row.ts_end_time,
        isAvailable: row.ts_is_available,
        createdAt: new Date(row.ts_created_at * 1000),
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

// Rota para buscar agendamentos da EMBASA
app.get('/api/appointments', authenticate, async (req, res) => {
  try {
    let whereClause = '';
    let params = [];
    
    if (req.user && req.user.userType === 'embasa') {
      whereClause = 'WHERE ts.embasa_code_id = ?';
      params = [req.user.id];
    }

    const result = await client.execute(`
      SELECT 
        a.*,
        ts.date as ts_date,
        ts.start_time as ts_start_time,
        ts.end_time as ts_end_time,
        ts.is_available as ts_is_available,
        ts.created_at as ts_created_at,
        ts.embasa_code_id as ts_embasa_code_id,
        sac.user_name as sac_user_name,
        embasa.id as embasa_id,
        embasa.user_name as embasa_user_name
      FROM appointments a
      JOIN time_slots ts ON a.time_slot_id = ts.id
      JOIN access_codes sac ON a.sac_code_id = sac.id
      JOIN access_codes embasa ON ts.embasa_code_id = embasa.id
      ${whereClause}
      ORDER BY ts.date, ts.start_time
    `, params);

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
        embasaCodeId: row.ts_embasa_code_id,
        date: row.ts_date,
        startTime: row.ts_start_time,
        endTime: row.ts_end_time,
        isAvailable: row.ts_is_available,
        createdAt: new Date(row.ts_created_at * 1000),
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
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Rota para buscar time slots da EMBASA
app.get('/api/time-slots/embasa', authenticate, async (req, res) => {
  try {
    const embasaId = req.query.embasaId || req.user?.id;
    
    if (!embasaId) {
      return res.status(400).json({ message: 'EMBASA ID é obrigatório' });
    }

    const result = await client.execute(`
      SELECT * FROM time_slots 
      WHERE embasa_code_id = ?
      ORDER BY date, start_time
    `, [embasaId]);

    const timeSlots = result.rows.map(row => ({
      id: row.id,
      embasaCodeId: row.embasa_code_id,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      isAvailable: Boolean(row.is_available),
      createdAt: new Date(row.created_at * 1000)
    }));

    res.json(timeSlots);
  } catch (error) {
    console.error('Erro ao buscar time slots da EMBASA:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Rota para criar time slots
app.post('/api/time-slots', authenticate, async (req, res) => {
  try {
    const { date, startTime } = req.body;
    
    if (!date || !startTime) {
      return res.status(400).json({ message: 'Data e horário de início são obrigatórios' });
    }

    // Calcular horário final (2 horas depois)
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + 2;
    const endTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    const result = await client.execute({
      sql: `INSERT INTO time_slots (embasa_code_id, date, start_time, end_time, is_available, created_at) 
            VALUES (?, ?, ?, ?, 1, strftime('%s', 'now'))`,
      args: [req.user.id, date, startTime, endTime]
    });

    res.status(201).json({
      id: result.meta.last_row_id,
      embasaCodeId: req.user.id,
      date,
      startTime,
      endTime,
      isAvailable: true,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Erro ao criar time slot:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Rota para excluir agendamentos
app.delete('/api/appointments/:id', authenticate, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    if (isNaN(appointmentId)) {
      return res.status(400).json({ message: 'ID do agendamento inválido' });
    }

    // Buscar detalhes do agendamento para verificar permissões
    const appointmentResult = await client.execute({
      sql: `SELECT a.*, ts.embasa_code_id, ts.id as time_slot_id
            FROM appointments a
            JOIN time_slots ts ON a.time_slot_id = ts.id
            WHERE a.id = ?`,
      args: [appointmentId]
    });

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Agendamento não encontrado' });
    }

    const appointment = appointmentResult.rows[0];

    // Verificar permissões
    if (req.user.userType === 'sac' && appointment.sac_code_id !== req.user.id) {
      return res.status(403).json({ message: 'Não autorizado' });
    }
    
    if (req.user.userType === 'embasa' && appointment.embasa_code_id !== req.user.id) {
      return res.status(403).json({ message: 'Não autorizado' });
    }

    // Usar batch para deletar agendamento e liberar time slot atomicamente
    const batch = [
      {
        sql: 'DELETE FROM appointments WHERE id = ?',
        args: [appointmentId]
      },
      {
        sql: 'UPDATE time_slots SET is_available = 1 WHERE id = ?',
        args: [appointment.time_slot_id]
      }
    ];

    await client.batch(batch);

    res.status(204).send();
  } catch (error) {
    console.error('Erro ao excluir agendamento:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Rota catch-all para outras rotas da API
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

// Handler para Netlify/Vercel
export const handler = serverless(app);