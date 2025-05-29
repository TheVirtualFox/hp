const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class WebSocketManager {
    wss = null;
    clients = null;
    onWebSocketRequest = null;
    onConnection = null;
    constructor(onConnection, onWebSocketRequest) {
        this.wss = new WebSocket.Server({ port: 8080 }, () => {
            console.log('🚀 WebSocket-сервер на ws://localhost:8080');
        });
        this.clients = new Map(); // Map clientId → WebSocket
        this.onConnection = onConnection;
        this.onWebSocketRequest = onWebSocketRequest;

        this.wss.on('connection', (ws) => {
            const clientId = uuidv4();
            this.clients.set(clientId, ws);
            console.log(`🟢 Клиент подключён: ${clientId}`);
            this.onConnection(ws);

            ws.on('message', (data) => {
                let message;

                try {
                    message = JSON.parse(data);
                } catch (err) {
                    return this.send(ws, {
                        action: 'error',
                        requestId: null,
                        payload: { message: 'Неверный JSON' },
                    });
                }

                const { action, requestId, payload } = message;

                if (!action || !requestId) {
                    return this.send(ws, {
                        type: 'error',
                        requestId: requestId ?? null,
                        payload,
                    });
                }

                this.handleMessage({ ws, clientId, message });
            });

            ws.on('close', () => {
                this.clients.delete(clientId);
                console.log(`🔴 Клиент отключён: ${clientId}`);
            });

            ws.on('error', (err) => {
                console.error(`❌ Ошибка клиента ${clientId}:`, err.message);
            });
        });
    }

    // Функция для отправки одному клиенту
    send(client, messageObj) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(messageObj));
        }
    }

    // Рассылка всем
    broadcast(messageObj) {
        for (const [, client] of this.clients) {
            this.send(client, messageObj);
        }
    }

    handleMessage(request) {
        const {ws, clientId, message} = request;
        const { action, requestId, payload } = message;
        this.onWebSocketRequest(request);
    }
}

module.exports = {WebSocketManager}