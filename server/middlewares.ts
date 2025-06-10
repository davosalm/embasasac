import { Request, Response, NextFunction } from 'express';
import { storage } from "./storage";

// Interface para estender o objeto Request com informações do usuário
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Middleware para verificar o token de autenticação JWT
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Obter o token de autorização do header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Autenticação necessária' });
    }
    
    // Extrair o token (que é o código de acesso em nossa implementação simplificada)
    const token = authHeader.split(' ')[1];
    
    // Verificar se o código de acesso é válido
    const user = await storage.getAccessCodeByCode(token);
    if (!user) {
      return res.status(401).json({ message: 'Token inválido' });
    }
    
    // Armazenar o usuário no objeto de requisição para uso posterior
    req.user = user;
    next();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

// Middleware para autorizar apenas tipos específicos de usuário
export const authorize = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Autenticação necessária' });
    }
    
    // Verificar se o tipo do usuário está na lista de tipos permitidos
    const userType = req.user.type || req.user.userType;
    if (!allowedTypes.includes(userType)) {
      return res.status(403).json({ message: 'Acesso não autorizado' });
    }
    
    next();
  };
};