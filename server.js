const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS 설정
app.use(
    cors({
        origin: '*', // 프로덕션에서는 특정 도메인으로 제한
        methods: ['GET', 'POST'],
    })
);

// Socket.IO 설정
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// 기본 라우트 (헬스체크용)
app.get('/', (req, res) => {
    res.json({
        message: 'Unilux Socket Server is running!',
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});

// 연결된 클라이언트 수 확인 엔드포인트
app.get('/status', (req, res) => {
    res.json({
        connectedClients: io.engine.clientsCount,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
    console.log(`새로운 클라이언트 연결: ${socket.id}`);

    // 연결 확인 메시지 전송
    socket.emit('connected', {
        message: '서버에 성공적으로 연결되었습니다!',
        socketId: socket.id,
        timestamp: new Date().toISOString(),
    });

    // 메시지 수신 및 브로드캐스트
    socket.on('message', (data) => {
        console.log('메시지 수신:', data);

        // 모든 클라이언트에게 메시지 브로드캐스트
        io.emit('message', {
            ...data,
            socketId: socket.id,
            timestamp: new Date().toISOString(),
        });
    });

    // 룸 참가
    socket.on('join-room', (roomName) => {
        socket.join(roomName);
        console.log(`클라이언트 ${socket.id}가 룸 ${roomName}에 참가했습니다.`);

        // 룸의 다른 사용자들에게 알림
        socket.to(roomName).emit('user-joined', {
            socketId: socket.id,
            room: roomName,
            timestamp: new Date().toISOString(),
        });
    });

    // 룸 나가기
    socket.on('leave-room', (roomName) => {
        socket.leave(roomName);
        console.log(`클라이언트 ${socket.id}가 룸 ${roomName}에서 나갔습니다.`);

        // 룸의 다른 사용자들에게 알림
        socket.to(roomName).emit('user-left', {
            socketId: socket.id,
            room: roomName,
            timestamp: new Date().toISOString(),
        });
    });

    // 특정 룸에 메시지 전송
    socket.on('room-message', (data) => {
        const { room, message } = data;
        console.log(`룸 ${room}에 메시지 전송:`, message);

        io.to(room).emit('room-message', {
            message,
            room,
            socketId: socket.id,
            timestamp: new Date().toISOString(),
        });
    });

    // 연결 해제 처리
    socket.on('disconnect', (reason) => {
        console.log(`클라이언트 연결 해제: ${socket.id}, 이유: ${reason}`);
    });

    // 에러 처리
    socket.on('error', (error) => {
        console.error(`소켓 에러 (${socket.id}):`, error);
    });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Unilux Socket Server가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📡 Socket.IO 서버가 준비되었습니다.`);
});
