const LCSTcpClient = require('./tcp-client');

class LCSController {
    constructor(host = '127.0.0.1', port = 1000) {
        this.client = new LCSTcpClient(host, port);
        this.isConnected = false;
        this.reconnectInterval = null;
        this.setupEventHandlers();
    }

    /**
     * 이벤트 핸들러 설정
     */
    setupEventHandlers() {
        this.client.on('connected', () => {
            this.isConnected = true;
            console.log('🔗 LCS Agent 연결 성공');
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
        });

        this.client.on('disconnected', () => {
            this.isConnected = false;
            console.log('⚠️ LCS Agent 연결 끊어짐');
            this.startReconnectTimer();
        });

        this.client.on('error', (error) => {
            console.error('❌ LCS Agent 오류:', error.message);
            this.isConnected = false;
        });
    }

    /**
     * LCS Agent 연결
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async connect() {
        try {
            await this.client.connect();
            return true;
        } catch (error) {
            console.error('LCS Agent 연결 실패:', error.message);
            this.startReconnectTimer();
            return false;
        }
    }

    /**
     * 연결 해제
     */
    disconnect() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        this.client.disconnect();
        this.isConnected = false;
    }

    /**
     * 재연결 타이머 시작
     */
    startReconnectTimer() {
        if (this.reconnectInterval) return;

        console.log('🔄 5초 후 LCS Agent 재연결 시도...');
        this.reconnectInterval = setInterval(async () => {
            console.log('🔄 LCS Agent 재연결 시도 중...');
            try {
                await this.client.connect();
            } catch (error) {
                console.log('재연결 실패, 계속 시도 중...');
            }
        }, 5000);
    }

    /**
     * 연결 상태 확인
     * @returns {boolean} 연결 상태
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            host: this.client.host,
            port: this.client.port,
        };
    }

    /**
     * 조명 밝기 조회
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {string} deviceType - 디바이스 타입
     * @returns {Promise<Object>} 조명 밝기 정보
     */
    async getLampBrightness(masterAddr, cuAddr, deviceType = 'LCS') {
        if (!this.isConnected) {
            throw new Error('LCS Agent에 연결되지 않음');
        }
        return await this.client.getLampBrightness(masterAddr, cuAddr, deviceType);
    }

    /**
     * 조명 색온도 조회
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @returns {Promise<Object>} 색온도 정보
     */
    async getLampColorTemperature(masterAddr, cuAddr) {
        if (!this.isConnected) {
            throw new Error('LCS Agent에 연결되지 않음');
        }
        return await this.client.getLampColorTemperature(masterAddr, cuAddr);
    }

    /**
     * 개별 조명 제어
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {number} lampNo - 조명 번호
     * @param {number} brightness - 밝기 값 (0-100)
     * @returns {Promise<Object>} 제어 결과
     */
    async controlLamp(masterAddr, cuAddr, lampNo, brightness) {
        if (!this.isConnected) {
            throw new Error('LCS Agent에 연결되지 않음');
        }
        return await this.client.controlLamp(masterAddr, cuAddr, lampNo, brightness);
    }

    /**
     * 다중 조명 블록 제어
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {Array} lampList - 조명 번호 배열
     * @param {number} brightness - 밝기 값 (0-100)
     * @returns {Promise<Object>} 제어 결과
     */
    async controlLampBlock(masterAddr, cuAddr, lampList, brightness) {
        if (!this.isConnected) {
            throw new Error('LCS Agent에 연결되지 않음');
        }
        return await this.client.controlLampBlock(masterAddr, cuAddr, lampList, brightness);
    }

    /**
     * 색온도 제어
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {Array} lampList - 조명 번호 배열
     * @param {number} colorTemp - 색온도 값 (0-100)
     * @returns {Promise<Object>} 제어 결과
     */
    async controlColorTemperature(masterAddr, cuAddr, lampList, colorTemp) {
        if (!this.isConnected) {
            throw new Error('LCS Agent에 연결되지 않음');
        }
        return await this.client.controlColorTemperature(masterAddr, cuAddr, lampList, colorTemp);
    }

    /**
     * 시나리오 실행
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {number} sceneNo - 시나리오 번호
     * @param {number} fadeTime - 페이드 시간 (초)
     * @returns {Promise<Object>} 실행 결과
     */
    async executeScene(masterAddr, cuAddr, sceneNo, fadeTime = 0) {
        if (!this.isConnected) {
            throw new Error('LCS Agent에 연결되지 않음');
        }
        return await this.client.executeScene(masterAddr, cuAddr, sceneNo, fadeTime);
    }

    /**
     * 전체 조명 제어
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {number} brightness - 밝기 값 (0-100)
     * @returns {Promise<Object>} 제어 결과
     */
    async controlAllLamps(masterAddr, cuAddr, brightness) {
        if (!this.isConnected) {
            throw new Error('LCS Agent에 연결되지 않음');
        }
        return await this.client.controlAllLamps(masterAddr, cuAddr, brightness);
    }

    /**
     * 디바이스 정보 조회
     * @returns {Promise<Object>} 디바이스 정보
     */
    async getDeviceInfo() {
        if (!this.isConnected) {
            throw new Error('LCS Agent에 연결되지 않음');
        }
        return await this.client.getDeviceInfo();
    }

    /**
     * 고급 제어: 점진적 밝기 조절 (페이드 효과)
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {number} lampNo - 조명 번호
     * @param {number} startBrightness - 시작 밝기
     * @param {number} endBrightness - 끝 밝기
     * @param {number} duration - 지속 시간 (초)
     * @returns {Promise<void>}
     */
    async fadeControl(masterAddr, cuAddr, lampNo, startBrightness, endBrightness, duration) {
        if (!this.isConnected) {
            throw new Error('LCS Agent에 연결되지 않음');
        }

        const steps = 20;
        const stepDuration = (duration * 1000) / steps;
        const stepSize = (endBrightness - startBrightness) / steps;

        for (let i = 0; i <= steps; i++) {
            const currentBrightness = Math.round(startBrightness + stepSize * i);
            await this.controlLamp(masterAddr, cuAddr, lampNo, currentBrightness);

            if (i < steps) {
                await new Promise((resolve) => setTimeout(resolve, stepDuration));
            }
        }
    }

    /**
     * 고급 제어: 순차적 조명 켜기 (웨이브 효과)
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {Array} lampList - 조명 번호 배열
     * @param {number} brightness - 밝기 값
     * @param {number} interval - 간격 (밀리초)
     * @returns {Promise<void>}
     */
    async waveEffect(masterAddr, cuAddr, lampList, brightness, interval = 500) {
        if (!this.isConnected) {
            throw new Error('LCS Agent에 연결되지 않음');
        }

        for (const lampNo of lampList) {
            await this.controlLamp(masterAddr, cuAddr, lampNo, brightness);
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }
}

module.exports = LCSController;
