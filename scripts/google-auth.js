'use strict';

/**
 * One-time helper: signs in to Google and prints the values SendTo needs.
 *
 *   npm run google:auth
 *
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (an OAuth client of
 * type "Desktop app"). It opens a temporary local page for the consent
 * screen, then prints GOOGLE_REFRESH_TOKEN and GOOGLE_DRIVE_FOLDER_ID.
 *
 * By default it asks only for the `drive.file` scope: SendTo can see just the
 * files and the folder it creates itself, never the rest of your Drive.
 * Pass --full-drive if you want to use a folder you created by hand.
 */

require('dotenv').config({ quiet: true });

const http = require('http');
const { OAuth2Client } = require('google-auth-library');
const { drive } = require('@googleapis/drive');

const PORT = Number(process.env.GOOGLE_AUTH_PORT) || 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;
const FULL = process.argv.includes('--full-drive');
const SCOPE = FULL
  ? 'https://www.googleapis.com/auth/drive'
  : 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'SendTo Uploads';

const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
  process.exit(1);
}

const oauth = new OAuth2Client(clientId, clientSecret, REDIRECT);
const url = oauth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // forces Google to return a refresh token
  scope: [SCOPE]
});

function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const params = new URL(req.url, REDIRECT).searchParams;
      if (!req.url.startsWith('/oauth2callback')) {
        res.writeHead(404).end();
        return;
      }
      const error = params.get('error');
      const code = params.get('code');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error ? `Google returned: ${error}` : 'All set. You can close this tab and go back to the terminal.');
      server.close();
      if (error || !code) reject(new Error(error || 'No authorisation code received.'));
      else resolve(code);
    });
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => {
      console.log('\nOpen this URL in your browser and approve access:\n');
      console.log(url + '\n');
    });
  });
}

async function findOrCreateFolder(auth) {
  const api = drive({ version: 'v3', auth });
  const escaped = FOLDER_NAME.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const found = await api.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false`,
    fields: 'files(id)',
    pageSize: 1
  });
  if (found.data.files && found.data.files.length) return found.data.files[0].id;
  const created = await api.files.create({
    requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id'
  });
  return created.data.id;
}

(async () => {
  const code = await waitForCode();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Remove SendTo from ' +
        'https://myaccount.google.com/permissions and run this again.'
    );
  }
  oauth.setCredentials(tokens);
  const folderId = await findOrCreateFolder(oauth);

  console.log('Add these to your .env (locally) and to your Render environment:\n');
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`GOOGLE_DRIVE_FOLDER_ID=${folderId}\n`);
  console.log(`Folder "${FOLDER_NAME}" is private to your account. Do not share it.`);
})().catch((error) => {
  console.error('\nFailed:', error.message || error);
  process.exit(1);
});
