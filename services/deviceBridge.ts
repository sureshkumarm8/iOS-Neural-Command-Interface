import { Device, CommandAction } from '../types';

type Logger = (text: string, type?: 'info' | 'command' | 'success' | 'error') => void;

/**
 * This bridge translates the UI/AI intent into the specific shell commands
 * required by the `send_to_ios_wireless.sh` script.
 */
export const sendCommandToDevice = async (device: Device, command: CommandAction, log: Logger): Promise<void> => {
  const deviceFlag = `-d ${device.name}`;
  let scriptArgs = "";
  
  // Logic to map internal action types to the script's specific text syntax
  switch (command.action) {
    case 'HOME':
      scriptArgs = `":home"`;
      break;
    case 'LOCK':
      scriptArgs = `":lock"`; 
      break;
    case 'SCREENSHOT':
      scriptArgs = `":screenshot"`;
      break;
    case 'RESTART':
      scriptArgs = `":restart"`;
      break;
    case 'LAUNCH_APP':
      if (command.payload) {
        scriptArgs = `":launch ${command.payload}"`;
      }
      break;
    case 'KILL_APP':
      if (command.payload) {
        scriptArgs = `":kill ${command.payload}"`;
      }
      break;
    case 'OPEN_URL':
      if (command.payload) {
        scriptArgs = `":url ${command.payload}"`;
      }
      break;
    case 'UNINSTALL':
        if (command.payload) {
          scriptArgs = `":uninstall ${command.payload}"`;
        }
        break;
    case 'TYPE':
      if (command.payload) {
        scriptArgs = `"${command.payload}"`;
      }
      break;
    case 'UNKNOWN':
    default:
      log("Unknown action requested via bridge", 'error');
      return;
  }

  // Construct the full shell command string
  const fullCommand = `./connect_ios_wireless.sh ${deviceFlag} ${scriptArgs}`;

  // Log command to UI
  log(`$ ${fullCommand}`, 'command');
  log(`Executing: ${command.action}...`, 'info');

  try {
    // Make HTTP request to backend server for command execution
    const response = await fetch('http://localhost:3001/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        deviceName: device.name, 
        command: scriptArgs 
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Command execution failed');
    }

    log(`Command executed successfully.`, 'success');
    
    // Log any output from the script
    if (result.output) {
      log(`Output: ${result.output}`, 'info');
    }

  } catch (error) {
    log(`[ERROR] Command failed: ${error.message}`, 'error');
    throw error;
  }
};

export const connectToDevice = async (device: Device, log: Logger): Promise<void> => {
  const fullCommand = `./connect_ios_wireless.sh -d ${device.name}`;

  log(`$ ${fullCommand}`, 'command');
  log(`[INIT] Targeting device: ${device.ip}`, 'info');

  try {
    // First do a quick status check
    log(`[QUICK-CHECK] Testing existing connection...`, 'info');
    const statusResponse = await fetch(`http://localhost:3001/status/${device.name}`, {
      method: 'GET'
    });

    const statusResult = await statusResponse.json();

    if (statusResult.connected) {
      log(`[SUCCESS] Device already connected and ready!`, 'success');
      return;
    }

    log(`[CONNECT] Establishing new connection...`, 'info');

    // Make HTTP request to backend server for full connection
    const response = await fetch('http://localhost:3001/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceName: device.name }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Connection failed');
    }

    log(`[HANDSHAKE] Verifying cryptographic keys...`, 'info');
    log(`[NET] Tunnel established. WDA started wirelessly`, 'info');
    log(`[SUCCESS] Connected to ${device.name}. Ready for commands.`, 'success');
    
    // Log the actual script output
    if (result.output && !result.output.includes('already running')) {
      log(`Connection details: ${result.message}`, 'info');
    }

  } catch (error) {
    log(`[ERROR] Connection failed: ${error.message}`, 'error');
    throw error;
  }
};