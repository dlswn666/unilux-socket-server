# Unilux Socket Server

실시간 양방향 통신을 위한 Socket.IO 서버입니다.

## 🚀 기능

-   **실시간 메시징**: 클라이언트 간 실시간 메시지 교환
-   **룸 기능**: 특정 그룹 내에서의 통신
-   **연결 상태 관리**: 클라이언트 연결/해제 추적
-   **헬스체크**: 서버 상태 모니터링
-   **CORS 지원**: 크로스 오리진 요청 처리

## 📦 설치

```bash
npm install
```

## 🏃‍♂️ 실행

### 개발 모드

```bash
npm run dev
```

### 프로덕션 모드

```bash
npm start
```

## 🌐 API 엔드포인트

### HTTP 엔드포인트

-   `GET /` - 서버 상태 확인 (헬스체크)
-   `GET /status` - 연결된 클라이언트 수 및 서버 정보

### Socket.IO 이벤트

#### 클라이언트 → 서버

-   `message` - 전체 브로드캐스트 메시지 전송
-   `join-room` - 특정 룸에 참가
-   `leave-room` - 특정 룸에서 나가기
-   `room-message` - 특정 룸에 메시지 전송

#### 서버 → 클라이언트

-   `connected` - 연결 성공 알림
-   `message` - 브로드캐스트 메시지 수신
-   `user-joined` - 룸에 새 사용자 참가 알림
-   `user-left` - 룸에서 사용자 나감 알림
-   `room-message` - 룸 메시지 수신

## 🔧 환경 변수

-   `PORT` - 서버 포트 (기본값: 3000)

## 📱 클라이언트 연결 예시

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

// 연결 확인
socket.on('connected', (data) => {
    console.log('서버 연결됨:', data);
});

// 메시지 전송
socket.emit('message', {
    text: '안녕하세요!',
    user: 'user1',
});

// 메시지 수신
socket.on('message', (data) => {
    console.log('메시지 수신:', data);
});

// 룸 참가
socket.emit('join-room', 'room1');

// 룸 메시지 전송
socket.emit('room-message', {
    room: 'room1',
    message: '룸 메시지입니다!',
});
```

## 🚀 Render 배포

1. GitHub에 코드 푸시
2. Render에서 새 Web Service 생성
3. GitHub 저장소 연결
4. 빌드 명령어: `npm install`
5. 시작 명령어: `npm start`
6. 환경 변수 설정 (필요시)

## 📝 라이센스

MIT

## 🤝 기여

이슈나 풀 리퀘스트를 통해 기여해주세요!
#   u n i l u x - s o c k e t - s e r v e r 
 
 
