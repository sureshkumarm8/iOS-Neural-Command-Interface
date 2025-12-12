import express from 'express';
import { exec, spawn } from 'child_process';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Helper function to get device IP from config
function getDeviceHost(deviceName) {
    try {
        const configPath = path.join(__dirname, 'devices.conf');
        const configContent = readFileSync(configPath, 'utf8');
        const lines = configContent.split('\n');
        
        for (const line of lines) {
            if (line.startsWith(deviceName + ',')) {
                const parts = line.split(',');
                const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
                if (ipRegex.test(parts[1])) {
                    return parts[1];
                } else if (parts[2] && ipRegex.test(parts[2])) {
                    return parts[2];
                }
                break;
            }
        }
    } catch (e) {
        console.log(`[Server] Could not read config: ${e.message}`);
    }
    return null;
}

// Endpoint to handle device connection
app.post('/connect', (req, res) => {
    const { deviceName } = req.body;
    if (!deviceName) {
        return res.status(400).json({ error: 'Device name is required' });
    }

    let responseReturned = false;

    // First check if WDA is already running with very short timeout
    const deviceHost = getDeviceHost(deviceName);
    if (deviceHost) {
        const quickCheck = `curl -s -m 1 --connect-timeout 1 http://${deviceHost}:8100/status`;
        const checkProcess = exec(quickCheck, { timeout: 1500 }, (error, stdout, stderr) => {
            if (!responseReturned) {
                if (!error && stdout.includes('"state"')) {
                    console.log(`[Server] WDA already running for ${deviceName} - instant response`);
                    responseReturned = true;
                    return res.json({ 
                        success: true,
                        output: `WDA already running on ${deviceHost}:8100`,
                        message: 'Device already connected'
                    });
                } else {
                    console.log(`[Server] WDA check failed for ${deviceName}, starting full connection`);
                    startFullConnection();
                }
            }
        });

        // Much shorter timeout fallback for fast response
        setTimeout(() => {
            if (!responseReturned) {
                console.log(`[Server] Quick check timed out for ${deviceName}, proceeding with full connection`);
                checkProcess.kill();
                startFullConnection();
            }
        }, 1000);
    } else {
        console.log(`[Server] No device host found for ${deviceName}, starting full connection`);
        startFullConnection();
    }

    function startFullConnection() {
        if (responseReturned) return;

        const scriptPath = path.join(__dirname, 'connect_ios_wireless.sh');
        const command = `${scriptPath} -d ${deviceName} ""`;

        console.log(`[Server] Starting full connection: ${command}`);

        const child = spawn('bash', ['-c', command], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 30000
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log(`[Server] stdout: ${data}`);
            
            // Check for success immediately when WDA starts
            if (!responseReturned && stdout.includes('✅ WDA started wirelessly')) {
                responseReturned = true;
                res.json({ 
                    success: true,
                    output: stdout + stderr,
                    message: 'Device connected successfully'
                });
            }
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log(`[Server] stderr: ${data}`);
        });

        // Set a timeout to return success if WDA starts successfully
        const successTimeout = setTimeout(() => {
            if (!responseReturned && stdout.includes('WDA started wirelessly')) {
                responseReturned = true;
                res.json({ 
                    success: true,
                    output: stdout + stderr,
                    message: 'Device connected successfully'
                });
            }
        }, 25000);

        child.on('close', (code) => {
            console.log(`[Server] Process exited with code: ${code}`);
            clearTimeout(successTimeout);
            
            if (!responseReturned) {
                if (code === 0 || stdout.includes('WDA started wirelessly')) {
                    responseReturned = true;
                    res.json({ 
                        success: true,
                        output: stdout + stderr,
                        message: 'Device connected successfully'
                    });
                } else {
                    responseReturned = true;
                    res.status(500).json({ 
                        error: `Script failed with code ${code}`,
                        output: stdout + stderr 
                    });
                }
            }
        });

        child.on('error', (error) => {
            console.error(`[Server] Spawn error: ${error.message}`);
            clearTimeout(successTimeout);
            if (!responseReturned) {
                responseReturned = true;
                res.status(500).json({ 
                    error: error.message,
                    output: stdout + stderr 
                });
            }
        });

        // Send empty line to avoid interactive prompts
        child.stdin.write('\n');
        child.stdin.end();
    }
});

// Endpoint to handle command execution (optimized)
app.post('/command', (req, res) => {
    const { deviceName, command } = req.body;
    if (!deviceName || !command) {
        return res.status(400).json({ error: 'Device name and command are required' });
    }

    // Use the fast command script for better performance
    const scriptPath = path.join(__dirname, 'send_command_fast.sh');
    const fullCommand = `${scriptPath} ${deviceName} ${command}`;

    console.log(`[Server] Executing fast command: ${fullCommand}`);

    const child = spawn('bash', ['-c', fullCommand], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000
    });

    let stdout = '';
    let stderr = '';
    let responseReturned = false;

    child.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`[Server] Command stdout: ${data}`);
    });

    child.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log(`[Server] Command stderr: ${data}`);
    });

    // Shorter timeout for fast commands
    const commandTimeout = setTimeout(() => {
        if (!responseReturned) {
            responseReturned = true;
            res.json({ 
                success: true,
                output: stdout + stderr,
                message: 'Command executed'
            });
        }
    }, 1000);

    child.on('close', (code) => {
        console.log(`[Server] Command process exited with code: ${code}`);
        clearTimeout(commandTimeout);
        
        if (!responseReturned) {
            responseReturned = true;
            if (code === 0) {
                res.json({ 
                    success: true,
                    output: stdout + stderr,
                    message: 'Command executed successfully'
                });
            } else {
                res.status(500).json({ 
                    error: `Command failed with code ${code}`,
                    output: stdout + stderr 
                });
            }
        }
    });

    child.on('error', (error) => {
        console.error(`[Server] Command spawn error: ${error.message}`);
        clearTimeout(commandTimeout);
        if (!responseReturned) {
            responseReturned = true;
            res.status(500).json({ 
                error: error.message,
                output: stdout + stderr 
            });
        }
    });
});

// Ultra-fast status check endpoint
app.get('/status/:deviceName', (req, res) => {
    const { deviceName } = req.params;
    const deviceHost = getDeviceHost(deviceName);
    
    if (!deviceHost) {
        return res.json({ connected: false, error: 'Device not found in config' });
    }

    const quickCheck = `curl -s -m 0.5 --connect-timeout 0.5 http://${deviceHost}:8100/status`;
    exec(quickCheck, { timeout: 800 }, (error, stdout, stderr) => {
        if (!error && stdout.includes('"state"')) {
            res.json({ connected: true, host: deviceHost });
        } else {
            res.json({ connected: false, host: deviceHost });
        }
    });
});

app.listen(port, () => {
    console.log(`[Server] Optimized bridge server running on http://localhost:${port}`);
    console.log('[Server] Ready for fast iOS device commands...');
});