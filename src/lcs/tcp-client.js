const net = require('net');
const EventEmitter = require('events');
const LCSPacketBuilder = require('./packet-builder');

class LCSTcpClient extends EventEmitter {
    constructor(host = '127.0.0.1', port = 1000) {
        super();
        this.host = host;
        this.port = port;
        this.socket = null;
        this.isConnected = false;
        this.packetBuilder = new LCSPacketBuilder();
        this.responseBuffer = Buffer.alloc(0);
        this.responseCallbacks = new Map();
        this.requestId = 0;
    }

    /**
     * LCS Agent에 연결
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();

            this.socket.connect(this.port, this.host, () => {
                this.isConnected = true;
                console.log(`LCS Agent에 연결됨: ${this.host}:${this.port}`);
                this.emit('connected');
                resolve(true);
            });

            this.socket.on('data', (data) => {
                this.handleResponse(data);
            });

            this.socket.on('error', (error) => {
                console.error('LCS Agent 연결 오류:', error);
                this.isConnected = false;
                this.emit('error', error);
                reject(error);
            });

            this.socket.on('close', () => {
                this.isConnected = false;
                console.log('LCS Agent 연결 종료');
                this.emit('disconnected');
            });
        });
    }

    /**
     * 연결 해제
     */
    disconnect() {
        if (this.socket) {
            this.socket.destroy();
            this.isConnected = false;
        }
    }

    /**
     * 응답 데이터 처리
     * @param {Buffer} data - 수신된 데이터
     */
    handleResponse(data) {
        this.responseBuffer = Buffer.concat([this.responseBuffer, data]);

        // 완전한 패킷이 있는지 확인하고 파싱
        while (this.responseBuffer.length >= 18) {
            // 최소 패킷 크기
            const packetInfo = this.parseResponsePacket(this.responseBuffer);

            if (packetInfo.isComplete) {
                const responseData = this.interpretResponse(packetInfo);
                this.emit('response', responseData);

                // 처리된 패킷만큼 버퍼에서 제거
                this.responseBuffer = this.responseBuffer.slice(packetInfo.totalLength);
            } else {
                break; // 완전한 패킷이 아직 수신되지 않음
            }
        }
    }

    /**
     * 응답 패킷 파싱
     * @param {Buffer} buffer - 응답 버퍼
     * @returns {Object} 파싱된 패킷 정보
     */
    parseResponsePacket(buffer) {
        if (buffer.length < 18) {
            return { isComplete: false };
        }

        if (buffer[0] !== 0x02) {
            // STX 확인
            return { isComplete: false };
        }

        const packetLength = buffer.readUInt16LE(1);

        if (buffer.length < packetLength) {
            return { isComplete: false };
        }

        if (buffer[packetLength - 1] !== 0x03) {
            // ETX 확인
            return { isComplete: false };
        }

        // 패킷 필드 추출
        const destAddr = Array.from(buffer.slice(3, 8));
        const srcAddr = Array.from(buffer.slice(8, 13));
        const op1 = buffer[13];
        const op2 = buffer[14];
        const dataLength = packetLength - 18; // 헤더 + BCC + ETX 제외
        const responseData = buffer.slice(15, 15 + dataLength);
        const bcc = buffer.readUInt16LE(15 + dataLength);

        return {
            isComplete: true,
            totalLength: packetLength,
            destAddr,
            srcAddr,
            op1,
            op2,
            data: responseData,
            bcc,
        };
    }

    /**
     * 응답 데이터 해석
     * @param {Object} packetInfo - 파싱된 패킷 정보
     * @returns {Object} 해석된 응답 데이터
     */
    interpretResponse(packetInfo) {
        const { op1, op2, data, srcAddr } = packetInfo;
        const opCode = (op1 << 8) | op2;

        const response = {
            opCode: `0x${opCode.toString(16).toUpperCase().padStart(4, '0')}`,
            sourceDevice: {
                type: srcAddr[0],
                masterAddr: srcAddr[1],
                cuAddr: srcAddr[2],
            },
            timestamp: new Date(),
            rawData: data,
        };

        // OP 코드별 데이터 해석
        switch (opCode) {
            case 0x1600: // 조명 밝기 응답 (0x96 → 0x16)
                response.type = 'lamp_brightness';
                response.brightness = Array.from(data);
                break;

            case 0x1606: // 색온도 응답 (0x96 → 0x16)
                response.type = 'color_temperature';
                response.colorTemperature = Array.from(data);
                break;

            case 0x1000: // 조명 제어 응답 (0x90 → 0x10)
                response.type = 'lamp_control_ack';
                response.result = data[0] === 0x00 ? 'success' : 'failed';
                break;

            case 0x2205: // 디바이스 이름 응답 (0xA2 → 0x22)
                response.type = 'device_name';
                response.deviceName = data.toString('utf8').replace(/\0/g, '');
                break;

            default:
                response.type = 'unknown';
                response.hexData = data.toString('hex').toUpperCase();
        }

        return response;
    }

    /**
     * 패킷 전송
     * @param {Buffer} packet - 전송할 패킷
     * @returns {Promise<Object>} 응답 데이터
     */
    sendPacket(packet) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('LCS Agent에 연결되지 않음'));
                return;
            }

            const requestId = ++this.requestId;

            // 응답 콜백 등록 (타임아웃 설정)
            const timeout = setTimeout(() => {
                this.responseCallbacks.delete(requestId);
                reject(new Error('응답 타임아웃'));
            }, 5000);

            this.responseCallbacks.set(requestId, { resolve, reject, timeout });

            // 응답 이벤트 리스너 (일회성)
            const responseHandler = (response) => {
                const callback = this.responseCallbacks.get(requestId);
                if (callback) {
                    clearTimeout(callback.timeout);
                    this.responseCallbacks.delete(requestId);
                    this.off('response', responseHandler);
                    resolve(response);
                }
            };

            this.on('response', responseHandler);

            // 패킷 전송
            this.socket.write(packet);

            console.log('전송 패킷:', this.packetBuilder.packetToHex(packet));
        });
    }

    /**
     * 조명 밝기 조회
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {string} deviceType - 디바이스 타입
     * @returns {Promise<Object>} 조명 밝기 정보
     */
    async getLampBrightness(masterAddr, cuAddr, deviceType = 'LCS') {
        const packet = this.packetBuilder.getLampBrightness(masterAddr, cuAddr, deviceType);
        return await this.sendPacket(packet);
    }

    /**
     * 조명 색온도 조회
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @returns {Promise<Object>} 색온도 정보
     */
    async getLampColorTemperature(masterAddr, cuAddr) {
        const packet = this.packetBuilder.getLampColorTemperature(masterAddr, cuAddr);
        return await this.sendPacket(packet);
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
        const packet = this.packetBuilder.controlLampDimming(masterAddr, cuAddr, lampNo, brightness);
        return await this.sendPacket(packet);
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
        const packet = this.packetBuilder.controlLampBlock(masterAddr, cuAddr, lampList, brightness);
        return await this.sendPacket(packet);
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
        const packet = this.packetBuilder.controlLampColorTemp(masterAddr, cuAddr, lampList, colorTemp);
        return await this.sendPacket(packet);
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
        const packet = this.packetBuilder.executeScene(masterAddr, cuAddr, sceneNo, fadeTime);
        return await this.sendPacket(packet);
    }

    /**
     * 전체 조명 제어
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {number} brightness - 밝기 값 (0-100)
     * @returns {Promise<Object>} 제어 결과
     */
    async controlAllLamps(masterAddr, cuAddr, brightness) {
        const packet = this.packetBuilder.controlAllLamps(masterAddr, cuAddr, brightness);
        return await this.sendPacket(packet);
    }

    /**
     * 디바이스 검색
     * @returns {Promise<Object>} 디바이스 정보
     */
    async getDeviceInfo() {
        const packet = this.packetBuilder.getDeviceName();
        return await this.sendPacket(packet);
    }
}

module.exports = LCSTcpClient;
