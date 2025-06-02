const LCSController = require('./controller');

class LCSAgentManager {
    constructor() {
        this.agents = new Map(); // agentId -> LCSController 인스턴스
        this.defaultAgentId = null;
    }

    /**
     * 새로운 LCS Agent 추가
     * @param {string} agentId - 고유 Agent ID
     * @param {string} host - Agent 호스트
     * @param {number} port - Agent 포트
     * @param {string} name - Agent 이름 (선택사항)
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async addAgent(agentId, host, port, name = null) {
        if (this.agents.has(agentId)) {
            throw new Error(`Agent ID '${agentId}'는 이미 존재합니다.`);
        }

        const controller = new LCSController(host, port);
        controller.agentId = agentId;
        controller.name = name || `Agent-${agentId}`;
        controller.host = host;
        controller.port = port;

        // 이벤트 핸들러 추가
        controller.client.on('connected', () => {
            console.log(`✅ LCS Agent '${controller.name}' (${agentId}) 연결 성공`);
        });

        controller.client.on('disconnected', () => {
            console.log(`⚠️ LCS Agent '${controller.name}' (${agentId}) 연결 끊어짐`);
        });

        controller.client.on('error', (error) => {
            console.error(`❌ LCS Agent '${controller.name}' (${agentId}) 오류:`, error.message);
        });

        this.agents.set(agentId, controller);

        // 첫 번째 Agent를 기본값으로 설정
        if (!this.defaultAgentId) {
            this.defaultAgentId = agentId;
        }

        try {
            const success = await controller.connect();
            return success;
        } catch (error) {
            console.error(`LCS Agent '${agentId}' 연결 실패:`, error.message);
            return false;
        }
    }

    /**
     * Agent 제거
     * @param {string} agentId - 제거할 Agent ID
     * @returns {boolean} 제거 성공 여부
     */
    removeAgent(agentId) {
        const controller = this.agents.get(agentId);
        if (!controller) {
            return false;
        }

        controller.disconnect();
        this.agents.delete(agentId);

        // 기본 Agent가 제거된 경우 다른 Agent를 기본값으로 설정
        if (this.defaultAgentId === agentId) {
            const remainingAgents = Array.from(this.agents.keys());
            this.defaultAgentId = remainingAgents.length > 0 ? remainingAgents[0] : null;
        }

        console.log(`🗑️ LCS Agent '${agentId}' 제거됨`);
        return true;
    }

    /**
     * Agent 가져오기
     * @param {string} agentId - Agent ID (없으면 기본 Agent)
     * @returns {LCSController|null} LCS Controller 인스턴스
     */
    getAgent(agentId = null) {
        const targetId = agentId || this.defaultAgentId;
        return this.agents.get(targetId) || null;
    }

    /**
     * 모든 Agent 목록 가져오기
     * @returns {Array} Agent 정보 배열
     */
    getAllAgents() {
        const agents = [];
        for (const [agentId, controller] of this.agents) {
            agents.push({
                agentId,
                name: controller.name,
                host: controller.host,
                port: controller.port,
                isConnected: controller.isConnected,
                isDefault: agentId === this.defaultAgentId,
            });
        }
        return agents;
    }

    /**
     * 기본 Agent 설정
     * @param {string} agentId - 기본으로 설정할 Agent ID
     * @returns {boolean} 설정 성공 여부
     */
    setDefaultAgent(agentId) {
        if (!this.agents.has(agentId)) {
            return false;
        }
        this.defaultAgentId = agentId;
        console.log(`🔧 기본 LCS Agent를 '${agentId}'로 설정`);
        return true;
    }

    /**
     * Agent 재연결
     * @param {string} agentId - 재연결할 Agent ID
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async reconnectAgent(agentId) {
        const controller = this.agents.get(agentId);
        if (!controller) {
            throw new Error(`Agent ID '${agentId}'를 찾을 수 없습니다.`);
        }

        console.log(`🔄 LCS Agent '${agentId}' 재연결 시도...`);
        return await controller.connect();
    }

    /**
     * 모든 Agent 연결 상태 확인
     * @returns {Object} 전체 연결 상태
     */
    getConnectionStatus() {
        const agents = this.getAllAgents();
        const connectedCount = agents.filter((agent) => agent.isConnected).length;

        return {
            totalAgents: agents.length,
            connectedAgents: connectedCount,
            defaultAgentId: this.defaultAgentId,
            agents: agents,
        };
    }

    /**
     * 모든 Agent 해제
     */
    disconnectAll() {
        for (const [agentId, controller] of this.agents) {
            controller.disconnect();
            console.log(`🔌 LCS Agent '${agentId}' 연결 해제`);
        }
        this.agents.clear();
        this.defaultAgentId = null;
    }

    /**
     * Agent를 통한 조명 제어 (프록시 메서드들)
     */
    async controlLamp(agentId, masterAddr, cuAddr, lampNo, brightness) {
        const agent = this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent를 찾을 수 없습니다: ${agentId || 'default'}`);
        }
        return await agent.controlLamp(masterAddr, cuAddr, lampNo, brightness);
    }

    async controlLampBlock(agentId, masterAddr, cuAddr, lampList, brightness) {
        const agent = this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent를 찾을 수 없습니다: ${agentId || 'default'}`);
        }
        return await agent.controlLampBlock(masterAddr, cuAddr, lampList, brightness);
    }

    async controlColorTemperature(agentId, masterAddr, cuAddr, lampList, colorTemp) {
        const agent = this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent를 찾을 수 없습니다: ${agentId || 'default'}`);
        }
        return await agent.controlColorTemperature(masterAddr, cuAddr, lampList, colorTemp);
    }

    async executeScene(agentId, masterAddr, cuAddr, sceneNo, fadeTime) {
        const agent = this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent를 찾을 수 없습니다: ${agentId || 'default'}`);
        }
        return await agent.executeScene(masterAddr, cuAddr, sceneNo, fadeTime);
    }

    async controlAllLamps(agentId, masterAddr, cuAddr, brightness) {
        const agent = this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent를 찾을 수 없습니다: ${agentId || 'default'}`);
        }
        return await agent.controlAllLamps(masterAddr, cuAddr, brightness);
    }

    async getLampBrightness(agentId, masterAddr, cuAddr, deviceType) {
        const agent = this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent를 찾을 수 없습니다: ${agentId || 'default'}`);
        }
        return await agent.getLampBrightness(masterAddr, cuAddr, deviceType);
    }

    async fadeControl(agentId, masterAddr, cuAddr, lampNo, startBrightness, endBrightness, duration) {
        const agent = this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent를 찾을 수 없습니다: ${agentId || 'default'}`);
        }
        return await agent.fadeControl(masterAddr, cuAddr, lampNo, startBrightness, endBrightness, duration);
    }

    async waveEffect(agentId, masterAddr, cuAddr, lampList, brightness, interval) {
        const agent = this.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent를 찾을 수 없습니다: ${agentId || 'default'}`);
        }
        return await agent.waveEffect(masterAddr, cuAddr, lampList, brightness, interval);
    }
}

module.exports = LCSAgentManager;
