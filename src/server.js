const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '../public')));

app.get('/pos', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/pos.html'));
});

app.get('/phone', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/phone.html'));
});

app.get('/healthz', (req, res) => {
    res.send('OK');
});

// Master App State including Empties, Sold, and Opening Stock
let appState = {
    totalRevenue: 0,
    inventory: [
        { id: 1, name: "Black Label Pints", sku: "BL-PINTS", category: "Bottle Store", cost: 1.50, price: 2.50, openingStock: 50, stock: 50, sold: 0, countedEmpties: 0, minStock: 10 },
        { id: 2, name: "Castle Lager 375ml", sku: "CAS-375", category: "Bottle Store", cost: 1.20, price: 1.80, openingStock: 120, stock: 120, sold: 0, countedEmpties: 0, minStock: 24 },
        { id: 3, name: "Zambezi Lager Can", sku: "ZAM-CAN", category: "Bar", cost: 1.30, price: 2.00, openingStock: 80, stock: 80, sold: 0, countedEmpties: 0, minStock: 15 }
    ],
    recentSales: []
};

wss.on('connection', (ws) => {
    console.log('[Server] New client connected via WebSocket');
    ws.send(JSON.stringify({ type: 'INIT_STATE', state: appState }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'NEW_SALE') {
                appState.totalRevenue += data.totalAmount;
                appState.recentSales.unshift(data);
                
                // Update stock and sold counts (driving expected empties)
                data.items.forEach(soldItem => {
                    const prod = appState.inventory.find(p => p.id === soldItem.id);
                    if (prod) {
                        prod.stock -= soldItem.quantity;
                        prod.sold = (prod.sold || 0) + soldItem.quantity;
                    }
                });

                broadcastState();
            } else if (data.type === 'UPDATE_EMPTIES' || data.type === 'SHIFT_HANDOVER') {
                // Sync inventory state modifications (like empties count or handovers)
                if (data.inventory) {
                    appState.inventory = data.inventory;
                }
                broadcastState();
            }
        } catch (e) {
            console.error('[Server Error]', e);
        }
    });
});

function broadcastState() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'STATE_UPDATE', state: appState }));
        }
    });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`RX/TX POS Server running on port ${PORT}`);
});
