import 'dotenv/config';
import express from "express";
import { registerRoutes } from "../../server/routes";
import serverless from 'serverless-http';

// Configuração do Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Middleware de logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      console.log(logLine);
    }
  });
  next();
});

// Configurando rotas
let serverlessHandler: any;

// Configuração assíncrona
const setup = async () => {
  // Registrar as rotas da API
  await registerRoutes(app);
  
  // Tratamento de erros
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });
  
  // Fallback para as rotas não encontradas
  app.use('*', (_req, res) => {
    res.status(404).json({ message: 'Not Found' });
  });
  
  // Criar o handler serverless
  serverlessHandler = serverless(app);
  
  return serverlessHandler;
};

// Não executamos setup() aqui - vamos fazer isso durante a primeira requisição
// para evitar problemas com o empacotamento do Netlify

// Exportar o handler para o Netlify Functions
export const handler = async (event: any, context: any) => {
  // Inicializa o servidor na primeira requisição
  if (!serverlessHandler) {
    serverlessHandler = await setup();
  }
  
  // Processar a requisição com o serverless handler
  return serverlessHandler(event, context);
};