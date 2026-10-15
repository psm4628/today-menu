-- today_menu DB 테이블 구조 (테이블 생성 구문만, 데이터·비밀번호 없음)
-- 2026-10-15 현재 로컬 MariaDB(today_menu)의 구조를 조회(SHOW CREATE TABLE)해서 작성했다.
-- 대상 DB를 지정해 실행한다. 예: sudo mariadb today_menu < sql/schema.sql
-- 여러 번 실행해도 안전하다(IF NOT EXISTS). 외래키 순서에 맞춰 users → restaurants → tags → restaurant_tags → visits → sessions → login_attempts 순으로 만든다.
-- 로컬 DB에서 조회한 것과 다른 점 두 가지:
--   1) AUTO_INCREMENT 시작 번호(AUTO_INCREMENT=N)는 뺐다. 새 DB는 1부터 시작한다.
--   2) restaurants.owner_id, tags.owner_id의 기본값(로컬 DB에서는 내 계정 번호가 들어 있음)은 넣지 않았다.
--      새 서버에서는 앱이 owner_id를 항상 직접 지정하며, 로컬의 계정 번호는 다른 DB에서 의미가 없다.

-- 사용자. username은 앱이 소문자로 바꿔 저장하고, password_hash에는 솔트 포함 scrypt 해시만 저장한다.
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(30) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- 식당. owner_id는 식당 주인(users.id)이고 사용자를 지우려 해도 식당이 있으면 막힌다(RESTRICT).
CREATE TABLE IF NOT EXISTS `restaurants` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(20) DEFAULT NULL,
  `price_range` TINYINT DEFAULT NULL,
  `location` VARCHAR(200) DEFAULT NULL,
  `memo` TEXT DEFAULT NULL,
  `is_favorite` TINYINT(1) DEFAULT 0,
  `status` VARCHAR(10) DEFAULT 'WANT',
  `owner_id` INT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_restaurants_owner` (`owner_id`),
  CONSTRAINT `fk_restaurants_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- 상황별 태그. 이름 중복은 사용자별로만 검사한다(UNIQUE(owner_id, name)).
CREATE TABLE IF NOT EXISTS `tags` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(30) NOT NULL,
  `owner_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tags_owner_name` (`owner_id`, `name`),
  CONSTRAINT `fk_tags_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- 식당과 태그의 연결. 식당이나 태그를 지우면 연결도 함께 지워진다.
CREATE TABLE IF NOT EXISTS `restaurant_tags` (
  `restaurant_id` INT NOT NULL,
  `tag_id` INT NOT NULL,
  PRIMARY KEY (`restaurant_id`, `tag_id`),
  KEY `tag_id` (`tag_id`),
  CONSTRAINT `restaurant_tags_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `restaurant_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- 방문 기록. 식당을 지우면 기록도 함께 지워지고, 별점은 1~5만 허용한다.
CREATE TABLE IF NOT EXISTS `visits` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `restaurant_id` INT NOT NULL,
  `visited_at` DATE NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` VARCHAR(300) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `restaurant_id` (`restaurant_id`),
  CONSTRAINT `visits_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE,
  CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- 로그인 세션. 쿠키 토큰의 SHA-256 해시(16진수 64자)만 저장하고, 사용자를 지우면 세션도 지워진다.
CREATE TABLE IF NOT EXISTS `sessions` (
  `token_hash` CHAR(64) NOT NULL,
  `user_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `idx_sessions_user_id` (`user_id`),
  KEY `idx_sessions_expires_at` (`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- 로그인 실패 기록(시도 횟수 제한용). 없는 아이디의 실패도 기록하므로 users와 연결하지 않는다.
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(30) NOT NULL,
  `ip` VARCHAR(45) NOT NULL,
  `attempted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_login_attempts_username` (`username`, `attempted_at`),
  KEY `idx_login_attempts_ip` (`ip`, `attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
