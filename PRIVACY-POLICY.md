# Privacy Policy for YouTube Quick Controls

This Privacy Policy explains how "YouTube Quick Controls" (the "Extension") handles your information. Your privacy is a top priority, and this policy is designed to be as simple and transparent as possible.

## The Short Version

This Extension does **not** collect, store, transmit, or sell any of your personal data. It does not track your browsing history, what videos you watch, or any other personal information. Its purpose is to function entirely within your browser to improve your YouTube experience.

## Information Handling

### 1. What Information the Extension Uses

The Extension does not require or collect any of your personal information. To function, it only uses two pieces of information:

* **User Settings:** The Extension saves your preferences, such as whether the quality/speed controls are enabled and any custom keyboard shortcuts you set.
* **YouTube Page Content:** The Extension uses the `activeTab` permission to detect when you are on a YouTube watch page. This allows it to inject the control buttons onto the page. It does not read or store the content of the page itself.

### 2. Where Information is Stored

Your settings are saved using the `chrome.storage.sync` API. This means your preferences are stored either locally on your computer or synced to your personal browser profile (e.g., your Google Account), which is managed by you and your browser vendor (Google, Brave, etc.).

**This data is never sent to or seen by the developer or any third party.**

### 3. Data Collection and Transmission

The Extension **does not** collect, log, or transmit any of the following:

* Your browsing history
* Your YouTube watch history or search queries
* Any personal data (name, email, IP address, etc.)
* Analytics or crash reports

All code runs locally on your computer. There is no server or database associated with this Extension for collecting user data.

## Permissions Explained

The `manifest.json` file requires the following permissions for the Extension to work:

* **`storage`**: This permission is required to save your settings (e.g., "Quality Controls: Enabled," "Speed Controls: Disabled," and your custom shortcuts).
* **`activeTab`**: This permission allows the Extension to run its `content.js` script on the YouTube page you are currently viewing, which is necessary to add the quality and speed control buttons. The script only runs when you are on `youtube.com` pages.

## Changes to This Policy

If this policy is updated in the future, the changes will be posted in the Extension's web store listing and on the official repository.

## Contact

If you have any questions about this Privacy Policy, please take a look at the contact information on the Extension's official GitHub page or Chrome Web Store listing.
