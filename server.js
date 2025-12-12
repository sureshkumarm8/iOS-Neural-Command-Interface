import express from 'express';
import { exec } from 'child_process';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Helper to execute shell commands
const executeScript = (command, res) => {
    console.log(`[SERVER] Executing: ${command}`);
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`[SERVER] Error: ${error.message}`);
            return res.status(500).json({ error: error.message, stderr, stdout });
        }
        res.json({ stdout, stderr });
    });
};

// Endpoint: Connect Device
app.post('/api/connect', (req, res) => {
    const { deviceName } = req.body;
    if (!deviceName) return res.status(400).json({ error: 'Device name required' });

    // Script: connect_ios_wireless.sh
    const scriptPath = path.join(__dirname, 'connect_ios_wireless.sh');
    // We use 'sh' to run the script. Ensure the script exists in root.
    const command = `sh "${scriptPath}" -d "${deviceName}"`;
    
    executeScript(command, res);
});

// Endpoint: Send Command
app.post('/api/command', (req, res) => {
    const { deviceName, args } = req.body;
    if (!deviceName) return res.status(400).json({ error: 'Device name required' });

    // Script: send_to_ios_wireless.sh
    const scriptPath = path.join(__dirname, 'send_to_ios_wireless.sh');
    const command = `sh "${scriptPath}" -d "${deviceName}" ${args || ''}`;

    executeScript(command, res);
});

app.listen(port, () => {
    console.log(`\n>>> Neural Interface Backend active on http://localhost:${port}`);
    console.log(`>>> Ready to execute: connect_ios_wireless.sh & send_to_ios_wireless.sh\n`);
});