// /api/contacts.js
// Env vars: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO

const { Buffer } = require('buffer');

const GITHUB_API = 'https://api.github.com';

function b64encode(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}
function b64decode(b64) {
  return Buffer.from(b64, 'base64').toString('utf8');
}

function normalizePhoneNumber(number = '') {
  return String(number).replace(/\D/g, '');
}
function normalizeName(name = '') {
  return String(name).trim().replace(/\s+/g, ' ');
}

async function ghGetFile({ owner, repo, path, ref, token }) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;
  const r = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    }
  });
  if (r.status === 404) return { exists: false };
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`GitHub GET failed: ${r.status} ${t}`);
  }
  const json = await r.json();
  return { exists: true, sha: json.sha, content: b64decode(json.content) };
}

async function ghPutFile({ owner, repo, path, branch, token, content, sha, message }) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message,
    content: b64encode(content),
    branch,
    ...(sha ? { sha } : {})
  };
  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`GitHub PUT failed: ${r.status} ${t}`);
  }
  return r.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const {
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH = 'main',
    GITHUB_FILE_PATH = 'data/contacts.json'
  } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return res.status(500).json({
      error: 'Missing GitHub configuration. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO (and optionally GITHUB_BRANCH, GITHUB_FILE_PATH).'
    });
  }

  try {
    const file = await ghGetFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: GITHUB_FILE_PATH,
      ref: GITHUB_BRANCH,
      token: GITHUB_TOKEN
    });

    let db = { count: 0, contacts: [] };
    let sha = undefined;

    if (file.exists) {
      sha = file.sha;
      try {
        const parsed = JSON.parse(file.content);
        if (parsed && typeof parsed === 'object') db = parsed;
        if (!Array.isArray(db.contacts)) db.contacts = [];
        if (typeof db.count !== 'number') db.count = db.contacts.length;
      } catch {
        db = { count: 0, contacts: [] };
      }
    }

    if (req.method === 'GET') {
      return res.json({
        count: db.count,
        contacts: db.contacts.map(c => ({
          id: c.id,
          fullName: c.fullName,
          number: c.number,
          timestamp: c.timestamp
        }))
      });
    }

    if (req.method === 'POST') {
      const { fullName, number, countryCode } = req.body || {};

      const normalizedName = normalizeName(fullName || '');
      const normalizedCountryCode = normalizePhoneNumber(countryCode || '');
      const normalizedNumber = normalizePhoneNumber(number || '');
      const fullPhoneNumber = (normalizedCountryCode ? `+${normalizedCountryCode}` : '') + normalizedNumber;

      if (!normalizedName || !/^[a-zA-Z\s\-.,'"()]+$/.test(normalizedName)) {
        return res.status(400).json({
          error: 'Name can contain letters, spaces, and basic punctuation (-.,\'"()).',
          field: 'fullName'
        });
      }

      if (!normalizedNumber || normalizedNumber.length < 5) {
        return res.status(400).json({
          error: 'Phone number must be at least 5 digits',
          field: 'number'
        });
      }

      const isDup = (db.contacts || []).some(c =>
        String(c.fullName || '').toLowerCase() === normalizedName.toLowerCase() ||
        normalizePhoneNumber(c.number || '') === normalizePhoneNumber(fullPhoneNumber)
      );
      if (isDup) {
        return res.status(400).json({ error: 'Contact with same name or number already exists!' });
      }

      const newContact = {
        id: Date.now().toString(),
        fullName: normalizedName,
        number: fullPhoneNumber,
        timestamp: new Date().toISOString()
      };

      db.contacts.push(newContact);
      db.count = db.contacts.length;

      const newContent = JSON.stringify(db, null, 2);
      const message = `Add contact: ${normalizedName} (${newContact.number})`;

      await ghPutFile({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: GITHUB_FILE_PATH,
        branch: GITHUB_BRANCH,
        token: GITHUB_TOKEN,
        content: newContent,
        sha,
        message
      });

      return res.json({
        success: true,
        count: db.count,
        message: 'Contact saved successfully'
      });
    }

    return res.status(405).send('Method Not Allowed');
  } catch (error) {
    console.error('API error (/api/contacts):', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};
