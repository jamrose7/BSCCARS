CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(20) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('resident', 'assistant_admin', 'super_admin') NOT NULL DEFAULT 'resident',
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_picture_url TEXT NULL,
  account_status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_users_id_format CHECK (id REGEXP '^(RES|ADM)-2026-[0-9]{3}$')
);

CREATE INDEX idx_users_status ON users (status);

CREATE TABLE IF NOT EXISTS complaints (
  id VARCHAR(32) PRIMARY KEY,
  submitter_id VARCHAR(20) NOT NULL,
  title VARCHAR(120) NOT NULL,
  category VARCHAR(150) NOT NULL,
  category_base VARCHAR(100) NULL,
  category_specify VARCHAR(100) NULL,
  details TEXT NOT NULL,
  respondent_name VARCHAR(255) NULL,
  respondent_contact_number VARCHAR(20) NULL,
  respondent_email VARCHAR(255) NULL,
  respondent_purok VARCHAR(100) NULL,
  purok VARCHAR(100) NOT NULL,
  incident_date DATE NULL,
  incident_time TIME NULL,
  priority ENUM('Normal', 'High') NOT NULL DEFAULT 'Normal',
  confidentiality ENUM('Public', 'Confidential') NOT NULL DEFAULT 'Public',
  status ENUM('pending', 'in-progress', 'resolved') NOT NULL DEFAULT 'pending',
  source VARCHAR(150) NOT NULL DEFAULT 'Digital Submission',
  source_base VARCHAR(100) NULL,
  source_specify VARCHAR(100) NULL,
  admin_notes TEXT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  archived_at TIMESTAMP NULL,
  FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_complaints_submitter ON complaints (submitter_id);
CREATE INDEX idx_complaints_status ON complaints (status);
CREATE INDEX idx_complaints_category ON complaints (category);
CREATE INDEX idx_complaints_priority ON complaints (priority);
CREATE INDEX idx_complaints_created_at ON complaints (created_at);
CREATE INDEX idx_complaints_archived ON complaints (is_archived);

CREATE TABLE IF NOT EXISTS complaint_attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  complaint_id VARCHAR(32) NOT NULL,
  file_type ENUM('image', 'video') NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

CREATE INDEX idx_complaint_attachments_complaint ON complaint_attachments (complaint_id);

CREATE TABLE IF NOT EXISTS complaint_comments (
  id VARCHAR(64) PRIMARY KEY,
  complaint_id VARCHAR(32) NOT NULL,
  author_id VARCHAR(20) NOT NULL,
  comment TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_complaint_comments_complaint ON complaint_comments (complaint_id);
CREATE INDEX idx_complaint_comments_internal ON complaint_comments (is_internal);

CREATE TABLE IF NOT EXISTS complaint_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  complaint_id VARCHAR(32) NOT NULL,
  changed_by VARCHAR(20) NOT NULL,
  previous_status VARCHAR(30) NULL,
  new_status VARCHAR(30) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_status_history_complaint ON complaint_status_history (complaint_id);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user_read ON notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(20) NULL,
  action VARCHAR(150) NOT NULL,
  target_type VARCHAR(50) NULL,
  target_id VARCHAR(64) NULL,
  details TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_logs_user ON activity_logs (user_id);
CREATE INDEX idx_activity_logs_target ON activity_logs (target_type, target_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs (created_at);

CREATE TABLE IF NOT EXISTS hearing_notices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  complaint_id VARCHAR(32) NOT NULL,
  generated_by VARCHAR(20) NOT NULL,
  hearing_date DATE NULL,
  hearing_time TIME NULL,
  stage ENUM('first_mediation', 'second_mediation', 'conciliation', 'cfa_issued') NOT NULL DEFAULT 'first_mediation',
  outcome ENUM('pending', 'respondent_appeared', 'respondent_absent', 'settled', 'escalated') NOT NULL DEFAULT 'pending',
  notice_served_method ENUM('printed', 'email', 'in_person') NULL,
  notice_served_at DATETIME NULL,
  location VARCHAR(150) NULL,
  mediation_notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_hearing_notices_complaint ON hearing_notices (complaint_id);
