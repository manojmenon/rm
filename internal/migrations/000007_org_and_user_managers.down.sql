DROP TABLE IF EXISTS user_dotted_line_managers;
ALTER TABLE users DROP COLUMN IF EXISTS direct_manager_id;
ALTER TABLE users DROP COLUMN IF EXISTS team_id;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS functions;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS holding_companies;
