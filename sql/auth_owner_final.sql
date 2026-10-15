-- T45: 로그인 코드(T40~T44)를 서버에 반영한 뒤에 실행한다. 관리자 계정으로 직접 실행한다.
--   예: sudo mariadb < sql/auth_owner_final.sql
-- 로그인 코드는 소유자(owner_id)를 항상 직접 지정하므로, 기본값이 남아 있으면 실수로 소유자가 정해지는 일이 생길 수 있어 지운다.
-- 기존 행과 값은 바꾸지 않는다.

USE today_menu;

ALTER TABLE restaurants ALTER COLUMN owner_id DROP DEFAULT;
ALTER TABLE tags        ALTER COLUMN owner_id DROP DEFAULT;

-- 실행 뒤 확인(읽기 전용):
--   SHOW CREATE TABLE restaurants;   -- owner_id int(11) NOT NULL (DEFAULT 없음)
--   SHOW CREATE TABLE tags;
