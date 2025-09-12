const vCardsJS = require('vcards-js');
const { Buffer } = require('buffer');

const GITHUB_API = 'https://api.github.com';

function b64decode(b64) {
  return Buffer.from(b64, 'base64').toString('utf8');
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

module.exports = async (req, res) => {
  try {
    const {
      GITHUB_TOKEN,
      GITHUB_OWNER,
      GITHUB_REPO,
      GITHUB_BRANCH = 'main',
      GITHUB_FILE_PATH = 'data/contacts.json'
    } = process.env;

    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      return res.status(500).json({
        success: false,
        error: 'Missing GitHub configuration. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO (and optionally GITHUB_BRANCH, GITHUB_FILE_PATH).'
      });
    }

    const file = await ghGetFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: GITHUB_FILE_PATH,
      ref: GITHUB_BRANCH,
      token: GITHUB_TOKEN
    });

    if (!file.exists) {
      return res.status(404).json({
        success: false,
        error: 'No contacts file found on GitHub.',
        suggestion: 'Initialize data/contacts.json with { "count": 0, "contacts": [] }.'
      });
    }

    let db = { count: 0, contacts: [] };
    try {
      db = JSON.parse(file.content);
    } catch {
    }

    if (!Array.isArray(db.contacts) || db.contacts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No contacts available to export',
        suggestion: 'Add contacts first before exporting'
      });
    }

    const vcfData = db.contacts.map((contact) => {
      try {
        const card = vCardsJS(); 
        const nameParts = String(contact.fullName || '').trim().split(/\s+/);
        card.firstName = nameParts[0] || '';
        card.lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        const cleanNumber = String(contact.number || '').replace(/\D/g, '');
        if (cleanNumber) {
          card.cellPhone = cleanNumber;
          card.workPhone = cleanNumber;
        }

        const ts = contact.timestamp ? new Date(contact.timestamp) : null;
        const noteDate = ts && !isNaN(ts) ? ts.toLocaleDateString() : '';
        card.note = `Added to Seyori's contact databse${noteDate ? ' on ' + noteDate : ''}`;

        return card.getFormattedString();
      } catch (e) {
        console.error(`Error processing contact ${contact && contact.id}:`, e);
        return null;
      }
    }).filter(Boolean).join('\n');

    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="seyori_contacts.vcf"');
    res.setHeader('X-Contact-Count', String(db.contacts.length));
    return res.send(vcfData);

  } catch (error) {
    console.error('Export failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate contact file',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
