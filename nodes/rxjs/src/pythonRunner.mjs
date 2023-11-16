import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

class PythonRunner {

  static instance = null;

  constructor(scriptPath = '/Services/ServicePython.py') {
    if (PythonRunner.instance) {
      throw new Error('PythonRunner already initialized');
    }

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    this.scriptPath = currentDir + "/" + scriptPath;
    this.process = null;

    PythonRunner.instance = this;
  }

  static getInstance(scriptPath) {
    if (!PythonRunner.instance) {
      PythonRunner.instance = new PythonRunner(scriptPath);
    }
    return PythonRunner.instance;
  }

  start(moduleName, args = []) {
    // This is -u (unbuffered) so we can monitor the script output
    this.process = spawn('python3', ['-u', this.scriptPath, moduleName, ...args, ]);

    this.process.on('error', (error) => {
      console.error(`PythonRunner spawn Error: ${error}`);
    });
  
    this.process.on('close', (code) => {
      console.log(`PythonRunner child process exited with code ${code}`);
    }); 

    this.process.stderr.on('data', (data) => {
      console.error(`PythonRunner stderr: ${data.toString()}`);
    });

    this.process.stdout.on('data', (data) => {
      console.log(`PythonRunner stdout: ${data.toString()}`);
    });

    // Listen for SIGINT (e.g., Ctrl+C in the terminal).
    process.on('SIGINT', () => {
      this.terminatePythonProcess("SIGINT");
      process.exit(0); // Exit the process explicitly
    });
    
    // Optional: Listen for more signals as per your requirement, for exampe SIGTERM.
    process.on('SIGTERM', () => {
      this.terminatePythonProcess("SIGTERM");
      process.exit(0); // Exit the process explicitly
    });
        
  }

  stop() {
    if (this.process) {
      this.process.kill();
      console.log('Python process stopped');
    }
  }

  terminatePythonProcess(reason) {
    if (this.process && !this.process.killed) {
        this.process.kill();  // This sends the 'SIGTERM' signal to the process.
        console.log('Python process killed', reason);
    }
  }

}

export { PythonRunner };
