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

-- Attendance Archive (for data older than 3 months)
CREATE TABLE IF NOT EXISTS attendance_logs_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  santri_id UUID NOT NULL,
  class_id UUID NOT NULL,
  date DATE NOT NULL,
  shift VARCHAR(10) NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'present',
  notes TEXT,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  original_created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_classes_school_type ON classes(school_type);
CREATE INDEX idx_classes_grade ON classes(grade);

CREATE INDEX idx_santri_rfid_id ON santri(rfid_id);
CREATE INDEX idx_santri_class_id ON santri(class_id);
CREATE INDEX idx_santri_is_active ON santri(is_active);

CREATE INDEX idx_attendance_logs_date ON attendance_logs(date);
CREATE INDEX idx_attendance_logs_shift ON attendance_logs(shift);
CREATE INDEX idx_attendance_logs_santri_id ON attendance_logs(santri_id);
CREATE INDEX idx_attendance_logs_class_id ON attendance_logs(class_id);
CREATE INDEX idx_attendance_logs_date_shift ON attendance_logs(date, shift);

CREATE INDEX idx_attendance_archive_date ON attendance_logs_archive(date);
CREATE INDEX idx_attendance_archive_archived_at ON attendance_logs_archive(archived_at);

-- Seed Classes
INSERT INTO classes (name, school_type, grade) VALUES
  ('SMP-1', 'SMP', 1),
  ('SMP-2', 'SMP', 2),
  ('SMP-3', 'SMP', 3),
  ('SMK-1', 'SMK', 1),
  ('SMK-2', 'SMK', 2),
  ('SMK-3', 'SMK', 3)
ON CONFLICT (name) DO NOTHING;

-- Example santri (can be deleted after testing)
-- INSERT INTO santri (rfid_id, name, class_id, is_active) 
-- SELECT 
--   'A1B2C3D4' as rfid_id,
--   'Ahmad Fadli' as name,
--   c.id,
--   true
-- FROM classes c WHERE c.name = 'SMK-1';
