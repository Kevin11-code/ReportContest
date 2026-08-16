
# Design Document: Offline Hackathon Report Submission System

## 1. Overview

**Purpose:** A locally-hosted web application that lets 30–50 participants receive a problem statement, write a report within a fixed time limit (1 hour), and submit it for review — without internet access and without the ability to copy content from outside sources.

**Key constraints driving the design:**

- No dependency on internet access (college WiFi is unreliable)
- Fair contest conditions — no copy-pasting from external sources
- All submissions centrally collected, timestamped, and stored for judging
- Must reliably support 30–50 concurrent users on modest hardware

---

## 2. High-Level Architecture

```
                     ┌─────────────────────────┐
                     │   Host Laptop (Server)   │
                     │  - Web server (backend)  │
                     │  - Local database        │
                     │  - Admin dashboard        │
                     └────────────┬─────────────┘
                                  │  Local Network (LAN)
        ┌────────────┬───────────┼───────────┬────────────┐
        │             │           │           │            │
   Participant 1  Participant 2  ...     Participant N  Admin device
   (browser)      (browser)               (browser)     (browser)
```

- **Single source of truth:** one server process (your laptop) hosts both the web app and the database.
- **Clients** are just browsers — no installation needed on participant laptops.
- **No internet required at any point** — the app is the only reachable address on the network.

---

## 3. Network Design

Three options were considered, in order of preference:

| Option                                   | Reliability | Setup Effort | Notes                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ----------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. College WiFi (same SSID)**    | Medium      | Low          | Primary plan. Handles far more devices than a laptop hotspot. Only works if "client isolation" is OFF — must test in advance with two devices. Internet on this network may be reachable, so browser-level lockdown (Section 4.2) is required regardless. |
| **B. Laptop's own Mobile Hotspot** | High        | Low          | Fallback if college WiFi has client isolation enabled or is too unstable. Windows: Settings → Mobile Hotspot. Mac: System Settings → Internet Sharing.                                                                                                   |
| **C. Wired Ethernet + switch**     | Highest     | Medium       | Backup if the venue has LAN ports; immune to WiFi congestion entirely.                                                                                                                                                                                     |

**Recommended approach:** Use **Option A (college WiFi)** as the primary plan — one host laptop running the server can serve all 40–50 participants at once, no need to split into groups. Because this network may have live internet access, the app itself must actively prevent participants from leaving the page or reaching outside sites (see Section 4.2) rather than relying on network isolation for security. Keep Option B ready as an immediate fallback if client isolation turns out to be enabled.

**Pre-event checklist:**

- [ ] Test that two devices on the college WiFi can reach each other (rules out client isolation)
- [ ] Confirm the host laptop's IP address is stable/reachable for the full duration
- [ ] Have Option B (hotspot) ready to switch to within minutes if needed
- [ ] Fully charge/power the host laptop; keep it plugged in during the event

---

## 4. Application Components

### 4.1 Participant Interface (Editor)

- **Rich text editor** with a formatting toolbar: **Bold**, *Italic*, <u>Underline</u>, plus commonly useful extras like bullet/numbered lists, headings, and undo/redo. Recommended library: **TipTap** or **Quill** (both are free, lightweight, and easy to lock down — formatting buttons can stay enabled while paste/copy are disabled independently, since these are separate event handlers)
- Displays: problem statement, countdown timer, word count
- **Autosave** every 5–10 seconds to the server (avoids losing work on crashes, avoids overloading the server if fired too frequently)
- Manual "Submit" button that locks the entry once clicked (no further edits after submission)
- Timer auto-submits the report when time runs out

### 4.2 Anti-Cheating Measures

Since Option A (college WiFi) may have live internet access, network isolation alone can't be relied on — the app needs to actively discourage leaving the page and log it clearly when it happens. Realistically, a determined participant with a second device (phone) can't be fully stopped by browser-level controls alone, so the goal here is **strong deterrence + clear logging**, not a hard technical guarantee:

- **Disable paste** (`onPaste` blocked) and **disable right-click context menu**
- **Disable copy** of the problem statement text (prevents pre-drafting elsewhere and pasting back)
- **Fullscreen lock**: editor opens in fullscreen (Fullscreen API); exiting fullscreen triggers a visible warning and is logged with a timestamp
- **Tab/window-switch (blur) detection**: `visibilitychange` and `window.blur` events fire an on-screen alert ("Tab switch detected — this has been logged") each time focus is lost, and every instance is timestamped and shown on your admin dashboard
- **Leave-page warning**: `beforeunload` handler shows a native browser confirmation ("Leaving will lose your progress / cannot be undone") if they try to close or navigate away before submitting. Note: browsers don't allow this to be a true unbreakable block — it's a strong friction/warning layer, not a lock
- **Typing pattern log**: track keystroke timestamps; a report that appears in a near-instant burst (paste-like) is flagged automatically even though direct pasting is disabled, since some browsers allow paste via keyboard shortcuts that slip past `onPaste`
- **Submission required to "finish"**: the timer page only shows a completion state after the Submit button is clicked; auto-submit fires when time runs out regardless

None of these are unbeatable on their own (a browser can technically be scripted around, and nothing stops a second device). Treat this layer as **raising the effort and risk of getting caught**, and combine it with light physical proctoring (a few volunteers walking the room) for real deterrence — that combination is what actually keeps a contest fair.

### 4.3 Admin Dashboard

- Live view of all participants: status (writing / submitted / flagged), time remaining
- List of submissions with timestamps and any flags (tab-switches, suspiciously fast typing)
- Ability to open/read/export each report
- Simple export button (CSV/JSON/plain text) for archiving and offline judging

### 4.4 Backend & Storage

- Lightweight web server: **Flask (Python)** or **Express (Node.js)** — either is fine for this scale
- **SQLite** as the database — file-based, zero setup, easily backed up by copying one file
- Submission schema:

| Field              | Description                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| `participant_id` | Unique ID or roll number                                                 |
| `name`           | Participant name                                                         |
| `content`        | Report text, stored as HTML (preserves bold/italic/underline/lists)      |
| `started_at`     | Timestamp when editor was opened                                         |
| `submitted_at`   | Timestamp of final submission                                            |
| `word_count`     | Auto-calculated                                                          |
| `flags`          | Tab-switches, fullscreen exits, paste attempts, suspicious typing bursts |
| `status`         | draft / submitted / auto-submitted (timer ran out)                       |

---

## 5. Suggested Tech Stack

| Layer    | Recommendation                                              |
| -------- | ----------------------------------------------------------- |
| Frontend | React (or plain HTML/JS if you want to keep it lightweight) |
| Editor   | TipTap or Quill (rich text: bold, italic, underline, lists) |
| Backend  | Flask or Express                                            |
| Database | SQLite                                                      |
| Hosting  | Runs locally on host laptop, no cloud needed                |
| Network  | Laptop hotspot / Ethernet (Section 3)                       |

This stack was chosen because everything can run entirely offline with no external dependencies, installs quickly, and is light enough that even a modest laptop handles it comfortably.

---

## 6. Hardware Requirements

- **8GB RAM is more than sufficient.** A Flask/Express server handling text-only submissions from 40–50 users typically uses under 200MB of memory even under load — this is a very light workload.
- The real bottleneck is network capacity, not compute — prioritize network testing over hardware upgrades.
- Recommended: a laptop with a stable power connection for the duration of the event (avoid battery-only operation).

---

## 7. Event Day Flow

| Time       | Action                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| T - 30 min | Start server on host laptop, connect it to college WiFi, note its local IP address, test connectivity with 2–3 devices        |
| T - 10 min | Participants join the same college WiFi and load the app via the host's IP, confirm they can see the "waiting" screen          |
| T = 0      | Problem statement revealed, timer starts, editor unlocked in fullscreen                                                        |
| During     | Monitor admin dashboard for flagged tab-switches, fullscreen exits, or connectivity issues; have 1–2 volunteers walk the room |
| T + 60 min | Timer expires, all unsubmitted reports auto-submitted                                                                          |
| After      | Export all submissions, back up the SQLite database file, begin judging                                                        |

---

## 8. Contingency Plans

- **If a host laptop's hotspot drops:** switch affected group to Ethernet or a secondary hotspot; server data is unaffected since it's local, participants just reconnect.
- **If a participant's laptop disconnects mid-write:** autosave ensures minimal work is lost; they simply reconnect and resume.
- **If college WiFi has client isolation enabled:** fall back immediately to Option B (host laptop hotspot) — this is why it's tested in advance.
- **If more than ~12 people need one host:** split into multiple groups/laptops rather than pushing a single hotspot past its comfortable limit.

---

## 9. Judging Workflow

1. After the event, export all submissions (CSV/JSON) from each host laptop.
2. Merge into a single spreadsheet or folder if multiple host laptops were used.
3. Anonymize entries if you want blind judging (strip names, use participant IDs only).
4. Review flagged entries first to rule out any integrity issues before shortlisting.
5. Select winners based on your judging criteria.
