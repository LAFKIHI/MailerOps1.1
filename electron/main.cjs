const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

const isDev = process.env.NODE_ENV !== 'production';

// Load .env
const envPath = path.join(__dirname, '../.env');
let env = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...value] = trimmed.split('=');
      if (key) {
        env[key] = value.join('=').replace(/^["']|["']$/g, '');
      }
    }
  });
}

const CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.VITE_GOOGLE_CLIENT_SECRET;

// PKCE state
let currentCodeVerifier = null;

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sha256(buffer) {
  return new Promise((resolve, reject) => {
    const crypto = require('crypto');
    try {
      const hash = crypto.createHash('sha256').update(buffer).digest();
      resolve(hash);
    } catch (e) {
      reject(e);
    }
  });
}

function generateCodeVerifier() {
  const random = require('crypto').randomBytes(64);
  return base64UrlEncode(random);
}

async function createCodeChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64UrlEncode(hashed);
}


let mainWindow;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow = win;

  const loadDevUrl = () => {
    const ports = [5173, 5174, 5175, 5176];
    let currentPortIndex = 0;

    const tryLoad = () => {
      if (currentPortIndex >= ports.length) {
        console.error('Failed to load dev server on any port');
        return;
      }
      const port = ports[currentPortIndex++];
      const url = `http://localhost:${port}`;
      win.loadURL(url);
    };

    win.webContents.on('did-fail-load', () => {
      setTimeout(tryLoad, 1000);
    });

    tryLoad();
  };

  if (isDev) {
    loadDevUrl();
  } else {
    win.loadURL(`file://${path.join(__dirname, '../dist/index.html')}`);
  }
}

app.whenReady().then(() => {
  // Keep the Electron shell clean without affecting the web build path.
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Handle OAuth code from auth window
ipcMain.on('oauth-code', (event, code) => {
  exchangeCodeForToken(code).then(data => {
    if (mainWindow) {
      mainWindow.webContents.send('oauth-token', data);
    }
  }).catch(err => {
    console.error('OAuth exchange failed:', err);
  });
});

// Start OAuth
ipcMain.handle('start-oauth', async () => {
  if (!CLIENT_ID) {
    console.error('CLIENT_ID not found in .env');
    return;
  }

  currentCodeVerifier = generateCodeVerifier();
  const codeChallenge = await createCodeChallenge(currentCodeVerifier);

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=http://localhost:3000/oauth/callback&scope=openid email https://www.googleapis.com/auth/postmaster.readonly&response_type=code&access_type=offline&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  const authWindow = new BrowserWindow({
    width: 600,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  authWindow.loadURL(authUrl);
  authWindow.show();
});

// Exchange code for token
async function exchangeCodeForToken(code) {
  if (!currentCodeVerifier) {
    throw new Error('PKCE code verifier missing');
  }

  const postData = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: 'http://localhost:3000/oauth/callback',
    code_verifier: currentCodeVerifier,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData.toString())
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData.toString());
    req.end();
  });
}
