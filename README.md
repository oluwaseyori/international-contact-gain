# 📇 Seyori’s Contact Gain Site

A simple but powerful contact collection web app.  
Visitors must **join both a WhatsApp and a Telegram group** (with double-click verification) before they can save their contact.  
After deployment, a **timer** must expire before users can download the full contacts database as a `.vcf` file.

---

## 🚀 Features

- ✅ **Group-gated access**  
  Users must join both WhatsApp and Telegram groups, and click twice on each join button, before proceeding.

- ✅ **Contact saving**  
  Users can add their name and phone number (with selectable or custom country code). Contacts are stored automatically in a GitHub repo.

- ✅ **Lock timer**  
  Download is locked until the timer expires. Configurable for testing (`10s`, `30s`, `1m`, `5m`).

- ✅ **.VCF export**  
  All saved contacts can be downloaded as a `.vcf` file for easy import into phones.

- ✅ **Auto-lock after export ready**  
  Once download unlocks, the "Save Contact" form is disabled automatically.

- ✅ **Push notifications**  
  If allowed by the user’s browser, the site can notify them when the download is ready.

- ✅ **Responsive layout**  
  Clean and aligned design for both mobile and desktop.

---

## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, Vanilla JS  
- **Backend:** Vercel Serverless Functions (`/api/contacts.js` and `/api/export.js`)  
- **Storage:** GitHub repository JSON file (`data/contacts.json`)  
- **Export:** [`vcards-js`](https://www.npmjs.com/package/vcards-js)  

---

## ⚙️ Configuration

### 1. Environment Variables
Set these in your **Vercel project settings → Environment Variables**:

- `GITHUB_TOKEN` → Personal access token (with `repo` scope).
- `GITHUB_OWNER` → Your GitHub username or org.
- `GITHUB_REPO` → The repo name where contacts are stored.

### 2. Initial Data File
Create `data/contacts.json` in your repo with:
```json
{
  "count": 0,
  "contacts": []
}
