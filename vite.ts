CREATE TABLE `access_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL UNIQUE,
	`user_type` text NOT NULL,
	`user_name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);

CREATE TABLE `time_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`embasa_code_id` integer NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`embasa_code_id`) REFERENCES `access_codes`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`time_slot_id` integer NOT NULL,
	`sac_code_id` integer NOT NULL,
	`client_name` text NOT NULL,
	`ss_number` text NOT NULL,
	`comments` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`time_slot_id`) REFERENCES `time_slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sac_code_id`) REFERENCES `access_codes`(`id`) ON UPDATE no action ON DELETE no action
);

-- Insert admin user
INSERT INTO `access_codes` (`code`, `user_type`, `user_name`, `is_active`, `created_at`) 
VALUES ('ADMEMB8', 'admin', 'Administrador', 1, strftime('%s', 'now'));