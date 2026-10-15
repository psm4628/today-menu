-- T39: 기존 데이터를 내 계정에 연결하고, owner_id 외래키와 태그 이름 규칙을 바꾼다.
-- 관리자 계정으로 직접 실행한다. 예: sudo mariadb < sql/auth_owner.sql
-- 실행 전에 아래 1번의 @me 를 T38에서 확인한 내 계정의 users.id 숫자로 바꾼다.
-- 기존 식당·태그 행은 지우거나 내용을 바꾸지 않고 owner_id(소유자 번호)만 내 계정 번호로 바꾼다.
-- 비밀번호·키 값은 이 파일에 없다.

USE today_menu;

-- 1. ★ 내 계정의 users.id 로 바꾸세요 (예: SET @me := 12;)
SET @me := 0;

-- 2. 사전 점검 (읽기 전용): 첫 결과가 내 계정 1행이어야 한다. 0행이면 @me 를 다시 확인하고 중단한다.
SELECT id, username, created_at FROM users WHERE id = @me;
SELECT 'restaurants' AS tbl, owner_id, COUNT(*) AS cnt FROM restaurants GROUP BY owner_id
UNION ALL
SELECT 'tags', owner_id, COUNT(*) FROM tags GROUP BY owner_id;

-- 3. 기존 데이터 연결: 내 계정이 users 에 있을 때만 소유자 번호가 바뀐다.
START TRANSACTION;
UPDATE restaurants SET owner_id = @me WHERE owner_id = 1 AND EXISTS (SELECT 1 FROM users WHERE id = @me);
UPDATE tags        SET owner_id = @me WHERE owner_id = 1 AND EXISTS (SELECT 1 FROM users WHERE id = @me);
COMMIT;

-- 4. 연결 결과 (읽기 전용): 모든 행의 owner_id 가 @me 여야 한다 (식당 10곳 이상, 태그 4개 이상).
SELECT 'restaurants' AS tbl, owner_id, COUNT(*) AS cnt FROM restaurants GROUP BY owner_id
UNION ALL
SELECT 'tags', owner_id, COUNT(*) FROM tags GROUP BY owner_id;

-- 5. 구조 변경. 소유자 번호가 users 에 없는 행이 하나라도 있으면 외래키 단계에서 멈춘다(데이터는 그대로).
--    owner_id 기본값은 지우지 않고 내 계정 번호로 바꾼다. 로그인 코드(T40~T44)를 서버에 반영하기 전까지
--    옛 코드(소유자를 지정하지 않고 등록)가 계속 동작하게 하려는 것이다. 반영한 뒤 sql/auth_owner_final.sql 로 기본값을 지운다.
SET @sql := CONCAT(
  'ALTER TABLE restaurants ',
  'MODIFY owner_id INT NOT NULL DEFAULT ', CAST(@me AS UNSIGNED), ', ',
  'ADD CONSTRAINT fk_restaurants_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tags: 이름 중복 규칙을 UNIQUE(name) 에서 UNIQUE(owner_id, name) 으로 바꾸고 외래키를 건다.
SET @sql := CONCAT(
  'ALTER TABLE tags ',
  'MODIFY owner_id INT NOT NULL DEFAULT ', CAST(@me AS UNSIGNED), ', ',
  'DROP INDEX name, ',
  'ADD UNIQUE KEY uq_tags_owner_name (owner_id, name), ',
  'ADD CONSTRAINT fk_tags_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 실행 뒤 확인(읽기 전용):
--   SHOW CREATE TABLE restaurants;
--   SHOW CREATE TABLE tags;
--   SELECT COUNT(*) FROM restaurants;  SELECT COUNT(*) FROM tags;
