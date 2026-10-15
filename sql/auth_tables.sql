-- T35: 로그인 기능용 테이블 (users, sessions, login_attempts)
-- 관리자 계정으로 직접 실행한다. 예: sudo mariadb < sql/auth_tables.sql
-- 여러 번 실행해도 안전하다(IF NOT EXISTS). 기존 테이블·데이터는 건드리지 않는다.
-- today_menu_app 사용자는 today_menu.* 에 SELECT, INSERT, UPDATE, DELETE 권한이 이미 있어서 GRANT는 필요 없다.
-- 비밀번호·키 값은 이 파일에 없다.

USE today_menu;

-- 사용자. username 은 앱이 소문자로 바꿔 저장한다. password_hash 에는 솔트 포함 scrypt 해시만 저장한다.
CREATE TABLE IF NOT EXISTS users (
  id            INT          NOT NULL AUTO_INCREMENT,
  username      VARCHAR(30)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- 로그인 세션. 쿠키의 토큰 원문은 저장하지 않고 SHA-256 해시(16진수 64자)만 저장한다.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64)  NOT NULL,
  user_id    INT       NOT NULL,
  created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME  NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sessions_user_id (user_id),
  KEY idx_sessions_expires_at (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- 로그인 실패 기록. 시도 횟수 제한(아이디 기준·IP 기준)에 쓴다. 없는 아이디의 실패도 기록하므로 users 와 연결하지 않는다.
CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  username     VARCHAR(30) NOT NULL,
  ip           VARCHAR(45) NOT NULL,
  attempted_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_login_attempts_username (username, attempted_at),
  KEY idx_login_attempts_ip (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- 실행 뒤 확인(읽기 전용):
--   SHOW TABLES;
--   SHOW CREATE TABLE users;
--   SHOW CREATE TABLE sessions;
--   SHOW CREATE TABLE login_attempts;
