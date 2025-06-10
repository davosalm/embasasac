import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccessCodeSchema, insertTimeSlotSchema, insertAppointmentSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Código é obrigatório" });
      }

      const accessCode = await storage.getAccessCodeByCode(code);
      if (!accessCode) {
        return res.status(401).json({ message: "Código inválido" });
      }

      res.json(accessCode);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Access Codes Management (Admin only)
  app.get("/api/access-codes", async (req, res) => {
    try {
      const codes = await storage.getAllAccessCodes();
      res.json(codes);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/access-codes", async (req, res) => {
    try {
      const validatedData = insertAccessCodeSchema.parse(req.body);
      
      // Generate unique code
      const prefix = validatedData.userType.toUpperCase().substring(0, 3);
      const existingCodes = await storage.getAllAccessCodes();
      const codeNumber = existingCodes.filter(c => c.code.startsWith(prefix)).length + 1;
      const code = `${prefix}${codeNumber.toString().padStart(3, '0')}`;
      
      const accessCode = await storage.createAccessCode({
        ...validatedData,
        code
      });
      
      res.status(201).json(accessCode);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.delete("/api/access-codes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAccessCode(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Time Slots Management (EMBASA users)
  app.get("/api/time-slots/available", async (req, res) => {
    try {
      const timeSlots = await storage.getAvailableTimeSlots();
      res.json(timeSlots);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Get time slots for current EMBASA user (without ID parameter)
  app.get("/api/time-slots/embasa", async (req, res) => {
    try {
      const embasaId = parseInt(req.query.embasaId as string);
      if (!embasaId) {
        return res.status(400).json({ message: "ID do usuário EMBASA é obrigatório" });
      }
      const timeSlots = await storage.getTimeSlotsByEmbasaId(embasaId);
      res.json(timeSlots);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/time-slots/embasa/:embasaId", async (req, res) => {
    try {
      const embasaId = parseInt(req.params.embasaId);
      const timeSlots = await storage.getTimeSlotsByEmbasaId(embasaId);
      res.json(timeSlots);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/time-slots", async (req, res) => {
    try {
      const { date, startTime, embasaCodeId } = req.body;
      
      // Calculate end time (2 hours later)
      const [hours, minutes] = startTime.split(':').map(Number);
      const endHours = hours + 2;
      const endTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      const validatedData = insertTimeSlotSchema.parse({
        date,
        startTime,
        endTime,
        embasaCodeId,
        isAvailable: true
      });
      
      const timeSlot = await storage.createTimeSlot(validatedData);
      res.status(201).json(timeSlot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.delete("/api/time-slots/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTimeSlot(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Appointments (SAC users)
  app.get("/api/appointments/sac", async (req, res) => {
    try {
      const sacId = parseInt(req.query.sacId as string);
      if (!sacId) {
        return res.status(400).json({ message: "ID do usuário SAC é obrigatório" });
      }
      const appointments = await storage.getAppointmentsBySacId(sacId);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/appointments/sac/:sacId", async (req, res) => {
    try {
      const sacId = parseInt(req.params.sacId);
      const appointments = await storage.getAppointmentsBySacId(sacId);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/appointments", async (req, res) => {
    try {
      const appointments = await storage.getAllAppointments();
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      const validatedData = insertAppointmentSchema.parse(req.body);
      
      // Check if time slot is still available
      const timeSlot = await storage.getTimeSlotById(validatedData.timeSlotId);
      if (!timeSlot || !timeSlot.isAvailable) {
        return res.status(400).json({ message: "Horário não disponível" });
      }
      
      const appointment = await storage.createAppointment(validatedData);
      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
