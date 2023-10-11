import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

class PythonRunner {
  constructor(scriptPath = '/Services/ServicePython.py') {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    this.scriptPath = currentDir + "/" + scriptPath;
    this.process = null;
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

    // Listen for an exit event on the Node.js process.
    process.on('exit', () => this.terminatePythonProcess());

    // Listen for SIGINT (e.g., Ctrl+C in the terminal).
    process.on('SIGINT', () => this.terminatePythonProcess());
    
    // Listen for uncaught exceptions and terminate Python script.
    process.on('uncaughtException', () => this.terminatePythonProcess());
    
    // Optional: Listen for more signals as per your requirement, for example SIGTERM.
    process.on('SIGTERM', () => this.terminatePythonProcess());
        
  }

  stop() {
    if (this.process) {
      this.process.kill();
    }
  }

  terminatePythonProcess() {
    if (this.process) {
        this.process.kill();  // This sends the 'SIGTERM' signal to the process.
        console.log('Python process killed');
    }
}
}

export { PythonRunner };
