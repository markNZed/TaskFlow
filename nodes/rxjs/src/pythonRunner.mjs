import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

class PythonRunner {
  constructor(scriptPath) {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    this.scriptPath = currentDir + "/" + scriptPath;
    this.process = null;
  }

  start(args = []) {
    // This is -u (unbuffered) so we can monitor the script output
    this.process = spawn('python3', ['-u', ...args, this.scriptPath]);

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
  }

  stop() {
    if (this.process) {
      this.process.kill();
    }
  }
}

export { PythonRunner };
