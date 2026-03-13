# Privacy Policy for YouTube Quick Controls

This Privacy Policy explains how "YouTube Quick Controls" (the "Extension") handles your information. Your privacy is a top priority, and this policy is designed to be as simple and transparent as possible.

---

## The Short Version

This Extension does **not** collect, store, transmit, or sell any of your personal data. It does not track your browsing history, what videos you watch, or any other personal information. All functionality runs entirely within your browser.

---

## Information Handling

### 1. What Information the Extension Uses

The Extension does not require or collect any personal information. To function, it only reads and uses:

- **User Settings:** Your preferences (e.g. which controls are enabled, custom keyboard shortcuts, and Media Tools toggle state) are saved locally using `chrome.storage.sync`.
- **YouTube Page Content:** The Extension uses the `activeTab` permission to detect when you are on a YouTube watch page and injects control buttons above the video title. It does not read, record, or store page content.
- **Video Playback State:** The Extension reads the current playback time (for the Time Link feature) and volume level entirely within your browser. This data is never sent anywhere.
- **Clipboard (on demand):** The **Time Link**, **Copy URL**, and **Embed** buttons write a URL or code snippet to your clipboard **only when you explicitly click the button**. No clipboard content is read or monitored.

### 2. Where Information is Stored

Your settings are saved using the `chrome.storage.sync` API. Data is stored either:

- **Locally** on your computer, or
- **Synced** to your personal browser profile (e.g. your Google Account) — managed entirely by you and your browser vendor (Google, Brave, etc.)

**This data is never sent to or seen by the developer or any third party.**

### 3. Data Collection and Transmission

The Extension **does not** collect, log, or transmit any of the following:

- Your browsing history
- Your YouTube watch history or search queries
- Videos you watch or screenshots you take
- Any personal data (name, email, IP address, etc.)
- Analytics, crash reports, or telemetry of any kind

All code runs locally on your computer. There is no server, database, or remote service associated with this Extension.

---

## Permissions Explained

The `manifest.json` requires the following permissions:

| Permission       | Purpose |
|------------------|---------|
| `storage`        | Saves your settings (enabled features, keyboard shortcuts) persistently across browser sessions. |
| `activeTab`      | Allows the Extension to run on YouTube watch pages you are currently viewing, so it can inject the control buttons. The script only runs on `youtube.com` pages. |
| `clipboardWrite` | Allows the **Time Link**, **Copy URL**, and **Embed** buttons to write a URL or embed code to your clipboard. This only happens when you explicitly click one of these buttons — the Extension never reads your clipboard. |

---

## Media Tools Clarification

The Extension's Media Tools row includes several features that operate exclusively locally:

- **Volume control**: Reads and sets the YouTube player's volume in your browser only.
- **Frame screenshot**: Draws the current video frame to a canvas element and triggers a file download — no image data is transmitted anywhere.
- **Loop toggle**: Toggles the HTML `<video>` element's `loop` property.
- **CC toggle**: Simulates a click on YouTube's own subtitle button.
- **Audio Track selector**: Uses YouTube's internal player API to switch audio tracks locally.
- **Copy URL / Time Link / Embed**: Writes a plain-text string to your clipboard on explicit user action only.

---

## Changes to This Policy

If this policy is updated in the future, changes will be posted in the Extension's Chrome Web Store listing and on the official GitHub repository.

---

## Contact

If you have questions about this Privacy Policy, please refer to the contact information on the Extension's official GitHub page or Chrome Web Store listing.

- 🌐 **Website**: [harsh98trivedi.github.io](https://harsh98trivedi.github.io)
- 📧 **Email**: hi@harshtrivedi.in
- 🐙 **GitHub**: [@harsh98trivedi](https://github.com/harsh98trivedi)
