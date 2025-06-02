const express = require('express');
const router = express.Router();

// API 라우트 설정 함수
function setupLCSApiRoutes(lcsController) {
    // LCS 연결 상태 확인
    router.get('/lcs/status', (req, res) => {
        const status = lcsController.getConnectionStatus();
        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString(),
        });
    });

    // 조명 밝기 조회
    router.get('/lcs/lamps/:masterAddr/:cuAddr/brightness', async (req, res) => {
        try {
            const { masterAddr, cuAddr } = req.params;
            const { deviceType = 'LCS' } = req.query;

            const response = await lcsController.getLampBrightness(parseInt(masterAddr), parseInt(cuAddr), deviceType);

            res.json({ success: true, data: response });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // 조명 색온도 조회
    router.get('/lcs/lamps/:masterAddr/:cuAddr/color-temperature', async (req, res) => {
        try {
            const { masterAddr, cuAddr } = req.params;

            const response = await lcsController.getLampColorTemperature(parseInt(masterAddr), parseInt(cuAddr));

            res.json({ success: true, data: response });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // 개별 조명 제어
    router.post('/lcs/lamps/:masterAddr/:cuAddr/:lampNo/control', async (req, res) => {
        try {
            const { masterAddr, cuAddr, lampNo } = req.params;
            const { brightness } = req.body;

            if (brightness === undefined || brightness < 0 || brightness > 100) {
                return res.status(400).json({
                    success: false,
                    error: '밝기 값은 0-100 사이여야 합니다.',
                });
            }

            const response = await lcsController.controlLamp(
                parseInt(masterAddr),
                parseInt(cuAddr),
                parseInt(lampNo),
                brightness
            );

            res.json({ success: true, data: response });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // 블록 조명 제어
    router.post('/lcs/lamps/:masterAddr/:cuAddr/block-control', async (req, res) => {
        try {
            const { masterAddr, cuAddr } = req.params;
            const { lampList, brightness } = req.body;

            if (!Array.isArray(lampList) || lampList.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '조명 번호 배열이 필요합니다.',
                });
            }

            if (brightness === undefined || brightness < 0 || brightness > 100) {
                return res.status(400).json({
                    success: false,
                    error: '밝기 값은 0-100 사이여야 합니다.',
                });
            }

            const response = await lcsController.controlLampBlock(
                parseInt(masterAddr),
                parseInt(cuAddr),
                lampList,
                brightness
            );

            res.json({ success: true, data: response });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // 색온도 제어
    router.post('/lcs/lamps/:masterAddr/:cuAddr/color-temperature', async (req, res) => {
        try {
            const { masterAddr, cuAddr } = req.params;
            const { lampList, colorTemp } = req.body;

            if (!Array.isArray(lampList) || lampList.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '조명 번호 배열이 필요합니다.',
                });
            }

            if (colorTemp === undefined || colorTemp < 0 || colorTemp > 100) {
                return res.status(400).json({
                    success: false,
                    error: '색온도 값은 0-100 사이여야 합니다.',
                });
            }

            const response = await lcsController.controlColorTemperature(
                parseInt(masterAddr),
                parseInt(cuAddr),
                lampList,
                colorTemp
            );

            res.json({ success: true, data: response });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // 시나리오 실행
    router.post('/lcs/scenes/:masterAddr/:cuAddr/:sceneNo/execute', async (req, res) => {
        try {
            const { masterAddr, cuAddr, sceneNo } = req.params;
            const { fadeTime = 0 } = req.body;

            const response = await lcsController.executeScene(
                parseInt(masterAddr),
                parseInt(cuAddr),
                parseInt(sceneNo),
                fadeTime
            );

            res.json({ success: true, data: response });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // 전체 조명 제어
    router.post('/lcs/lamps/:masterAddr/:cuAddr/all', async (req, res) => {
        try {
            const { masterAddr, cuAddr } = req.params;
            const { brightness } = req.body;

            if (brightness === undefined || brightness < 0 || brightness > 100) {
                return res.status(400).json({
                    success: false,
                    error: '밝기 값은 0-100 사이여야 합니다.',
                });
            }

            const response = await lcsController.controlAllLamps(parseInt(masterAddr), parseInt(cuAddr), brightness);

            res.json({ success: true, data: response });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // 디바이스 정보 조회
    router.get('/lcs/device-info', async (req, res) => {
        try {
            const response = await lcsController.getDeviceInfo();
            res.json({ success: true, data: response });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // 페이드 제어
    router.post('/lcs/lamps/:masterAddr/:cuAddr/:lampNo/fade', async (req, res) => {
        try {
            const { masterAddr, cuAddr, lampNo } = req.params;
            const { startBrightness, endBrightness, duration = 5 } = req.body;

            if (
                startBrightness === undefined ||
                endBrightness === undefined ||
                startBrightness < 0 ||
                startBrightness > 100 ||
                endBrightness < 0 ||
                endBrightness > 100
            ) {
                return res.status(400).json({
                    success: false,
                    error: '시작/끝 밝기 값은 0-100 사이여야 합니다.',
                });
            }

            // 비동기 실행 (응답을 먼저 보내고 백그라운드에서 실행)
            res.json({
                success: true,
                message: '페이드 제어가 시작되었습니다.',
                data: {
                    masterAddr: parseInt(masterAddr),
                    cuAddr: parseInt(cuAddr),
                    lampNo: parseInt(lampNo),
                    startBrightness,
                    endBrightness,
                    duration,
                },
            });

            // 백그라운드에서 페이드 실행
            lcsController
                .fadeControl(
                    parseInt(masterAddr),
                    parseInt(cuAddr),
                    parseInt(lampNo),
                    startBrightness,
                    endBrightness,
                    duration
                )
                .catch((error) => {
                    console.error('페이드 제어 오류:', error);
                });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    // 웨이브 효과
    router.post('/lcs/lamps/:masterAddr/:cuAddr/wave', async (req, res) => {
        try {
            const { masterAddr, cuAddr } = req.params;
            const { lampList, brightness, interval = 500 } = req.body;

            if (!Array.isArray(lampList) || lampList.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '조명 번호 배열이 필요합니다.',
                });
            }

            if (brightness === undefined || brightness < 0 || brightness > 100) {
                return res.status(400).json({
                    success: false,
                    error: '밝기 값은 0-100 사이여야 합니다.',
                });
            }

            // 비동기 실행
            res.json({
                success: true,
                message: '웨이브 효과가 시작되었습니다.',
                data: {
                    masterAddr: parseInt(masterAddr),
                    cuAddr: parseInt(cuAddr),
                    lampList,
                    brightness,
                    interval,
                },
            });

            // 백그라운드에서 웨이브 효과 실행
            lcsController
                .waveEffect(parseInt(masterAddr), parseInt(cuAddr), lampList, brightness, interval)
                .catch((error) => {
                    console.error('웨이브 효과 오류:', error);
                });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    });

    return router;
}

module.exports = setupLCSApiRoutes;
