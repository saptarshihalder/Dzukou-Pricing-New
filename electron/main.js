const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Keep references to prevent garbage collection
let mainWindow = null;
let pythonProcess = null;
let nextProcess = null;

// Ports for services
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;

// Check if a server is running on a given port
function checkServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: port === BACKEND_PORT ? '/routes/health' : '/',
        method: 'GET',
        timeout: 2000
      }, (res) => {
        resolve(true);
      });

      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server on port ${port} did not start within ${timeout}ms`));
        } else {
          setTimeout(check, 500);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server on port ${port} did not start within ${timeout}ms`));
        } else {
          setTimeout(check, 500);
        }
      });

      req.end();
    };

    check();
  });
}

// Start the Python backend server
function startBackend() {
  console.log('Starting Python backend...');

  const isPackaged = app.isPackaged;
  const apiPath = isPackaged
    ? path.join(process.resourcesPath, 'api')
    : path.join(__dirname, '..', 'api');

  // Try to find Python/uv executable
  let pythonCmd, pythonArgs;

  if (isPackaged) {
    // In packaged app, use bundled Python or system Python
    pythonCmd = 'python3';
    pythonArgs = ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)];
  } else {
    // In development, use uv
    pythonCmd = 'uv';
    pythonArgs = ['run', 'uvicorn', 'api.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)];
  }

  pythonProcess = spawn(pythonCmd, pythonArgs, {
    cwd: isPackaged ? apiPath : path.join(__dirname, '..'),
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Backend] ${data}`);
  });

  pythonProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });

  pythonProcess.on('exit', (code, signal) => {
    console.log(`Backend exited with code ${code} and signal ${signal}`);
    pythonProcess = null;
  });

  return pythonProcess;
}

// Start the Next.js frontend server
function startFrontend() {
  console.log('Starting Next.js frontend...');

  const isPackaged = app.isPackaged;

  if (isPackaged) {
    // In packaged app, use the built Next.js standalone server
    const nextPath = path.join(process.resourcesPath, 'next-standalone');
    nextProcess = spawn('node', ['server.js'], {
      cwd: nextPath,
      env: {
        ...process.env,
        PORT: String(FRONTEND_PORT),
        HOSTNAME: '127.0.0.1',
        NEXT_PUBLIC_API_URL: `http://localhost:${BACKEND_PORT}`
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else {
    // In development, use pnpm dev
    nextProcess = spawn('pnpm', ['start'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(FRONTEND_PORT),
        NEXT_PUBLIC_API_URL: `http://localhost:${BACKEND_PORT}`
      },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  nextProcess.stdout.on('data', (data) => {
    console.log(`[Frontend] ${data}`);
  });

  nextProcess.stderr.on('data', (data) => {
    console.error(`[Frontend] ${data}`);
  });

  nextProcess.on('error', (err) => {
    console.error('Failed to start frontend:', err);
  });

  nextProcess.on('exit', (code, signal) => {
    console.log(`Frontend exited with code ${code} and signal ${signal}`);
    nextProcess = null;
  });

  return nextProcess;
}

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'Price Optimizer AI',
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false // Don't show until ready
  });

  // Create application menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Price Optimizer AI',
          click: () => {
            shell.openExternal('https://github.com/your-org/price-optimizer-ai');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// Cleanup function to stop all processes
function cleanup() {
  console.log('Cleaning up...');

  if (pythonProcess) {
    console.log('Stopping backend...');
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }

  if (nextProcess) {
    console.log('Stopping frontend...');
    nextProcess.kill('SIGTERM');
    nextProcess = null;
  }
}

// Main application startup
app.whenReady().then(async () => {
  console.log('Price Optimizer AI starting...');

  // Create loading window
  const loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  loadingWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:system-ui;background:linear-gradient(135deg,#1a1a2e,#16213e);color:white;border-radius:12px;">
        <div style="text-align:center;">
          <h1 style="margin-bottom:20px;">Price Optimizer AI</h1>
          <p>Starting services...</p>
          <div style="width:200px;height:4px;background:#333;border-radius:2px;margin:20px auto;">
            <div style="width:0%;height:100%;background:#4ade80;border-radius:2px;animation:loading 2s infinite;"></div>
          </div>
        </div>
        <style>
          @keyframes loading {
            0% { width: 0%; }
            50% { width: 70%; }
            100% { width: 100%; }
          }
        </style>
      </body>
    </html>
  `);

  try {
    // Start services
    startBackend();
    startFrontend();

    // Wait for services to be ready
    console.log('Waiting for backend to be ready...');
    await checkServer(BACKEND_PORT, 60000);
    console.log('Backend is ready!');

    console.log('Waiting for frontend to be ready...');
    await checkServer(FRONTEND_PORT, 60000);
    console.log('Frontend is ready!');

    // Close loading window
    loadingWindow.close();

    // Create main window
    const window = createWindow();
    window.loadURL(`http://localhost:${FRONTEND_PORT}`);

  } catch (error) {
    console.error('Failed to start services:', error);
    loadingWindow.close();
    cleanup();
    app.quit();
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on app quit
app.on('quit', () => {
  cleanup();
});

// Handle macOS activation
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  cleanup();
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
