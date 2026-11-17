import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

function openWindowsSaveDialog(suggestedName) {
  return new Promise((resolve, reject) => {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$owner = New-Object System.Windows.Forms.Form',
      '$owner.TopMost = $true',
      '$dialog = New-Object System.Windows.Forms.SaveFileDialog',
      "$dialog.Filter = 'PNG Image (*.png)|*.png'",
      "$dialog.DefaultExt = 'png'",
      '$dialog.AddExtension = $true',
      '$dialog.FileName = $env:PURE_ERASER_FILENAME',
      'if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {',
      '  Write-Output $dialog.FileName',
      '}',
      '$owner.Dispose()',
    ].join('; ');

    const child = spawn(
      'powershell.exe',
      ['-STA', '-NoProfile', '-NonInteractive', '-Command', script],
      {
        env: {
          ...process.env,
          PURE_ERASER_FILENAME: suggestedName,
        },
      }
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `PowerShell exited with code ${code}`));
        return;
      }
      resolve(stdout.trim() || null);
    });
  });
}

function nativeSaveAsPlugin() {
  return {
    name: 'pure-eraser-native-save-as',
    configureServer(server) {
      server.middlewares.use('/api/save-png', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        if (process.platform !== 'win32') {
          res.statusCode = 501;
          res.end('Not Implemented');
          return;
        }

        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const dataUrl = body?.dataUrl;
            const rawName = typeof body?.filename === 'string' ? body.filename : 'image-nobg.png';
            const safeName = path.basename(rawName).replace(/[<>:"/\\|?*]/g, '_') || 'image-nobg.png';

            if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
              res.statusCode = 400;
              res.end('Invalid PNG data URL');
              return;
            }

            const pngBuffer = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
            const selectedPath = await openWindowsSaveDialog(safeName);

            res.setHeader('Content-Type', 'application/json');
            if (!selectedPath) {
              res.end(JSON.stringify({ status: 'cancelled' }));
              return;
            }

            await fs.writeFile(selectedPath, pngBuffer);
            res.end(JSON.stringify({ status: 'saved' }));
          } catch (err) {
            res.statusCode = 500;
            res.end(err?.message || 'Failed to save file');
          }
        });
      });
    },
  };
}

export default defineConfig({
  // Serve from a sub-path when hosted inside another site, e.g. APP_BASE=/tools/background-remover/ (default: site root).
  base: process.env.APP_BASE || '/',
  plugins: [react(), tailwindcss(), nativeSaveAsPlugin()],
});
