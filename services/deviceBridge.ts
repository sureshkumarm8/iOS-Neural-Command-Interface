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
  const fullCommand = `./send_to_ios_wireless.sh ${deviceFlag} ${scriptArgs}`;

  // Log command to UI
  log(`$ ${fullCommand}`, 'command');
  log(`Executing: ${command.action}...`, 'info');

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 600));
  log(`Command executed successfully.`, 'success');
};

export const connectToDevice = async (device: Device, log: Logger): Promise<void> => {
  const fullCommand = `./connect_ios_wireless -d ${device.name}`;
  
  log(`$ ${fullCommand}`, 'command');
  log(`[INIT] Targeting device: ${device.ip}`, 'info');
  
  // Simulate connection steps
  await new Promise(resolve => setTimeout(resolve, 800));
  log(`[HANDSHAKE] Verifying cryptographic keys...`, 'info');
  
  await new Promise(resolve => setTimeout(resolve, 800));
  log(`[NET] Tunnel established. Latency: 4ms`, 'info');
  
  await new Promise(resolve => setTimeout(resolve, 800));
  log(`[SUCCESS] Connected to ${device.name}. Ready for commands.`, 'success');
};