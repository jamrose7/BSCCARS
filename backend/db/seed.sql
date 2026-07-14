INSERT INTO users (
  id,
  email,
  password_hash,
  role,
  first_name,
  middle_name,
  last_name,
  status,
  warning_count,
  is_restricted,
  restricted_until
) VALUES
  ('2026001', 'admin@gmail.com', '$2b$10$TYeIIdLNDsIDcgS04efcm.YUdz13tN2VlOxgRVqx31tXX5os.nmyy', 'super_admin', 'Jamiel', NULL, 'Rosell', 'active', 0, FALSE, NULL),
  ('2026002', 'secretary@gmail.com', '$2b$10$f9q8uPpnJyP0ZeC2O66Yse7PQIOowEYzPkr.d30kdXwAYpmhM2bqW', 'assistant_admin', 'Kiarah', NULL, 'Beau', 'active', 0, FALSE, NULL),
  ('2026003', 'resident@gmail.com', '$2b$10$TA62qYQhP/uHO2.Smt39Je2T..a691gbj.l83aIddaMCTRyu9/m.S', 'resident', 'Aeron', NULL, 'Smith', 'approved', 0, FALSE, NULL)
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  role = VALUES(role),
  first_name = VALUES(first_name),
  middle_name = VALUES(middle_name),
  last_name = VALUES(last_name),
  status = VALUES(status),
  warning_count = VALUES(warning_count),
  is_restricted = VALUES(is_restricted),
  restricted_until = VALUES(restricted_until);
