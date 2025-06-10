import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const accessCodes = sqliteTable("access_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  userType: text("user_type").notNull(), // 'admin', 'embasa', 'sac'
  userName: text("user_name").notNull(), // e.g., "EMBASA Federação", "SAC Cabula"
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const timeSlots = sqliteTable("time_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  embasaCodeId: integer("embasa_code_id").notNull().references(() => accessCodes.id),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timeSlotId: integer("time_slot_id").notNull().references(() => timeSlots.id),
  sacCodeId: integer("sac_code_id").notNull().references(() => accessCodes.id),
  clientName: text("client_name").notNull(),
  ssNumber: text("ss_number").notNull(),
  comments: text("comments"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Insert schemas
export const insertAccessCodeSchema = createInsertSchema(accessCodes).omit({
  id: true,
  code: true,
  createdAt: true,
});

export const insertTimeSlotSchema = createInsertSchema(timeSlots).omit({
  id: true,
  createdAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
});

// Types
export type AccessCode = typeof accessCodes.$inferSelect;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;

export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;
export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

// Extended types for API responses
export type TimeSlotWithEmbasa = TimeSlot & {
  embasa: AccessCode;
};

export type AppointmentWithDetails = Appointment & {
  timeSlot: TimeSlotWithEmbasa;
  sac: AccessCode;
};
