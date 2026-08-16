# Offline Hackathon Report Submission & Proctoring System

A lightweight, 100% offline web platform designed to host report writing contests for **30–50+ concurrent participants** on local college WiFi or a single laptop hotspot — **with zero external internet dependencies and built-in anti-cheat proctoring controls.**

---

## 🚀 Quick Start

### 1. Installation
Ensure [Node.js](https://nodejs.org) (v18+) is installed on the host laptop:
```bash
npm install
npm run build
```

### 2. Launch the System

**Option A (One-Click Starter - Recommended):**
Double-click [`start_contest.bat`](file:///D:/Kevin11/Projects/ReportContest/start_contest.bat) or run:
```bash
npm run starter
```
*This opens the interactive Control Center where you can open/close firewall ports, rebuild client assets, run stress tests, and launch the server with one click.*

**Option B (Direct Command Line):**
```bash
npm start
```
The server will output your local network address and admin URL:
```text
======================================================
🚀 Offline Contest Server running on port 3000
======================================================
Access URLs on your Local Network:
 👉 http://192.168.1.105:3000 (Wi-Fi)
 👉 http://localhost:3000 (Localhost)

🔑 Admin Dashboard: http://localhost:3000/#/admin
======================================================
```

### 3. Stop & Lock Down After Contest
When the contest ends:
* When stopping the server with `Ctrl + C`, the script will automatically ask if you want to close the firewall port and lock down your laptop.
* Or open [`start_contest.ps1`](file:///D:/Kevin11/Projects/ReportContest/start_contest.ps1) and choose Option `[3] Close Firewall Port 3000`.

---

## 🛠️ Key Capabilities

| Feature | Description |
| :--- | :--- |
| **100% Air-Gapped / Offline** | All client assets, fonts, icons, rich text editor (TipTap), and scripts are bundled locally. Requires **zero internet connection**. |
| **High Concurrency & Low Footprint** | Powered by SQLite in Write-Ahead-Logging (WAL) mode. Handles 50+ concurrent autosaves and telemetry pings with < 70MB memory. |
| **Active Anti-Cheating Suite** | • **Clipboard Lockdown:** Blocks `Ctrl+V`, right-click paste, and context menu.<br>• **Copy-Protection:** Problem statement text cannot be selected or copied.<br>• **Fullscreen Enforcement:** Fullscreen mode required; exits are logged with timestamps.<br>• **Tab-Switch / Blur Detection:** Detects `visibilitychange` & window blurs with warning overlays.<br>• **Burst Typing Cadence Detector:** Flags sudden injections of text. |
| **Live Admin Control Center** | Live countdown clock controls (**Start**, **Pause**, **Extend +5m/+10m**, **End Contest**, **Reset**), problem statement editor, and host QR code display. |
| **Real-Time Proctoring Roster** | Live participant status (registered, writing, submitted, auto-submitted), live word counts, and violation badge counts. |
| **Offline Judging & Export Suite** | 📦 **Download All Submissions ZIP** (Includes `contest_summary.csv`, `security_audit_logs.csv`, formatted HTML reports, and Markdown files).<br>🎭 **Blind Judging Package** (Anonymized candidate codes `Candidate_001.html`, judging rubric spreadsheet, and organizer key). |

---

## 📋 Event Day Workflow

### 1. T - 30 Minutes: Host Setup
1. Connect host laptop to the college WiFi (or turn on **Mobile Hotspot** on the laptop).
2. Run `npm start`.
3. Open `http://localhost:3000/#/admin` (Password: `admin123`).
4. In the **Settings** tab, review the contest title, duration, and problem statement.
5. Click **QR Code** in the top navigation bar and project it on screen.

### 2. T - 10 Minutes: Participant Onboarding
1. Participants connect to the same WiFi/Hotspot.
2. They scan the QR code or enter `http://<Host-IP>:3000` in their browser.
3. They enter their **Roll Number** and **Name**.
4. They remain in the **Waiting Lobby** (problem statement is locked until start).

### 3. T = 0: Start Contest
1. Click **Start Contest** in the Admin header.
2. All participant screens instantly unlock the problem statement, enter fullscreen, and start the synchronized countdown timer.

### 4. During Contest: Live Monitoring
1. Monitor the **Participants** and **Live Security Log** tabs for tab-switch or fullscreen exit alerts.
2. Click **Review** on any student to inspect their live draft and integrity log.

### 5. Contest End & Judging
1. When time expires, all unsubmitted drafts **auto-submit** automatically.
2. Navigate to the **Offline Judging & Exports** tab:
   - Click **Download All ZIP** to archive all submissions.
   - Click **Blind Judging Package** to send anonymized files to the judges.

---

## 🧪 Testing & Development Commands

- **Development Mode** (Hot reloading on client & server):
  ```bash
  npm run dev
  ```
- **Rebuild Client Production Assets**:
  ```bash
  npm run build
  ```
- **Populate Sample Test Data (12 participants with mock reports)**:
  ```bash
  npm run seed
  ```
- **Run Concurrency Stress Test (50 Simulated Participants)**:
  ```bash
  npm run test:stress
  ```
