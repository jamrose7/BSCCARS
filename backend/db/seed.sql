INSERT INTO users (
  id,
  email,
  password_hash,
  role,
  first_name,
  middle_name,
  last_name,
  account_status
) VALUES
  ('ADM-2026-001', 'superadmin@gmail.com', '$2b$10$Nn6wuhQLBRBsWyEL8FrgnO4nzn0YOotp4aP2yURCT5SUTfQLV8y1K', 'super_admin', 'Jamiel', NULL, 'Rosell', 'active'),
  ('ADM-2026-002', 'assistantadmin@gmail.com', '$2b$10$vXfMTAZW0axVDwk5W/IWEu4QMs2lx9Hy.PS0PcKZZO5UyEzFZsYty', 'assistant_admin', 'Kiarah', NULL, 'Beau', 'active'),
  ('RES-2026-003', 'resident@gmail.com', '$2b$10$TA62qYQhP/uHO2.Smt39Je2T..a691gbj.l83aIddaMCTRyu9/m.S', 'resident', 'Aeron', NULL, 'Smith', 'active')
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  role = VALUES(role),
  first_name = VALUES(first_name),
  middle_name = VALUES(middle_name),
  last_name = VALUES(last_name),
  account_status = VALUES(account_status);
