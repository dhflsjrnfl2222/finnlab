# FinnLab

마우스 커서를 따라 유영하는 물고기 등지느러미와 2.5D 파동 수면의 상호작용을 실험하는 인터랙티브 유체 시뮬레이션 웹 애플리케이션입니다.

## 주요 기능
- **수조 그리드 & 필터링**: 저장된 유체 실험 수조를 2열 그리드로 조회하고 이름·질감·흐름 방향별로 검색
- **환경 프리셋 CRUD**: 유체(밀도, 점성, 8축/랜덤 흐름 방향, 선/면 렌더링, 색상·질감)와 지느러미(크기, 모양, 색상) 설정의 생성·조회·수정·삭제
- **2.5D 지느러미 유체 시뮬레이션**: 마우스 이동 벡터에 따라 회전하는 등지느러미와 상대 속도 기반 V자 항적(Wake) 실시간 렌더링
- **인스턴스 기반 구조**: DB에는 환경 파라미터만 저장하고, 접속 시마다 시뮬레이션 인스턴스를 새로 생성

## 기술 스택
- **Backend**: Node.js, Express, EJS
- **Database**: MySQL (`mysql2`, 서버 시작 시 테이블 자동 생성)
- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Infra**: Ubuntu (AWS EC2)

## 실행 방법

### 1. 데이터베이스 생성 (MySQL)
```sql
CREATE DATABASE IF NOT EXISTS finn DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'finner'@'localhost' IDENTIFIED BY 'finner05';
GRANT ALL PRIVILEGES ON finn.* TO 'finner'@'localhost';
FLUSH PRIVILEGES;
```

### 2. 환경 변수 설정 (`.env`)
```env
PORT=3000
DB_HOST=localhost
DB_USER=finner
DB_PASSWORD=finner05
DB_NAME=finn
```

### 3. 패키지 설치 및 서버 실행
```bash
npm install
npm start
```
> 서버 실행 시 필요한 테이블이 자동으로 초기화됩니다.

---
*抗おうか 美しい鰭で*