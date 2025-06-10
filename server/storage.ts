import { 
  accessCodes, 
  timeSlots, 
  appointments,
  type AccessCode, 
  type TimeSlot, 
  type Appointment,
  type InsertAccessCode,
  type InsertTimeSlot,
  type InsertAppointment,
  type TimeSlotWithEmbasa,
  type AppointmentWithDetails
} from "@shared/schema";
import { db, client } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Access Codes
  getAccessCodeByCode(code: string): Promise<AccessCode | undefined>;
  createAccessCode(data: InsertAccessCode & { code: string }): Promise<AccessCode>;
  getAllAccessCodes(): Promise<AccessCode[]>;
  deleteAccessCode(id: number): Promise<void>;
  
  // Time Slots
  createTimeSlot(data: InsertTimeSlot): Promise<TimeSlot>;
  getTimeSlotsByEmbasaId(embasaCodeId: number): Promise<TimeSlot[]>;
  getAvailableTimeSlots(): Promise<TimeSlotWithEmbasa[]>;
  getTimeSlotById(id: number): Promise<TimeSlot | undefined>;
  deleteTimeSlot(id: number): Promise<void>;
  
  // Appointments
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  getAppointmentsBySacId(sacCodeId: number): Promise<AppointmentWithDetails[]>;
  getAllAppointments(): Promise<AppointmentWithDetails[]>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeAdminUser();
  }

  private async initializeAdminUser() {
    try {
      // First create the tables if they don't exist
      await this.createTables();
      
      const existing = await db.select().from(accessCodes).where(eq(accessCodes.code, "ADMEMB8")).limit(1);
      if (existing.length === 0) {
        await db.insert(accessCodes).values({
          code: "ADMEMB8",
          userType: "admin",
          userName: "Administrador",
          isActive: true,
        });
        console.log("Admin user ADMEMB8 created successfully");
      }
    } catch (error) {
      console.error("Error initializing admin user:", error);
    }
  }

  private async createTables() {
    try {
      // Create access_codes table
      await client.execute(`CREATE TABLE IF NOT EXISTS access_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        user_type TEXT NOT NULL,
        user_name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
      )`);

      // Create time_slots table
      await client.execute(`CREATE TABLE IF NOT EXISTS time_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        embasa_code_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        is_available INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
        FOREIGN KEY (embasa_code_id) REFERENCES access_codes(id)
      )`);

      // Create appointments table
      await client.execute(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        time_slot_id INTEGER NOT NULL,
        sac_code_id INTEGER NOT NULL,
        client_name TEXT NOT NULL,
        ss_number TEXT NOT NULL,
        comments TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
        FOREIGN KEY (time_slot_id) REFERENCES time_slots(id),
        FOREIGN KEY (sac_code_id) REFERENCES access_codes(id)
      )`);
      
      console.log("Database tables created successfully");
    } catch (error) {
      console.error("Error creating tables:", error);
    }
  }

  async getAccessCodeByCode(code: string): Promise<AccessCode | undefined> {
    const result = await db.select().from(accessCodes)
      .where(and(eq(accessCodes.code, code), eq(accessCodes.isActive, true)))
      .limit(1);
    return result[0] || undefined;
  }

  async createAccessCode(data: InsertAccessCode & { code: string }): Promise<AccessCode> {
    const [result] = await db.insert(accessCodes).values({
      code: data.code,
      userType: data.userType,
      userName: data.userName,
      isActive: data.isActive ?? true,
    }).returning();
    return result;
  }

  async getAllAccessCodes(): Promise<AccessCode[]> {
    return await db.select().from(accessCodes)
      .where(eq(accessCodes.isActive, true));
  }

  async deleteAccessCode(id: number): Promise<void> {
    await db.update(accessCodes)
      .set({ isActive: false })
      .where(eq(accessCodes.id, id));
  }

  async createTimeSlot(data: InsertTimeSlot): Promise<TimeSlot> {
    const [result] = await db.insert(timeSlots).values({
      embasaCodeId: data.embasaCodeId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      isAvailable: data.isAvailable ?? true,
    }).returning();
    return result;
  }

  async getTimeSlotsByEmbasaId(embasaCodeId: number): Promise<TimeSlot[]> {
    return await db.select().from(timeSlots)
      .where(eq(timeSlots.embasaCodeId, embasaCodeId));
  }

  async getAvailableTimeSlots(): Promise<TimeSlotWithEmbasa[]> {
    const result = await db.select({
      id: timeSlots.id,
      embasaCodeId: timeSlots.embasaCodeId,
      date: timeSlots.date,
      startTime: timeSlots.startTime,
      endTime: timeSlots.endTime,
      isAvailable: timeSlots.isAvailable,
      createdAt: timeSlots.createdAt,
      embasa: {
        id: accessCodes.id,
        code: accessCodes.code,
        userType: accessCodes.userType,
        userName: accessCodes.userName,
        isActive: accessCodes.isActive,
        createdAt: accessCodes.createdAt,
      }
    })
    .from(timeSlots)
    .innerJoin(accessCodes, eq(timeSlots.embasaCodeId, accessCodes.id))
    .where(eq(timeSlots.isAvailable, true));
    
    return result.map(row => ({
      ...row,
      embasa: row.embasa
    }));
  }

  async getTimeSlotById(id: number): Promise<TimeSlot | undefined> {
    const result = await db.select().from(timeSlots)
      .where(eq(timeSlots.id, id))
      .limit(1);
    return result[0] || undefined;
  }

  async deleteTimeSlot(id: number): Promise<void> {
    await db.delete(timeSlots).where(eq(timeSlots.id, id));
  }

  async createAppointment(data: InsertAppointment): Promise<Appointment> {
    const [result] = await db.insert(appointments).values({
      timeSlotId: data.timeSlotId,
      sacCodeId: data.sacCodeId,
      clientName: data.clientName,
      ssNumber: data.ssNumber,
      comments: data.comments ?? null,
    }).returning();
    
    // Mark time slot as unavailable
    await db.update(timeSlots)
      .set({ isAvailable: false })
      .where(eq(timeSlots.id, data.timeSlotId));
    
    return result;
  }

  async getAppointmentsBySacId(sacCodeId: number): Promise<AppointmentWithDetails[]> {
    const appointmentResults = await db.select().from(appointments)
      .where(eq(appointments.sacCodeId, sacCodeId));
    
    const results: AppointmentWithDetails[] = [];
    
    for (const appointment of appointmentResults) {
      const [timeSlot] = await db.select().from(timeSlots)
        .where(eq(timeSlots.id, appointment.timeSlotId)).limit(1);
      
      if (!timeSlot) continue;
      
      const [embasa] = await db.select().from(accessCodes)
        .where(eq(accessCodes.id, timeSlot.embasaCodeId)).limit(1);
      
      const [sac] = await db.select().from(accessCodes)
        .where(eq(accessCodes.id, appointment.sacCodeId)).limit(1);
      
      if (!embasa || !sac) continue;
      
      results.push({
        ...appointment,
        timeSlot: {
          ...timeSlot,
          embasa
        },
        sac
      });
    }
    
    return results;
  }

  async getAllAppointments(): Promise<AppointmentWithDetails[]> {
    const appointmentResults = await db.select().from(appointments);
    
    const results: AppointmentWithDetails[] = [];
    
    for (const appointment of appointmentResults) {
      const [timeSlot] = await db.select().from(timeSlots)
        .where(eq(timeSlots.id, appointment.timeSlotId)).limit(1);
      
      if (!timeSlot) continue;
      
      const [embasa] = await db.select().from(accessCodes)
        .where(eq(accessCodes.id, timeSlot.embasaCodeId)).limit(1);
      
      const [sac] = await db.select().from(accessCodes)
        .where(eq(accessCodes.id, appointment.sacCodeId)).limit(1);
      
      if (!embasa || !sac) continue;
      
      results.push({
        ...appointment,
        timeSlot: {
          ...timeSlot,
          embasa
        },
        sac
      });
    }
    
    return results;
  }
}

export const storage = new DatabaseStorage();
