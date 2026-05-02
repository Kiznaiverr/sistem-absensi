-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,           -- "SMK-1", "SMP-2", etc
  school_type VARCHAR(10) NOT NULL,           -- "SMK" or "SMP"
  grade INT NOT NULL CHECK (grade IN (1, 2, 3)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admins (Auth table)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Santri (Students)
CREATE TABLE IF NOT EXISTS santri (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfid_id VARCHAR(255) UNIQUE NOT NULL,      -- Card ID from RFID reader
  name VARCHAR(255) NOT NULL,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Logs
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  santri_id UUID NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift VARCHAR(10) NOT NULL,               -- "siang" or "malam"
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'present',     -- "present" or "absent"
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure 1 entry per santri per shift per day
  UNIQUE(santri_id, date, shift)
);

-- Attendance Archive (for data older than 90 days) - DENORMALIZED
CREATE TABLE IF NOT EXISTS attendance_logs_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Core attendance
  date DATE NOT NULL,
  shift VARCHAR(10) NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'present',
  notes TEXT,
  
  -- IDs (no foreign keys - historical data)
  santri_id UUID NOT NULL,
  class_id UUID NOT NULL,
  
  -- Denormalized snapshot at archive time
  santri_name VARCHAR(255) NOT NULL,
  santri_rfid_id VARCHAR(255) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  school_type VARCHAR(10) NOT NULL,
  grade INT NOT NULL,
  
  -- Timeline
  original_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  archived_by VARCHAR(255) DEFAULT 'system',
  
  UNIQUE(id)
);

-- Archive Operations Audit Log
CREATE TABLE IF NOT EXISTS archive_operations (
  id SERIAL PRIMARY KEY,
  archive_date DATE NOT NULL DEFAULT CURRENT_DATE,
  threshold_date DATE NOT NULL,
  records_copied INT NOT NULL DEFAULT 0,
  records_deleted INT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  archived_by VARCHAR(255) DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Error Logs (with 24h TTL auto-delete)
CREATE TABLE IF NOT EXISTS attendance_error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfid_id VARCHAR(255) NOT NULL,
  error_code VARCHAR(50) NOT NULL,
  error_message TEXT NOT NULL,
  shift VARCHAR(10),                        -- NULL if error before shift determined
  santri_id UUID,                           -- NULL if RFID_NOT_FOUND
  class_id UUID,                            -- NULL if santri not found
  santri_name VARCHAR(255),                 -- For reference
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  request_date DATE NOT NULL,               -- For filtering by date
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- For 24h TTL auto-delete
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX idx_attendance_error_logs_expires_at ON attendance_error_logs(expires_at);
CREATE INDEX idx_attendance_error_logs_request_date ON attendance_error_logs(request_date);
CREATE INDEX idx_attendance_error_logs_resolved ON attendance_error_logs(resolved);
CREATE INDEX idx_attendance_error_logs_error_code ON attendance_error_logs(error_code);
CREATE INDEX idx_attendance_error_logs_rfid_id ON attendance_error_logs(rfid_id);
CREATE INDEX idx_attendance_error_logs_created_at ON attendance_error_logs(created_at DESC);

-- ESP32 Error Logs
CREATE TABLE IF NOT EXISTS esp32_error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id VARCHAR(100) NOT NULL,
  error_code VARCHAR(50) NOT NULL,
  error_message TEXT NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  request_date DATE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_esp32_error_logs_device_id ON esp32_error_logs(device_id);
CREATE INDEX idx_esp32_error_logs_request_date ON esp32_error_logs(request_date);
CREATE INDEX idx_esp32_error_logs_expires_at ON esp32_error_logs(expires_at);
CREATE INDEX idx_esp32_error_logs_created_at ON esp32_error_logs(created_at DESC);

-- Santri import background jobs
CREATE TABLE IF NOT EXISTS santri_import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(20) NOT NULL DEFAULT 'queued', -- queued | processing | completed | failed
  progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  total_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  stage VARCHAR(30),
  message TEXT,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_by_email VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS santri_import_errors (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES santri_import_jobs(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  name VARCHAR(255) DEFAULT '',
  rfid_id VARCHAR(255) DEFAULT '',
  class_name VARCHAR(255) DEFAULT '',
  error_type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'error',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_classes_school_type ON classes(school_type);
CREATE INDEX idx_classes_grade ON classes(grade);

CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_username ON admins(username);
CREATE INDEX idx_admins_is_active ON admins(is_active);

CREATE INDEX idx_santri_rfid_id ON santri(rfid_id);
CREATE INDEX idx_santri_class_id ON santri(class_id);
CREATE INDEX idx_santri_is_active ON santri(is_active);

CREATE INDEX idx_attendance_logs_date ON attendance_logs(date);
CREATE INDEX idx_attendance_logs_shift ON attendance_logs(shift);
CREATE INDEX idx_attendance_logs_santri_id ON attendance_logs(santri_id);
CREATE INDEX idx_attendance_logs_class_id ON attendance_logs(class_id);
CREATE INDEX idx_attendance_logs_date_shift ON attendance_logs(date, shift);
CREATE INDEX idx_attendance_logs_date_range ON attendance_logs(date, class_id);

-- Archive indexes for efficient queries
CREATE INDEX idx_archive_date ON attendance_logs_archive(date);
CREATE INDEX idx_archive_shift ON attendance_logs_archive(shift);
CREATE INDEX idx_archive_date_shift ON attendance_logs_archive(date, shift);
CREATE INDEX idx_archive_date_range ON attendance_logs_archive(date, shift, class_id);
CREATE INDEX idx_archive_class_date ON attendance_logs_archive(class_id, date);
CREATE INDEX idx_archive_santri_date ON attendance_logs_archive(santri_id, date);

-- Archive operations index
CREATE INDEX idx_archive_ops_date ON archive_operations(archive_date DESC);
CREATE INDEX idx_archive_ops_status ON archive_operations(status);

-- Import jobs indexes
CREATE INDEX idx_import_jobs_status_created_at ON santri_import_jobs(status, created_at);
CREATE INDEX idx_import_jobs_expires_at ON santri_import_jobs(expires_at);
CREATE INDEX idx_import_jobs_created_by ON santri_import_jobs(created_by, created_at DESC);
CREATE INDEX idx_import_errors_job_id ON santri_import_errors(job_id);

-- Seed Classes
INSERT INTO classes (name, school_type, grade) VALUES
  ('SMP-1', 'SMP', 1),
  ('SMP-2', 'SMP', 2),
  ('SMP-3', 'SMP', 3),
  ('SMK-1', 'SMK', 1),
  ('SMK-2', 'SMK', 2),
  ('SMK-3', 'SMK', 3)
ON CONFLICT (name) DO NOTHING;

-- Stored Procedures for Archive Operations

-- Copy old records to archive table with denormalized data
CREATE OR REPLACE FUNCTION copy_to_archive(threshold_date DATE)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO attendance_logs_archive (
    id,
    date,
    shift,
    checked_in_at,
    status,
    notes,
    santri_id,
    class_id,
    santri_name,
    santri_rfid_id,
    class_name,
    school_type,
    grade,
    original_created_at,
    archived_by
  )
  SELECT
    al.id,
    al.date,
    al.shift,
    al.checked_in_at,
    al.status,
    al.notes,
    al.santri_id,
    al.class_id,
    s.name,
    s.rfid_id,
    c.name,
    c.school_type,
    c.grade,
    al.created_at,
    'archive-job'
  FROM attendance_logs al
  JOIN santri s ON al.santri_id = s.id
  JOIN classes c ON al.class_id = c.id
  WHERE al.date < threshold_date
    AND NOT EXISTS (
      SELECT 1 FROM attendance_logs_archive
      WHERE id = al.id
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Count records eligible for archiving
CREATE OR REPLACE FUNCTION count_archivable_records(threshold_date DATE)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM attendance_logs
  WHERE date < threshold_date;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Verify archive copy
CREATE OR REPLACE FUNCTION verify_archive_copy(threshold_date DATE)
RETURNS TABLE(is_valid BOOLEAN, active_count INT, archive_count INT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE table_name = 'active') = COUNT(*) FILTER (WHERE table_name = 'archive') as is_valid,
    COUNT(*) FILTER (WHERE table_name = 'active')::INT as active_count,
    COUNT(*) FILTER (WHERE table_name = 'archive')::INT as archive_count
  FROM (
    SELECT 'active' as table_name FROM attendance_logs WHERE date < threshold_date
    UNION ALL
    SELECT 'archive' as table_name FROM attendance_logs_archive WHERE date < threshold_date
  ) t;
END;
$$ LANGUAGE plpgsql;

-- Example santri
-- INSERT INTO santri (rfid_id, name, class_id, is_active) 
-- SELECT 
--   'A1B2C3D4' as rfid_id,
--   'Ahmad Fadli' as name,
--   c.id,
--   true
-- FROM classes c WHERE c.name = 'SMK-1';
