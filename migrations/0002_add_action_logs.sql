-- Adicionar tabela para registrar histórico de ações
CREATE TABLE IF NOT EXISTS action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,  -- 'embasa', 'sac', 'admin'
  user_name TEXT NOT NULL,  -- Nome do usuário que realizou a ação
  action_type TEXT NOT NULL, -- 'create', 'delete', etc
  target_type TEXT NOT NULL, -- 'appointment', 'time_slot', etc
  target_id INTEGER NOT NULL,
  details TEXT,             -- Detalhes adicionais da ação (formato JSON)
  created_at INTEGER NOT NULL
);

-- Índices para melhor desempenho em consultas comuns
CREATE INDEX idx_action_logs_user ON action_logs(user_id);
CREATE INDEX idx_action_logs_user_type ON action_logs(user_type);
CREATE INDEX idx_action_logs_target ON action_logs(target_type, target_id);