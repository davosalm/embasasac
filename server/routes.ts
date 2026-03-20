import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticate, authorize } from "./middlewares";
import { insertAccessCodeSchema, insertTimeSlotSchema, insertAppointmentSchema, appointments, timeSlots } from "@shared/schema";
import { z } from "zod";
import { db } from "./db.js";
import { eq } from "drizzle-orm";

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
  app.get("/api/access-codes", authenticate, authorize(['admin']), async (req, res) => {
    try {
      const codes = await storage.getAllAccessCodes();
      res.json(codes);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/access-codes", authenticate, authorize(['admin']), async (req, res) => {
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

  app.delete("/api/access-codes/:id", authenticate, authorize(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAccessCode(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Time Slots Management (EMBASA users)
  // This route is accessible to both SAC and EMBASA users for different purposes
  app.get("/api/time-slots/available", authenticate, authorize(['sac', 'embasa', 'admin']), async (req, res) => {
    try {
      const includePast = req.query.includePast === 'true';
      const timeSlots = await storage.getAvailableTimeSlots(includePast);
      res.json(timeSlots);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Get past time slots
  app.get("/api/time-slots/past", authenticate, authorize(['sac', 'embasa', 'admin']), async (req, res) => {
    try {
      const timeSlots = await storage.getPastTimeSlots();
      res.json(timeSlots);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Get time slots for current EMBASA user (without ID parameter)
  app.get("/api/time-slots/embasa", authenticate, authorize(['embasa', 'admin']), async (req, res) => {
    try {
      // If admin is accessing, they should provide an embasaId
      // If embasa user is accessing, use their own ID
      let embasaId: number;
      if (req.user.type === 'admin') {
        embasaId = parseInt(req.query.embasaId as string);
        if (!embasaId) {
          return res.status(400).json({ message: "ID do usuário EMBASA é obrigatório para admin" });
        }
      } else {
        embasaId = req.user.id;
      }
      
      const timeSlots = await storage.getTimeSlotsByEmbasaId(embasaId);
      res.json(timeSlots);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/time-slots/embasa/:embasaId", authenticate, authorize(['embasa', 'admin']), async (req, res) => {
    try {
      // Check if the user is an embasa user and only allow them to access their own slots
      if (req.user.type === 'embasa' && req.user.id !== parseInt(req.params.embasaId)) {
        return res.status(403).json({ message: "Acesso não autorizado a slots de outra unidade EMBASA" });
      }
      
      const embasaId = parseInt(req.params.embasaId);
      const timeSlots = await storage.getTimeSlotsByEmbasaId(embasaId);
      res.json(timeSlots);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/time-slots", authenticate, authorize(['embasa']), async (req, res) => {
    try {
      const { date, startTime } = req.body;
      
      // Validate input
      if (!date || !startTime) {
        return res.status(400).json({ message: "Data e horário são obrigatórios" });
      }
      
      // Use the current embasa user's ID directly
      const embasaCodeId = req.user.id;
      
      if (!embasaCodeId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Formato de data inválido. Use YYYY-MM-DD" });
      }
      
      // Validate time format (HH:MM)
      if (!/^\d{2}:\d{2}$/.test(startTime)) {
        return res.status(400).json({ message: "Formato de horário inválido. Use HH:MM" });
      }
      
      // Calculate end time (2 hours later)
      const [hours, minutes] = startTime.split(':').map(Number);
      
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return res.status(400).json({ message: "Horário inválido" });
      }
      
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
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating time slot:", error);
      res.status(500).json({ message: "Erro interno do servidor", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Batch create time slots
  app.post("/api/time-slots/batch", authenticate, authorize(['embasa']), async (req, res) => {
    try {
      const { startDate, endDate, times, daysOfWeek, embasaCodeId } = req.body;
      
      // Validate input
      if (!startDate || !endDate || !times || !daysOfWeek) {
        return res.status(400).json({ message: "startDate, endDate, times e daysOfWeek são obrigatórios" });
      }
      
      if (!Array.isArray(times) || times.length === 0) {
        return res.status(400).json({ message: "times deve ser um array não vazio" });
      }
      
      if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
        return res.status(400).json({ message: "daysOfWeek deve ser um array não vazio" });
      }
      
      // Use the current embasa user's ID (ignore embasaCodeId from request for security)
      const userId = req.user.id;
      
      // Parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        return res.status(400).json({ message: "Data inicial deve ser anterior à data final" });
      }
      
      // Generate all dates in range
      const createdSlots = [];
      let currentDate = new Date(start);
      
      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        
        // Check if this day of week is selected (0=Sunday, 1=Monday, etc.)
        if (daysOfWeek.includes(dayOfWeek)) {
          const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
          
          // Create a time slot for each time
          for (const time of times) {
            // Validate time format
            if (!/^\d{2}:\d{2}$/.test(time)) {
              return res.status(400).json({ message: `Formato de horário inválido: ${time}. Use HH:MM` });
            }
            
            const [hours, minutes] = time.split(':').map(Number);
            
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              return res.status(400).json({ message: `Horário inválido: ${time}` });
            }
            
            // Calculate end time (2 hours later)
            const endHours = hours + 2;
            const endTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            
            try {
              const validatedData = insertTimeSlotSchema.parse({
                date: dateString,
                startTime: time,
                endTime: endTime,
                embasaCodeId: userId,
                isAvailable: true
              });
              
              const timeSlot = await storage.createTimeSlot(validatedData);
              createdSlots.push(timeSlot);
            } catch (error) {
              console.error(`Erro ao criar horário para ${dateString} às ${time}:`, error);
              // Continue creating other slots even if one fails
            }
          }
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      if (createdSlots.length === 0) {
        return res.status(400).json({ message: "Nenhum horário foi criado. Verifique os dados e tente novamente." });
      }
      
      res.status(201).json({
        message: `${createdSlots.length} horários criados com sucesso`,
        count: createdSlots.length,
        slots: createdSlots
      });
    } catch (error) {
      console.error("Error creating batch time slots:", error);
      res.status(500).json({ message: "Erro interno do servidor", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/time-slots/:id", authenticate, authorize(['embasa']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Make sure embasa user can only delete their own time slots
      const timeSlot = await storage.getTimeSlotById(id);
      if (!timeSlot) {
        return res.status(404).json({ message: "Horário não encontrado" });
      }
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      if (timeSlot.embasaCodeId !== req.user.id) {
        return res.status(403).json({ message: "Não autorizado a excluir horários de outra unidade EMBASA" });
      }
      
      // Allow deletion of occupied slots too
      await storage.deleteTimeSlot(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting time slot:", error);
      res.status(500).json({ message: "Erro interno do servidor", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Bulk delete time slots
  app.post("/api/time-slots/bulk-delete", authenticate, authorize(['embasa']), async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs inválidos" });
      }
      
      // Verify all slots belong to current user
      const slots = await Promise.all(ids.map(id => storage.getTimeSlotById(id)));
      
      for (const slot of slots) {
        if (!slot) {
          return res.status(404).json({ message: "Um ou mais horários não encontrados" });
        }
        if (slot.embasaCodeId !== req.user.id) {
          return res.status(403).json({ message: "Não autorizado a excluir horários de outra unidade EMBASA" });
        }
      }
      
      // Delete all slots
      let deletedCount = 0;
      for (const id of ids) {
        try {
          await storage.deleteTimeSlot(id);
          deletedCount++;
        } catch (error) {
          console.error(`Erro ao deletar horário ${id}:`, error);
        }
      }
      
      res.status(200).json({ message: `${deletedCount} horários deletados`, deletedCount });
    } catch (error) {
      console.error("Error bulk deleting time slots:", error);
      res.status(500).json({ message: "Erro interno do servidor", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Appointments (SAC users)
  app.post("/api/appointments", authenticate, authorize(['sac']), async (req, res) => {
    try {
      const { clientName, ssNumber, comments, timeSlotId } = req.body;
      
      const validatedData = insertAppointmentSchema.parse({
        clientName,
        ssNumber,
        comments,
        timeSlotId,
        sacCodeId: req.user.id
      });
      
      const appointment = await storage.createAppointment(validatedData);
      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Confirm appointment (EMBASA users)
  app.patch("/api/appointments/:id/confirm", authenticate, authorize(['embasa']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get appointment to verify if it belongs to this EMBASA unit
      const appointments = await storage.getAllAppointments();
      const appointment = appointments.find(apt => apt.id === id);
      
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }
      
      // Verify if the appointment is for this EMBASA unit
      if (appointment.timeSlot.embasa.id !== req.user.id) {
        return res.status(403).json({ message: "Não autorizado a confirmar agendamentos de outra unidade" });
      }
      
      const confirmedAppointment = await storage.confirmAppointment(id);
      res.json(confirmedAppointment);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Get appointments
  app.get("/api/appointments", authenticate, authorize(['admin']), async (req, res) => {
    try {
      const appointments = await storage.getAllAppointments();
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/appointments/sac", authenticate, authorize(['sac']), async (req, res) => {
    try {
      const appointments = await storage.getAppointmentsBySacId(req.user.id);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/appointments/sac", authenticate, authorize(['sac', 'admin']), async (req, res) => {
    try {
      // If admin is accessing, they should provide a sacId
      // If sac user is accessing, use their own ID
      let sacId: number;
      if (req.user.type === 'admin') {
        sacId = parseInt(req.query.sacId as string);
        if (!sacId) {
          return res.status(400).json({ message: "ID do usuário SAC é obrigatório para admin" });
        }
      } else {
        sacId = req.user.id;
      }
      
      const appointments = await storage.getAppointmentsBySacId(sacId);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/appointments/sac/:sacId", authenticate, authorize(['sac', 'admin']), async (req, res) => {
    try {
      // Check if the user is a sac user and only allow them to access their own appointments
      if (req.user.type === 'sac' && req.user.id !== parseInt(req.params.sacId)) {
        return res.status(403).json({ message: "Acesso não autorizado a agendamentos de outro SAC" });
      }
      
      const sacId = parseInt(req.params.sacId);
      const appointments = await storage.getAppointmentsBySacId(sacId);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/appointments", authenticate, authorize(['embasa', 'admin']), async (req, res) => {
    try {
      const appointments = await storage.getAllAppointments();
      
      // Filter appointments if user is embasa (they should only see appointments for their unit)
      if (req.user.type === 'embasa') {
        const embasaId = req.user.id;
        const filteredAppointments = appointments.filter(
          appointment => appointment.timeSlot.embasaCodeId === embasaId
        );
        return res.json(filteredAppointments);
      }
      
      // Admin can see all appointments
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/appointments", authenticate, authorize(['sac']), async (req, res) => {
    try {
      // Use the current SAC user's ID
      const sacCodeId = req.user.id;
      
      const validatedData = insertAppointmentSchema.parse({
        ...req.body,
        sacCodeId
      });
      
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

  // Delete appointment route
  app.delete("/api/appointments/:id", authenticate, authorize(['embasa', 'sac', 'admin']), async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      
      // Get appointment details first
      const appointments = await storage.getAllAppointments();
      const appointment = appointments.find(apt => apt.id === appointmentId);
      
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }
      
      // Check permissions
      if (req.user.type === 'sac' && appointment.sacCodeId !== req.user.id) {
        return res.status(403).json({ message: "Não autorizado a excluir agendamentos de outro SAC" });
      }
      
      if (req.user.type === 'embasa' && appointment.timeSlot.embasa.id !== req.user.id) {
        return res.status(403).json({ message: "Não autorizado a excluir agendamentos de outra unidade EMBASA" });
      }
      
      // Delete appointment and make time slot available again
      await db.delete(appointments).where(eq(appointments.id, appointmentId));
      await db.update(timeSlots)
        .set({ isAvailable: true })
        .where(eq(timeSlots.id, appointment.timeSlotId));
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting appointment:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
