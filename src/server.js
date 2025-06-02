const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// LCS 관련 모듈
const LCSAgentManager = require('./lcs/agent-manager');
const setupLCSApiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// JSON 파싱 미들웨어 추가
app.use(express.json());

// public 폴더 정적 파일 서비스
app.use(express.static(path.join(__dirname, '../public')));

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

// LCS Agent Manager 초기화
const lcsAgentManager = new LCSAgentManager();

// LCS API 라우트 설정
app.use('/api', setupLCSApiRoutes(lcsAgentManager));

// 기본 라우트 (헬스체크용)
app.get('/', (req, res) => {
    res.json({
        message: 'Unilux Socket Server with LCS Integration is running!',
        status: 'healthy',
        lcsStatus: lcsAgentManager.getConnectionStatus(),
        timestamp: new Date().toISOString(),
    });
});

// 연결된 클라이언트 수 확인 엔드포인트
app.get('/status', (req, res) => {
    res.json({
        connectedClients: io.engine.clientsCount,
        uptime: process.uptime(),
        lcsStatus: lcsAgentManager.getConnectionStatus(),
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
        lcsStatus: lcsAgentManager.getConnectionStatus(),
        timestamp: new Date().toISOString(),
    });

    // 기존 소켓 이벤트들 (메시지, 룸 기능)
    socket.on('message', (data) => {
        console.log('메시지 수신:', data);
        io.emit('message', {
            ...data,
            socketId: socket.id,
            timestamp: new Date().toISOString(),
        });
    });

    socket.on('join-room', (roomName) => {
        socket.join(roomName);
        console.log(`클라이언트 ${socket.id}가 룸 ${roomName}에 참가했습니다.`);
        socket.to(roomName).emit('user-joined', {
            socketId: socket.id,
            room: roomName,
            timestamp: new Date().toISOString(),
        });
    });

    socket.on('leave-room', (roomName) => {
        socket.leave(roomName);
        console.log(`클라이언트 ${socket.id}가 룸 ${roomName}에서 나갔습니다.`);
        socket.to(roomName).emit('user-left', {
            socketId: socket.id,
            room: roomName,
            timestamp: new Date().toISOString(),
        });
    });

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

    // === LCS 제어 Socket.IO 이벤트들 ===

    // LCS 연결 상태 확인
    socket.on('lcs_get_status', () => {
        socket.emit('lcs_status_response', {
            success: true,
            data: lcsAgentManager.getConnectionStatus(),
        });
    });

    // LCS Agent 관리 이벤트들
    socket.on('lcs_add_agent', async (data) => {
        try {
            const { agentId, host, port, name } = data;
            const success = await lcsAgentManager.addAgent(agentId, host, port, name);
            socket.emit('lcs_add_agent_response', {
                success,
                agentId,
                message: success ? 'Agent 추가 성공' : 'Agent 추가 실패',
            });
            // 모든 클라이언트에게 Agent 목록 업데이트 알림
            io.emit('lcs_agents_updated', lcsAgentManager.getConnectionStatus());
        } catch (error) {
            socket.emit('lcs_add_agent_response', {
                success: false,
                error: error.message,
            });
        }
    });

    socket.on('lcs_remove_agent', (data) => {
        try {
            const { agentId } = data;
            const success = lcsAgentManager.removeAgent(agentId);
            socket.emit('lcs_remove_agent_response', {
                success,
                agentId,
                message: success ? 'Agent 제거 성공' : 'Agent 제거 실패',
            });
            io.emit('lcs_agents_updated', lcsAgentManager.getConnectionStatus());
        } catch (error) {
            socket.emit('lcs_remove_agent_response', {
                success: false,
                error: error.message,
            });
        }
    });

    socket.on('lcs_set_default_agent', (data) => {
        try {
            const { agentId } = data;
            const success = lcsAgentManager.setDefaultAgent(agentId);
            socket.emit('lcs_set_default_agent_response', {
                success,
                agentId,
                message: success ? '기본 Agent 설정 성공' : '기본 Agent 설정 실패',
            });
            io.emit('lcs_agents_updated', lcsAgentManager.getConnectionStatus());
        } catch (error) {
            socket.emit('lcs_set_default_agent_response', {
                success: false,
                error: error.message,
            });
        }
    });

    socket.on('lcs_reconnect_agent', async (data) => {
        try {
            const { agentId } = data;
            const success = await lcsAgentManager.reconnectAgent(agentId);
            socket.emit('lcs_reconnect_agent_response', {
                success,
                agentId,
                message: success ? 'Agent 재연결 성공' : 'Agent 재연결 실패',
            });
            io.emit('lcs_agents_updated', lcsAgentManager.getConnectionStatus());
        } catch (error) {
            socket.emit('lcs_reconnect_agent_response', {
                success: false,
                error: error.message,
            });
        }
    });

    // 조명 밝기 조회 (agentId 추가)
    socket.on('lcs_get_lamp_brightness', async (data) => {
        try {
            const { agentId, masterAddr, cuAddr, deviceType } = data;
            const response = await lcsAgentManager.getLampBrightness(agentId, masterAddr, cuAddr, deviceType);
            socket.emit('lcs_lamp_brightness_response', {
                success: true,
                data: response,
                request: data,
            });
        } catch (error) {
            socket.emit('lcs_lamp_brightness_response', {
                success: false,
                error: error.message,
                request: data,
            });
        }
    });

    // 개별 조명 제어 (agentId 추가)
    socket.on('lcs_control_lamp', async (data) => {
        try {
            const { agentId, masterAddr, cuAddr, lampNo, brightness } = data;
            const response = await lcsAgentManager.controlLamp(agentId, masterAddr, cuAddr, lampNo, brightness);

            socket.emit('lcs_lamp_control_response', {
                success: true,
                data: response,
                request: data,
            });

            // 다른 클라이언트들에게도 상태 변경 알림
            socket.broadcast.emit('lcs_lamp_status_changed', {
                agentId,
                masterAddr,
                cuAddr,
                lampNo,
                brightness,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            socket.emit('lcs_lamp_control_response', {
                success: false,
                error: error.message,
                request: data,
            });
        }
    });

    // 블록 조명 제어 (agentId 추가)
    socket.on('lcs_control_lamp_block', async (data) => {
        try {
            const { agentId, masterAddr, cuAddr, lampList, brightness } = data;
            const response = await lcsAgentManager.controlLampBlock(agentId, masterAddr, cuAddr, lampList, brightness);

            socket.emit('lcs_lamp_block_control_response', {
                success: true,
                data: response,
                request: data,
            });

            socket.broadcast.emit('lcs_lamp_block_status_changed', {
                agentId,
                masterAddr,
                cuAddr,
                lampList,
                brightness,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            socket.emit('lcs_lamp_block_control_response', {
                success: false,
                error: error.message,
                request: data,
            });
        }
    });

    // 색온도 제어 (agentId 추가)
    socket.on('lcs_control_color_temperature', async (data) => {
        try {
            const { agentId, masterAddr, cuAddr, lampList, colorTemp } = data;
            const response = await lcsAgentManager.controlColorTemperature(
                agentId,
                masterAddr,
                cuAddr,
                lampList,
                colorTemp
            );

            socket.emit('lcs_color_temp_control_response', {
                success: true,
                data: response,
                request: data,
            });

            socket.broadcast.emit('lcs_color_temp_status_changed', {
                agentId,
                masterAddr,
                cuAddr,
                lampList,
                colorTemp,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            socket.emit('lcs_color_temp_control_response', {
                success: false,
                error: error.message,
                request: data,
            });
        }
    });

    // 시나리오 실행 (agentId 추가)
    socket.on('lcs_execute_scene', async (data) => {
        try {
            const { agentId, masterAddr, cuAddr, sceneNo, fadeTime } = data;
            const response = await lcsAgentManager.executeScene(agentId, masterAddr, cuAddr, sceneNo, fadeTime);

            socket.emit('lcs_scene_execute_response', {
                success: true,
                data: response,
                request: data,
            });

            socket.broadcast.emit('lcs_scene_executed', {
                agentId,
                masterAddr,
                cuAddr,
                sceneNo,
                fadeTime,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            socket.emit('lcs_scene_execute_response', {
                success: false,
                error: error.message,
                request: data,
            });
        }
    });

    // 전체 조명 제어 (agentId 추가)
    socket.on('lcs_control_all_lamps', async (data) => {
        try {
            const { agentId, masterAddr, cuAddr, brightness } = data;
            const response = await lcsAgentManager.controlAllLamps(agentId, masterAddr, cuAddr, brightness);

            socket.emit('lcs_all_lamps_control_response', {
                success: true,
                data: response,
                request: data,
            });

            socket.broadcast.emit('lcs_all_lamps_status_changed', {
                agentId,
                masterAddr,
                cuAddr,
                brightness,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            socket.emit('lcs_all_lamps_control_response', {
                success: false,
                error: error.message,
                request: data,
            });
        }
    });

    // 디바이스 정보 조회
    socket.on('lcs_get_device_info', async () => {
        try {
            const response = await lcsAgentManager.getDeviceInfo();
            socket.emit('lcs_device_info_response', {
                success: true,
                data: response,
            });
        } catch (error) {
            socket.emit('lcs_device_info_response', {
                success: false,
                error: error.message,
            });
        }
    });

    // 페이드 제어 (agentId 추가)
    socket.on('lcs_fade_control', async (data) => {
        try {
            const { agentId, masterAddr, cuAddr, lampNo, startBrightness, endBrightness, duration } = data;

            socket.emit('lcs_fade_control_response', {
                success: true,
                message: '페이드 제어가 시작되었습니다.',
                request: data,
            });

            // 백그라운드에서 페이드 실행
            lcsAgentManager
                .fadeControl(agentId, masterAddr, cuAddr, lampNo, startBrightness, endBrightness, duration)
                .then(() => {
                    socket.emit('lcs_fade_control_completed', { request: data });
                })
                .catch((error) => {
                    socket.emit('lcs_fade_control_error', { error: error.message, request: data });
                });
        } catch (error) {
            socket.emit('lcs_fade_control_response', {
                success: false,
                error: error.message,
                request: data,
            });
        }
    });

    // 웨이브 효과 (agentId 추가)
    socket.on('lcs_wave_effect', async (data) => {
        try {
            const { agentId, masterAddr, cuAddr, lampList, brightness, interval } = data;

            socket.emit('lcs_wave_effect_response', {
                success: true,
                message: '웨이브 효과가 시작되었습니다.',
                request: data,
            });

            // 백그라운드에서 웨이브 효과 실행
            lcsAgentManager
                .waveEffect(agentId, masterAddr, cuAddr, lampList, brightness, interval)
                .then(() => {
                    socket.emit('lcs_wave_effect_completed', { request: data });
                })
                .catch((error) => {
                    socket.emit('lcs_wave_effect_error', { error: error.message, request: data });
                });
        } catch (error) {
            socket.emit('lcs_wave_effect_response', {
                success: false,
                error: error.message,
                request: data,
            });
        }
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

// LCS Agent 연결 시작
async function initializeLCS() {
    // 환경변수에서 기본 LCS Agent 설정 읽기
    const defaultHost = process.env.LCS_HOST || '127.0.0.1';
    const defaultPort = parseInt(process.env.LCS_PORT) || 1000;
    const defaultAgentId = 'default';

    console.log(`🔗 기본 LCS Agent 추가 시도: ${defaultHost}:${defaultPort}`);

    try {
        const success = await lcsAgentManager.addAgent(defaultAgentId, defaultHost, defaultPort, '기본 Agent');
        if (success) {
            console.log('✅ 기본 LCS Agent 연결 성공');
        } else {
            console.log('⚠️ 기본 LCS Agent 연결 실패 (재연결 시도 중...)');
        }
    } catch (error) {
        console.log('⚠️ 기본 LCS Agent 추가 실패:', error.message);
    }
}

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Unilux Socket Server가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📡 Socket.IO 서버가 준비되었습니다.`);
    console.log(`🏠 테스트 클라이언트: http://localhost:${PORT}/test-client.html`);
    console.log(`🌐 REST API: http://localhost:${PORT}/api/lcs/...`);
    console.log(`💡 LCS Agent는 사용자가 수동으로 추가할 수 있습니다.`);

    // LCS 자동 초기화 제거 - 사용자가 필요할 때 Agent 추가
    // initializeLCS();
});

// 정상 종료 처리
process.on('SIGINT', () => {
    console.log('\n🛑 서버 종료 중...');
    lcsAgentManager.disconnectAll();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 서버 종료 중...');
    lcsAgentManager.disconnectAll();
    process.exit(0);
});
