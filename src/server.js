const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/pos', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/pos.html'));
});

app.get('/phone', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/phone.html'));
});

app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

let storeState = {
    inventory: [
        { id: 1, name: "Castle Lager 375ml", sku: "CAS-375", category: "Bottle Store", cost: 1.20, price: 1.80, stock: 120, minStock: 24 },
        { id: 2, name: "Zambezi Lager Can", sku: "ZAM-CAN", category: "Bar", cost: 1.30, price: 2.00, stock: 15, minStock: 20 },
        { id: 3, name: "Red Label Whiskey 750ml", sku: "RED-750", category: "Spirits", cost: 12.00, price: 18.00, stock: 8, minStock: 5 },
        { id: 4, name: "Coke 500ml", sku: "COKE-500", category: "Soft Drinks", cost: 0.60, price: 1.00, stock: 65, minStock: 15 }
    ],
    recentSales: [],
    totalRevenue: 0.00
};

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'INIT_STATE', state: storeState }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'NEW_SALE') {
                let saleTotal = data.totalAmount || 0;
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach(cartItem => {
                        const product = storeState.inventory.find(p => p.id === cartItem.id);
                        if (product) {
                            product.stock = Math.max(0, product.stock - cartItem.quantity);
                        }
                    });
                }
                storeState.totalRevenue += saleTotal;
                storeState.recentSales.unshift({
                    receiptId: data.receiptId || 'TX-' + Math.floor(100000 + Math.random() * 900000),
                    cashier: data.cashier || 'Staff',
                    paymentMethod: data.paymentMethod || 'CASH',
                    total: saleTotal,
                    time: data.time || new Date().toLocaleTimeString()
                });
                if (storeState.recentSales.length > 50) storeState.recentSales.pop();
                broadcastState();
            }
        } catch (err) {
            console.error('[WS Error]', err);
        }
    });
});

function broadcastState() {
    const payload = JSON.stringify({ type: 'STATE_UPDATE', state: storeState });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
