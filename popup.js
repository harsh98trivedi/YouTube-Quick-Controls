document.addEventListener("DOMContentLoaded", async () => {
  const qualityToggle = document.getElementById("quality-toggle");
  const speedToggle = document.getElementById("speed-toggle");
  const editBtn = document.getElementById("edit-shortcuts-btn");
  const instructions = document.getElementById("edit-instructions");
  const shortcutActions = document.getElementById("shortcut-actions");
  const resetBtn = document.getElementById("reset-shortcuts");
  const clearBtn = document.getElementById("clear-shortcuts");
  const status = document.getElementById("status");

  let editMode = false;
  let recordingShortcut = null;

  // Default shortcuts
  const defaultShortcuts = {
    quality: {
      auto: "Alt+0",
      tiny: "Alt+1",
      small: "Alt+2",
      medium: "Alt+3",
      large: "Alt+4",
      hd720: "Alt+5",
      hd1080: "Alt+6",
      hd1440: "Alt+7",
      hd2160: "Alt+8",
      hd4320: "Alt+9",
    },
    speed: {
      0.25: "Shift+`",
      0.5: "Shift+1",
      0.75: "Shift+2",
      1: "Shift+3",
      1.25: "Shift+4",
      1.5: "Shift+5",
      1.75: "Shift+6",
      2: "Shift+7",
      2.5: "Shift+8",
      3: "Shift+9",
      3.5: "Shift+0",
      4: "Shift+-",
    },
  };

  // Load saved settings
  try {
    const settings = await chrome.storage.sync.get({
      qualityEnabled: true,
      speedEnabled: true,
      shortcuts: defaultShortcuts,
    });

    qualityToggle.checked = settings.qualityEnabled;
    speedToggle.checked = settings.speedEnabled;

    // Update shortcut display
    updateShortcutDisplay(settings.shortcuts);

    console.log("[YT Controller Popup] Loaded settings:", settings);
  } catch (error) {
    console.error("[YT Controller Popup] Error loading settings:", error);
    // Default to enabled if error
    qualityToggle.checked = true;
    speedToggle.checked = true;
    updateShortcutDisplay(defaultShortcuts);
  }

  // Update shortcut display in UI
  function updateShortcutDisplay(shortcuts) {
    // Update quality shortcuts
    document.querySelectorAll('[data-type="quality"]').forEach((element) => {
      const value = element.dataset.value;
      if (shortcuts.quality[value]) {
        element.textContent = shortcuts.quality[value];
      }
    });

    // Update speed shortcuts
    document.querySelectorAll('[data-type="speed"]').forEach((element) => {
      const value = element.dataset.value;
      if (shortcuts.speed[value]) {
        element.textContent = shortcuts.speed[value];
      }
    });
  }

  // Save settings
  async function saveSettings() {
    const shortcuts = getCurrentShortcuts();
    const settings = {
      qualityEnabled: qualityToggle.checked,
      speedEnabled: speedToggle.checked,
      shortcuts: shortcuts,
    };

    try {
      showStatus("Saving...", "saving");

      await chrome.storage.sync.set(settings);
      console.log("[YT Controller Popup] Saved settings:", settings);

      // Notify content scripts of the change
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab && tab.url && tab.url.includes("youtube.com")) {
          await chrome.tabs.sendMessage(tab.id, {
            type: "SETTINGS_CHANGED",
            settings: settings,
          });
          console.log("[YT Controller Popup] Notified content script");
        }
      } catch (msgError) {
        console.log(
          "[YT Controller Popup] Could not notify content script:",
          msgError
        );
      }

      showStatus("Settings saved successfully!", "success");
    } catch (error) {
      console.error("[YT Controller Popup] Error saving settings:", error);
      showStatus("Error saving settings", "error");
    }
  }

  // Get current shortcuts from UI
  function getCurrentShortcuts() {
    const shortcuts = { quality: {}, speed: {} };

    document.querySelectorAll('[data-type="quality"]').forEach((element) => {
      shortcuts.quality[element.dataset.value] = element.textContent;
    });

    document.querySelectorAll('[data-type="speed"]').forEach((element) => {
      shortcuts.speed[element.dataset.value] = element.textContent;
    });

    return shortcuts;
  }

  // Format key combination for display using e.code for reliability
  function formatKeyCombo(e) {
    const parts = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Meta");

    let key;
    const code = e.code;

    if (code.startsWith("Digit")) {
      key = code.substring(5);
    } else if (code.startsWith("Numpad")) {
      key = code.substring(6);
    } else if (code.startsWith("Key")) {
      key = code.substring(3);
    } else if (code === "Backquote") {
      key = "`";
    } else if (code === "Minus") {
      key = "-";
    } else if (code === "Equal") {
      key = "=";
    } else if (code === "BracketLeft") {
      key = "[";
    } else if (code === "BracketRight") {
      key = "]";
    } else if (code === "Backslash") {
      key = "\\";
    } else if (code === "Semicolon") {
      key = ";";
    } else if (code === "Quote") {
      key = "'";
    } else if (code === "Comma") {
      key = ",";
    } else if (code === "Period") {
      key = ".";
    } else if (code === "Slash") {
      key = "/";
    } else if (code === "Space") {
      key = "Space";
    } else {
      key = e.key; // Fallback
      if (key.length === 1) key = key.toUpperCase();
    }

    parts.push(key);
    return parts.join("+");
  }

  // Validate shortcut
  function isValidShortcut(e) {
    // Must include modifier key (now includes Shift)
    if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) return false;

    // Exclude modifier-only keys
    if (["Control", "Alt", "Shift", "Meta", "Tab", "CapsLock"].includes(e.key))
      return false;

    return true;
  }

  // Check for duplicate shortcuts
  function isDuplicateShortcut(shortcut, currentType, currentValue) {
    const allShortcuts = getCurrentShortcuts();

    for (const [type, shortcuts] of Object.entries(allShortcuts)) {
      for (const [value, existingShortcut] of Object.entries(shortcuts)) {
        if (
          existingShortcut === shortcut &&
          !(type === currentType && value === currentValue)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  // Record new shortcut
  function recordShortcut(element) {
    recordingShortcut = element;
    element.classList.add("recording");
    element.textContent = "Press keys...";

    const keyHandler = (e) => {
      e.preventDefault();

      if (e.key === "Escape") {
        // Cancel recording
        cancelRecording();
        return;
      }

      if (!isValidShortcut(e)) {
        showStatus(
          "Shortcut must include a modifier (Alt, Ctrl, or Shift)",
          "error"
        );
        return;
      }

      const newShortcut = formatKeyCombo(e);
      const type = element.dataset.type;
      const value = element.dataset.value;

      if (isDuplicateShortcut(newShortcut, type, value)) {
        showStatus("Shortcut already in use", "error");
        return;
      }

      // Apply new shortcut
      element.textContent = newShortcut;
      element.classList.remove("recording");
      recordingShortcut = null;

      // Remove listener
      document.removeEventListener("keydown", keyHandler, true);

      // Auto-save
      saveSettings();
    };

    document.addEventListener("keydown", keyHandler, true);
  }

  // Cancel shortcut recording
  function cancelRecording() {
    if (recordingShortcut) {
      recordingShortcut.classList.remove("recording");
      // Restore previous text (get from storage or default)
      const type = recordingShortcut.dataset.type;
      const value = recordingShortcut.dataset.value;

      chrome.storage.sync.get(["shortcuts"]).then((result) => {
        const shortcuts = result.shortcuts || defaultShortcuts;
        recordingShortcut.textContent = shortcuts[type][value] || "Not Set";
      });

      recordingShortcut = null;
    }

    // Remove any active listeners
    document.removeEventListener("keydown", arguments.callee, true);
  }

  // Toggle edit mode
  function toggleEditMode() {
    editMode = !editMode;
    editBtn.textContent = editMode ? "Done" : "Customize";
    editBtn.classList.toggle("active", editMode);
    instructions.classList.toggle("show", editMode);
    shortcutActions.style.display = editMode ? "flex" : "none";

    // Toggle editable state
    document.querySelectorAll(".shortcut-key").forEach((key) => {
      key.classList.toggle("editable", editMode);
    });

    if (!editMode) {
      cancelRecording();
    }
  }

  // Reset shortcuts to default
  function resetShortcuts() {
    if (confirm("Reset all shortcuts to default values?")) {
      updateShortcutDisplay(defaultShortcuts);
      saveSettings();
      showStatus("Shortcuts reset to default", "success");
    }
  }

  // Clear all shortcuts
  function clearShortcuts() {
    if (confirm("Clear all shortcuts? This will disable keyboard shortcuts.")) {
      const emptyShortcuts = { quality: {}, speed: {} };

      document.querySelectorAll(".shortcut-key").forEach((key) => {
        key.textContent = "Not Set";
      });

      saveSettings();
      showStatus("All shortcuts cleared", "success");
    }
  }

  // Show status message
  function showStatus(message, type = "success") {
    status.textContent = message;
    status.className = `status ${type === "saving" ? "saving" : ""}`;
    status.style.display = "block";

    if (type !== "saving") {
      setTimeout(() => {
        status.style.display = "none";
      }, 3000);
    }
  }

  // Event listeners
  qualityToggle.addEventListener("change", saveSettings);
  speedToggle.addEventListener("change", saveSettings);
  editBtn.addEventListener("click", toggleEditMode);
  resetBtn.addEventListener("click", resetShortcuts);
  clearBtn.addEventListener("click", clearShortcuts);

  // Shortcut key click handlers
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("shortcut-key") && editMode) {
      recordShortcut(e.target);
    }
  });

  // Handle escape key globally
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && recordingShortcut) {
      cancelRecording();
    }
  });
});
