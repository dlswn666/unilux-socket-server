class LCSPacketBuilder {
    constructor() {
        this.STX = 0x02;
        this.ETX = 0x03;
        this.HOST_ADDRESS = [0x13, 0x00, 0x00, 0x00, 0x00]; // 호스트 기본 주소
    }

    /**
     * BCC(Block Check Character) 계산 (명세대로)
     * @param {Buffer} data - 전체 패킷 버퍼
     * @param {number} start - 목적지 주소 시작 인덱스
     * @param {number} end - Data 끝 다음 인덱스
     * @returns {number} 계산된 BCC (2바이트)
     */
    calculateBCC(data, start, end) {
        let sum = 0;
        let i = start;
        while (i < end) {
            let hi = data[i];
            let lo = i + 1 < end ? data[i + 1] : 0x00;
            sum += (hi << 8) | lo;
            i += 2;
        }
        // 상위 16비트와 하위 16비트 더함
        sum = (sum & 0xffff) + (sum >> 16);
        // 1의 보수
        sum = ~sum & 0xffff;
        return sum;
    }

    /**
     * 기본 패킷 생성
     * @param {Array} destAddr - 목적지 주소 [타입, 마스터, CU, 0, 0]
     * @param {number} op1 - 명령 코드 1
     * @param {number} op2 - 명령 코드 2
     * @param {Buffer} data - 데이터 버퍼
     * @returns {Buffer} 완성된 패킷
     */
    buildPacket(destAddr, op1, op2, data = Buffer.alloc(0)) {
        const headerSize = 18; // STX(1) + Length(2) + DestAddr(5) + SrcAddr(5) + OP1(1) + OP2(1) + BCC(2) + ETX(1)
        const totalLength = headerSize + data.length;

        const packet = Buffer.alloc(totalLength);
        let offset = 0;

        // STX
        packet[offset++] = this.STX;

        // Length (Big Endian)
        packet.writeUInt16BE(totalLength, offset);
        offset += 2;

        // 목적지 주소
        Buffer.from(destAddr).copy(packet, offset);
        offset += 5;

        // 소스 주소 (호스트)
        Buffer.from(this.HOST_ADDRESS).copy(packet, offset);
        offset += 5;

        // OP 코드
        packet[offset++] = op1;
        packet[offset++] = op2;

        // 데이터
        if (data.length > 0) {
            data.copy(packet, offset);
            offset += data.length;
        }

        // BCC 계산 (목적지~Data까지)
        const bccStart = 3; // 목적지 주소 시작
        const bccEnd = totalLength - 3; // BCC 2 + ETX 1 전까지
        const bcc = this.calculateBCC(packet, bccStart, bccEnd);
        packet.writeUInt16LE(bcc, offset);
        offset += 2;

        // ETX
        packet[offset] = this.ETX;

        // 디버깅 로그 추가
        console.log(`📦 LCS 패킷 생성: 길이=${totalLength}, 실제길이=${packet.length}`);
        console.log(`📦 패킷 내용: ${this.packetToHex(packet)}`);

        return packet;
    }

    /**
     * 조명 밝기 조회 패킷 생성
     * @param {number} masterAddr - 마스터 주소 (1-255)
     * @param {number} cuAddr - CU 주소 (1-255)
     * @param {string} deviceType - 'LCS' | 'RCU4' | 'RCU8'
     * @returns {Buffer} 조명 밝기 조회 패킷
     */
    getLampBrightness(masterAddr, cuAddr, deviceType = 'LCS') {
        const deviceTypeMap = {
            LCS: 0x13,
            RCU4: 0x55,
            RCU8: 0x57,
        };

        const destAddr = [deviceTypeMap[deviceType], masterAddr, cuAddr, 0x00, 0x00];
        return this.buildPacket(destAddr, 0x96, 0x00);
    }

    /**
     * 조명 색온도 조회 패킷 생성
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @returns {Buffer} 색온도 조회 패킷
     */
    getLampColorTemperature(masterAddr, cuAddr) {
        const destAddr = [0x13, masterAddr, cuAddr, 0x00, 0x00]; // LCS만 지원
        return this.buildPacket(destAddr, 0x96, 0x06);
    }

    /**
     * 블록 단위 조명 제어 패킷 생성
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {Array} lampList - 조명 번호 배열 [1, 2, 3, ...]
     * @param {number} brightness - 밝기 값 (0-100)
     * @returns {Buffer} 블록 제어 패킷
     */
    controlLampBlock(masterAddr, cuAddr, lampList, brightness) {
        const destAddr = [0x13, masterAddr, cuAddr, 0x00, 0x00];

        // 데이터 길이 수정: cuAddr(1) + lampCount(1) + lampList(n) + brightness(1)
        const data = Buffer.alloc(2 + lampList.length + 1);
        data[0] = cuAddr; // CU 주소
        data[1] = lampList.length; // 조명 개수

        // 조명 번호들
        for (let i = 0; i < lampList.length; i++) {
            data[2 + i] = lampList[i];
        }

        // 밝기 값 (마지막에 추가)
        data[2 + lampList.length] = brightness;

        return this.buildPacket(destAddr, 0x90, 0x00, data);
    }

    /**
     * 개별 조명 디밍 제어 패킷 생성
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {number} lampNo - 조명 번호 (1-64)
     * @param {number} brightness - 밝기 값 (0-100)
     * @returns {Buffer} 디밍 제어 패킷
     */
    controlLampDimming(masterAddr, cuAddr, lampNo, brightness) {
        const destAddr = [0x13, masterAddr, cuAddr, 0x00, 0x00];

        const data = Buffer.from([
            cuAddr, // CU 주소
            lampNo, // 조명 번호
            0x00, // 서브 번호 (보통 0)
            brightness, // 밝기 값
        ]);

        return this.buildPacket(destAddr, 0x92, 0x00, data);
    }

    /**
     * 색온도 제어 패킷 생성
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {Array} lampList - 조명 번호 배열
     * @param {number} colorTemp - 색온도 값 (0-100)
     * @returns {Buffer} 색온도 제어 패킷
     */
    controlLampColorTemp(masterAddr, cuAddr, lampList, colorTemp) {
        const destAddr = [0x13, masterAddr, cuAddr, 0x00, 0x00];

        const data = Buffer.alloc(2 + lampList.length + 1);
        data[0] = cuAddr;
        data[1] = lampList.length;

        for (let i = 0; i < lampList.length; i++) {
            data[2 + i] = lampList[i];
        }

        data[2 + lampList.length] = colorTemp;

        return this.buildPacket(destAddr, 0x90, 0x05, data);
    }

    /**
     * 시나리오 실행 패킷 생성
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {number} sceneNo - 시나리오 번호 (1-255)
     * @param {number} fadeTime - 페이드 시간 (초)
     * @returns {Buffer} 시나리오 실행 패킷
     */
    executeScene(masterAddr, cuAddr, sceneNo, fadeTime = 0) {
        const destAddr = [0x13, masterAddr, cuAddr, 0x00, 0x00];

        const data = Buffer.from([
            cuAddr, // CU 주소
            sceneNo, // 시나리오 번호
            fadeTime, // 페이드 시간
        ]);

        return this.buildPacket(destAddr, 0x91, 0x00, data);
    }

    /**
     * 전체 조명 ON/OFF 패킷 생성
     * @param {number} masterAddr - 마스터 주소
     * @param {number} cuAddr - CU 주소
     * @param {number} brightness - 밝기 값 (0=OFF, 1-100=ON)
     * @returns {Buffer} 전체 제어 패킷
     */
    controlAllLamps(masterAddr, cuAddr, brightness) {
        const destAddr = [0x13, masterAddr, cuAddr, 0x00, 0x00];

        const data = Buffer.from([
            cuAddr, // CU 주소
            brightness, // 밝기 값
        ]);

        return this.buildPacket(destAddr, 0x90, 0x02, data);
    }

    /**
     * 디바이스 이름 조회 패킷 생성
     * @returns {Buffer} 디바이스 이름 조회 패킷
     */
    getDeviceName() {
        const destAddr = [0x13, 0x00, 0x00, 0x00, 0x00]; // 브로드캐스트
        return this.buildPacket(destAddr, 0xa2, 0x05);
    }

    /**
     * 패킷을 16진수 문자열로 변환 (디버깅용)
     * @param {Buffer} packet - 패킷 버퍼
     * @returns {string} 16진수 문자열
     */
    packetToHex(packet) {
        return packet.toString('hex').toUpperCase().match(/.{2}/g).join(' ');
    }
}

module.exports = LCSPacketBuilder;
