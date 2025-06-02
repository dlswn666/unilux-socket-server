// 사용 예제 모음

// ===== 웹소켓 클라이언트 예제 (브라우저에서 사용) =====
/*
<!DOCTYPE html>
<html>
<head>
    <title>조명 제어 시스템</title>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <script>
        const socket = io();
        
        // 개별 조명 제어
        function controlLamp(masterAddr, cuAddr, lampNo, brightness) {
            socket.emit('control_lamp', {
                masterAddr: masterAddr,
                cuAddr: cuAddr, 
                lampNo: lampNo,
                brightness: brightness
            });
        }
        
        // 응답 처리
        socket.on('lamp_control_response', (response) => {
            if (response.success) {
                console.log('조명 제어 성공:', response.data);
            } else {
                console.error('조명 제어 실패:', response.error);
            }
        });
        
        // 사용 예
        controlLamp(1, 1, 5, 80); // 마스터1, CU1, 조명5번, 밝기 80%
    </script>
</body>
</html>
*/

// ===== Node.js 서버 측 직접 사용 예제 =====
const LCSTcpClient = require('./lcs-tcp-client');

async function directUsageExample() {
    const lcsClient = new LCSTcpClient('127.0.0.1', 1000);

    try {
        // LCS Agent에 연결
        await lcsClient.connect();
        console.log('LCS Agent 연결 성공');

        // 1. 디바이스 정보 조회
        console.log('\n=== 디바이스 정보 조회 ===');
        const deviceInfo = await lcsClient.getDeviceInfo();
        console.log('디바이스 정보:', deviceInfo);

        // 2. 조명 밝기 조회
        console.log('\n=== 조명 밝기 조회 ===');
        const brightness = await lcsClient.getLampBrightness(1, 1, 'LCS');
        console.log('조명 밝기:', brightness);

        // 3. 개별 조명 제어 (조명 5번을 80% 밝기로)
        console.log('\n=== 개별 조명 제어 ===');
        const lampControl = await lcsClient.controlLamp(1, 1, 5, 80);
        console.log('조명 제어 결과:', lampControl);

        // 4. 다중 조명 블록 제어 (조명 1,2,3번을 60% 밝기로)
        console.log('\n=== 블록 조명 제어 ===');
        const blockControl = await lcsClient.controlLampBlock(1, 1, [1, 2, 3], 60);
        console.log('블록 제어 결과:', blockControl);

        // 5. 색온도 제어 (조명 1,2번의 색온도를 70으로)
        console.log('\n=== 색온도 제어 ===');
        const colorControl = await lcsClient.controlColorTemperature(1, 1, [1, 2], 70);
        console.log('색온도 제어 결과:', colorControl);

        // 6. 시나리오 실행 (시나리오 3번을 5초 페이드로)
        console.log('\n=== 시나리오 실행 ===');
        const sceneExec = await lcsClient.executeScene(1, 1, 3, 5);
        console.log('시나리오 실행 결과:', sceneExec);

        // 7. 전체 조명 OFF
        console.log('\n=== 전체 조명 OFF ===');
        const allOff = await lcsClient.controlAllLamps(1, 1, 0);
        console.log('전체 OFF 결과:', allOff);

        // 8. 2초 후 전체 조명 50% ON
        setTimeout(async () => {
            console.log('\n=== 전체 조명 50% ON ===');
            const allOn = await lcsClient.controlAllLamps(1, 1, 50);
            console.log('전체 50% ON 결과:', allOn);

            // 연결 해제
            lcsClient.disconnect();
        }, 2000);
    } catch (error) {
        console.error('오류 발생:', error);
        lcsClient.disconnect();
    }
}

// ===== REST API 사용 예제 =====
async function restApiExample() {
    const axios = require('axios');
    const baseURL = 'http://localhost:3000/api';

    try {
        // 1. 조명 밝기 조회
        const brightnessResponse = await axios.get(`${baseURL}/lamps/1/1/brightness`);
        console.log('조명 밝기:', brightnessResponse.data);

        // 2. 개별 조명 제어
        const controlResponse = await axios.post(`${baseURL}/lamps/1/1/5/control`, {
            brightness: 75,
        });
        console.log('조명 제어:', controlResponse.data);

        // 3. 블록 제어
        const blockResponse = await axios.post(`${baseURL}/lamps/1/1/block-control`, {
            lampList: [1, 2, 3, 4],
            brightness: 90,
        });
        console.log('블록 제어:', blockResponse.data);

        // 4. 시나리오 실행
        const sceneResponse = await axios.post(`${baseURL}/scenes/1/1/2/execute`, {
            fadeTime: 3,
        });
        console.log('시나리오 실행:', sceneResponse.data);
    } catch (error) {
        console.error('REST API 오류:', error.response?.data || error.message);
    }
}

// ===== 고급 시나리오 예제 =====
class AdvancedLightingScenarios {
    constructor(lcsClient) {
        this.lcsClient = lcsClient;
    }

    // 점진적 밝기 조절 (페이드 효과)
    async fadeControl(masterAddr, cuAddr, lampNo, startBrightness, endBrightness, duration) {
        const steps = 20;
        const stepDuration = (duration * 1000) / steps;
        const stepSize = (endBrightness - startBrightness) / steps;

        for (let i = 0; i <= steps; i++) {
            const currentBrightness = Math.round(startBrightness + stepSize * i);
            await this.lcsClient.controlLamp(masterAddr, cuAddr, lampNo, currentBrightness);

            if (i < steps) {
                await new Promise((resolve) => setTimeout(resolve, stepDuration));
            }
        }
    }

    // 순차적 조명 켜기 (웨이브 효과)
    async waveEffect(masterAddr, cuAddr, lampList, brightness, interval = 500) {
        for (const lampNo of lampList) {
            await this.lcsClient.controlLamp(masterAddr, cuAddr, lampNo, brightness);
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }

    // 조명 상태 모니터링 및 자동 제어
    async monitorAndControl(masterAddr, cuAddr, targetBrightness = 70) {
        setInterval(async () => {
            try {
                const response = await this.lcsClient.getLampBrightness(masterAddr, cuAddr);

                if (response.type === 'lamp_brightness') {
                    const avgBrightness = response.brightness.reduce((a, b) => a + b, 0) / response.brightness.length;

                    if (Math.abs(avgBrightness - targetBrightness) > 10) {
                        console.log(`밝기 조정 필요: 현재 ${avgBrightness}% → 목표 ${targetBrightness}%`);
                        await this.lcsClient.controlAllLamps(masterAddr, cuAddr, targetBrightness);
                    }
                }
            } catch (error) {
                console.error('모니터링 오류:', error);
            }
        }, 30000); // 30초마다 확인
    }

    // 시간대별 자동 조명 제어
    async scheduleBasedControl(masterAddr, cuAddr) {
        const schedule = [
            { time: '06:00', brightness: 30, scene: 1 }, // 새벽
            { time: '08:00', brightness: 70, scene: 2 }, // 아침
            { time: '12:00', brightness: 90, scene: 3 }, // 낮
            { time: '18:00', brightness: 60, scene: 4 }, // 저녁
            { time: '22:00', brightness: 20, scene: 5 }, // 밤
            { time: '00:00', brightness: 0, scene: 0 }, // 소등
        ];

        setInterval(() => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
                .getMinutes()
                .toString()
                .padStart(2, '0')}`;

            const currentSchedule = schedule.find((s) => s.time === currentTime);
            if (currentSchedule) {
                console.log(
                    `스케줄 실행: ${currentTime} - 밝기 ${currentSchedule.brightness}%, 시나리오 ${currentSchedule.scene}`
                );

                if (currentSchedule.scene > 0) {
                    this.lcsClient.executeScene(masterAddr, cuAddr, currentSchedule.scene);
                } else {
                    this.lcsClient.controlAllLamps(masterAddr, cuAddr, currentSchedule.brightness);
                }
            }
        }, 60000); // 1분마다 확인
    }
}

// ===== 패킷 레벨 직접 조작 예제 =====
const LCSPacketBuilder = require('./lcs-packet-builder');

function customPacketExample() {
    const packetBuilder = new LCSPacketBuilder();

    // 커스텀 패킷 생성 (예: 특수 명령)
    const customPacket = packetBuilder.buildPacket(
        [0x13, 0x01, 0x01, 0x00, 0x00], // 목적지: LCS, 마스터1, CU1
        0x98, // OP1: 디바이스 통신 확인
        0x00, // OP2: Alive 체크
        Buffer.from([0x01]) // 데이터: 확인 요청
    );

    console.log('커스텀 패킷:', packetBuilder.packetToHex(customPacket));

    // Buffer를 직접 조작하여 패킷 생성
    const manualPacket = Buffer.alloc(18); // 최소 패킷 크기
    let offset = 0;

    manualPacket[offset++] = 0x02; // STX
    manualPacket.writeUInt16LE(18, offset);
    offset += 2; // 길이
    manualPacket[offset++] = 0x13; // 목적지 타입
    manualPacket[offset++] = 0x01; // 목적지 마스터
    manualPacket[offset++] = 0x01; // 목적지 CU
    manualPacket[offset++] = 0x00; // 목적지 예약1
    manualPacket[offset++] = 0x00; // 목적지 예약2
    manualPacket[offset++] = 0x13; // 소스 타입
    manualPacket[offset++] = 0x00; // 소스 마스터
    manualPacket[offset++] = 0x00; // 소스 CU
    manualPacket[offset++] = 0x00; // 소스 예약1
    manualPacket[offset++] = 0x00; // 소스 예약2
    manualPacket[offset++] = 0xa2; // OP1
    manualPacket[offset++] = 0x05; // OP2
    manualPacket.writeUInt16LE(0x0000, offset);
    offset += 2; // BCC (계산 필요)
    manualPacket[offset] = 0x03; // ETX

    console.log('수동 패킷:', manualPacket.toString('hex').toUpperCase());
}

// 실행 예제
if (require.main === module) {
    console.log('=== LCS Agent 통신 예제 ===\n');

    // 직접 사용 예제 실행
    directUsageExample();

    // 커스텀 패킷 예제
    setTimeout(() => {
        console.log('\n=== 커스텀 패킷 예제 ===');
        customPacketExample();
    }, 1000);
}

module.exports = {
    directUsageExample,
    restApiExample,
    AdvancedLightingScenarios,
    customPacketExample,
};
