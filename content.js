(function () {
  "use strict";

  let container = null;
  let lastUrl = "";
  let player = null;
  let detectionTimer = null;
  let qualityDetectionAttempts = 0;
  const MAX_DETECTION_ATTEMPTS = 50;
  let availableQualities = []; // Track available qualities
  let customShortcuts = {}; // Store custom shortcuts

  // Settings
  let settings = {
    qualityEnabled: true,
    speedEnabled: true,
    toolsEnabled: true,
    shortcuts: {
      quality: {
        auto: "Alt+0",
        tiny: "Alt+1",
        small: "Alt+2",
        medium: "Alt+3",
        large: "Alt+4",
        hd720: "Alt+5",
        hd1080: "Alt+6",
        hd1080premium: "Not Set",
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
    },
  };

  console.log("[YT Controller] Extension starting - early load");

  const qualityLabels = {
    auto: "Auto",
    tiny: "144p",
    small: "240p",
    medium: "360p",
    large: "480p",
    hd720: "720p",
    hd1080: "1080p",
    hd1080premium: "1080p Premium",
    hd1440: "1440p",
    hd2160: "2160p",
    hd2880: "2880p",
    hd4320: "4320p",
    highres: "8K+",
  };

  const speedValues = [
    "0.25",
    "0.5",
    "0.75",
    "1",
    "1.25",
    "1.5",
    "1.75",
    "2",
    "2.5",
    "3",
    "3.5",
    "4",
  ];

  // Parse shortcut string to check against event
  function parseShortcut(shortcutStr) {
    if (!shortcutStr || shortcutStr === "Not Set") return null;

    const parts = shortcutStr.split("+");
    const modifiers = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    };
    let key = "";

    parts.forEach((part) => {
      const p = part.toLowerCase();
      if (p === "ctrl") modifiers.ctrl = true;
      else if (p === "alt") modifiers.alt = true;
      else if (p === "shift") modifiers.shift = true;
      else if (p === "meta") modifiers.meta = true;
      else key = p;
    });

    return { modifiers, key };
  }

  // Check if event matches shortcut using e.code for reliability
  function matchesShortcut(e, shortcutStr) {
    const parsed = parseShortcut(shortcutStr);
    if (!parsed) return false;

    const { modifiers, key } = parsed; // key = "1" or "Q"

    // Get the simple key from e.code
    let eventKey = "";
    const code = e.code;

    if (code.startsWith("Digit")) {
      eventKey = code.substring(5);
    } else if (code.startsWith("Numpad")) {
      eventKey = code.substring(6);
    } else if (code.startsWith("Key")) {
      eventKey = code.substring(3);
    } else if (code === "Backquote") {
      eventKey = "`";
    } else if (code === "Minus") {
      eventKey = "-";
    } else if (code === "Equal") {
      eventKey = "=";
    } else if (code === "BracketLeft") {
      eventKey = "[";
    } else if (code === "BracketRight") {
      eventKey = "]";
    } else if (code === "Backslash") {
      eventKey = "\\";
    } else if (code === "Semicolon") {
      eventKey = ";";
    } else if (code === "Quote") {
      eventKey = "'";
    } else if (code === "Comma") {
      eventKey = ",";
    } else if (code === "Period") {
      eventKey = ".";
    } else if (code === "Slash") {
      eventKey = "/";
    } else if (code === "Space") {
      eventKey = "Space";
    } else {
      eventKey = e.key; // Fallback
    }

    // Compare case-insensitively
    const keyMatch = eventKey.toLowerCase() === key.toLowerCase();

    return (
      e.ctrlKey === modifiers.ctrl &&
      e.altKey === modifiers.alt &&
      e.shiftKey === modifiers.shift &&
      e.metaKey === modifiers.meta &&
      keyMatch
    );
  }

  // Load settings from storage
  async function loadSettings() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.sync.get({
          qualityEnabled: true,
          speedEnabled: true,
          toolsEnabled: true,
          shortcuts: settings.shortcuts,
        });
        settings = result;
        customShortcuts = settings.shortcuts;
        console.log("[YT Controller] Loaded settings:", settings);
      }
    } catch (error) {
      console.log(
        "[YT Controller] Could not load settings, using defaults:",
        error
      );
    }
  }

  // Listen for settings changes from popup
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "SETTINGS_CHANGED") {
        console.log("[YT Controller] Settings changed:", message.settings);
        settings = message.settings;
        customShortcuts = settings.shortcuts;

        // Recreate controls with new settings
        if (location.pathname.startsWith("/watch")) {
          createControls();
        }

        sendResponse({ success: true });
      }
    });
  }

  // Check if quality is available for current video
  function isQualityAvailable(quality) {
    return availableQualities.includes(quality);
  }

  // Keyboard shortcut handler
  function handleKeyboardShortcuts(e) {
    // Only work on YouTube watch pages
    if (!location.pathname.startsWith("/watch")) return;

    // Don't interfere with typing in input fields
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.isContentEditable
    ) {
      return;
    }

    // Check quality shortcuts
    if (settings.qualityEnabled && customShortcuts.quality) {
      for (const [quality, shortcutStr] of Object.entries(
        customShortcuts.quality
      )) {
        if (matchesShortcut(e, shortcutStr) && isQualityAvailable(quality)) {
          e.preventDefault();
          console.log(
            `[YT Controller] Quality shortcut: ${shortcutStr} -> ${quality}`
          );
          setQuality(quality);
          return;
        }
      }
    }

    // Check speed shortcuts
    if (settings.speedEnabled && customShortcuts.speed) {
      for (const [speed, shortcutStr] of Object.entries(
        customShortcuts.speed
      )) {
        if (matchesShortcut(e, shortcutStr)) {
          e.preventDefault();
          console.log(
            `[YT Controller] Speed shortcut: ${shortcutStr} -> ${speed}x`
          );
          setSpeed(speed);
          return;
        }
      }
    }
  }

  // Setup keyboard listeners
  function setupKeyboardShortcuts() {
    // Remove existing listener
    document.removeEventListener("keydown", handleKeyboardShortcuts);

    // Add new listener
    document.addEventListener("keydown", handleKeyboardShortcuts, true);
    console.log("[YT Controller] Custom keyboard shortcuts enabled");
  }

  function getPlayer() {
    if (!player) {
      player = document.getElementById("movie_player");
    }
    return player;
  }

  function setQuality(quality) {
    console.log("[YT Controller] Setting quality to:", quality);
    const p = getPlayer();

    if (!p) {
      console.log("[YT Controller] No player found");
      return;
    }

    let useDomClick = true;

    try {
      // Method 1: Try direct API call
      // YouTube API ignores premium strings. It also sometimes ignores standard strings unless Range is set.
      if (quality !== "hd1080premium") {
        if (typeof p.setPlaybackQualityRange === "function") {
          p.setPlaybackQualityRange(quality, quality);
        }
        if (typeof p.setPlaybackQuality === "function") {
          p.setPlaybackQuality(quality);
          console.log("[YT Controller] Quality set via player API:", quality);
          // Don't use DOM click if we have the API, to avoid menu flashing. But Premium MUST use DOM click.
          useDomClick = false; 
          
          setTimeout(() => updateActiveStates(), 100);
          setTimeout(() => updateActiveStates(), 300);
          setTimeout(() => updateActiveStates(), 500);
        }
      }
    } catch (e) {
      console.log("[YT Controller] Player API failed or rejected:", e);
    }

    if (useDomClick) {
      // Method 2: Simulate clicking YouTube's quality menu
      try {
        simulateQualityClick(quality);
      } catch (e) {
        console.error("[YT Controller] Quality simulation failed:", e);
      }
    } else {
      // Even if API "succeeded", sometimes YouTube ignores it. If it hasn't changed quickly, force DOM click.
      setTimeout(() => {
        let currentLabel = "";
        const settingsBtn = document.querySelector(".ytp-settings-button");
        if (settingsBtn) {
          const qtyDisplays = document.querySelectorAll(".ytp-menuitem");
          for (const display of qtyDisplays) {
            if (display.textContent.toLowerCase().includes("quality")) {
               currentLabel = display.textContent.toLowerCase();
            }
          }
        }
        // If the API failed to update the quality string, force DOM click.
        if (currentLabel && !currentLabel.includes("auto") && !currentLabel.includes(quality.replace("hd", ""))) {
           console.log("[YT Controller] API failed to stick, falling back to DOM click.");
           simulateQualityClick(quality);
        }
      }, 500);
    }
  }

  function simulateQualityClick(targetQuality) {
    console.log("[YT Controller] Simulating quality click for:", targetQuality);

    // Find and click the settings button
    const settingsBtn = document.querySelector(".ytp-settings-button");
    if (!settingsBtn) {
      console.log("[YT Controller] Settings button not found");
      return;
    }

    // Ensure menu is closed first to get a clean state (main panel)
    const settingsMenu = document.querySelector(".ytp-settings-menu");
    if (settingsMenu && settingsMenu.style.display !== "none") {
      settingsBtn.click();
    }

    setTimeout(() => {
      // Now toggle open
      settingsBtn.click();

      setTimeout(() => {
      // Look for quality menu item
      const menuItems = document.querySelectorAll(".ytp-menuitem");
      let qualityMenuItem = null;

      for (const item of menuItems) {
        if (item.textContent.toLowerCase().includes("quality")) {
          qualityMenuItem = item;
          break;
        }
      }

      if (qualityMenuItem) {
        qualityMenuItem.click();

        setTimeout(() => {
          // Find the specific quality option to click
          const qualityOptions = document.querySelectorAll(".ytp-menuitem");

          for (const option of qualityOptions) {
            const text = option.textContent.toLowerCase();
            let shouldClick = false;

            if (
              targetQuality === "auto" &&
              (text.includes("auto") || text.match(/auto\s*\(/i))
            ) {
              shouldClick = true;
            } else if (targetQuality === "tiny" && text.includes("144")) {
              shouldClick = true;
            } else if (targetQuality === "small" && text.includes("240")) {
              shouldClick = true;
            } else if (targetQuality === "medium" && text.includes("360")) {
              shouldClick = true;
            } else if (targetQuality === "large" && text.includes("480")) {
              shouldClick = true;
            } else if (targetQuality === "hd720" && text.includes("720")) {
              shouldClick = true;
            } else if (
              targetQuality === "hd1080" &&
              text.includes("1080") &&
              !text.includes("premium") &&
              !text.includes("enhanced")
            ) {
              shouldClick = true;
            } else if (
              targetQuality === "hd1080premium" &&
              text.includes("1080") &&
              (text.includes("premium") || text.includes("enhanced"))
            ) {
              shouldClick = true;
            } else if (targetQuality === "hd1440" && text.includes("1440")) {
              shouldClick = true;
            } else if (
              targetQuality === "hd2160" &&
              (text.includes("2160") || text.includes("4k"))
            ) {
              shouldClick = true;
            } else if (
              targetQuality === "hd2880" &&
              (text.includes("2880") || text.includes("5k"))
            ) {
              shouldClick = true;
            } else if (
              targetQuality === "hd4320" &&
              (text.includes("4320") || text.includes("8k"))
            ) {
              shouldClick = true;
            } else if (
              targetQuality === "highres" &&
              (text.includes("8k") ||
                text.includes("4320") ||
                text.includes("highres"))
            ) {
              shouldClick = true;
            }

            if (shouldClick) {
              option.click();
              console.log(
                "[YT Controller] Quality changed via menu click to:",
                targetQuality
              );

              // Update active states multiple times to ensure it sticks
              setTimeout(() => updateActiveStates(), 200);
              setTimeout(() => updateActiveStates(), 500);
              setTimeout(() => updateActiveStates(), 1000);
              return;
            }
          }

          console.log(
            "[YT Controller] Target quality option not found:",
            targetQuality
          );

          // Close the menu if quality not found
          const settingsBtn2 = document.querySelector(".ytp-settings-button");
          if (settingsBtn2) settingsBtn2.click();
        }, 200);
      } else {
        console.log("[YT Controller] Quality menu item not found");
        // Close settings menu
        settingsBtn.click();
      }
    }, 200);
    }, 50);
  }

  function setSpeed(speed) {
    console.log("[YT Controller] Setting speed to:", speed);
    const p = getPlayer();
    const video = document.querySelector("video");

    try {
      const speedValue = parseFloat(speed);

      if (p && typeof p.setPlaybackRate === "function") {
        p.setPlaybackRate(speedValue);
        console.log("[YT Controller] Speed set via player API to:", speedValue);
      } else if (video) {
        video.playbackRate = speedValue;
        console.log(
          "[YT Controller] Speed set via video element to:",
          speedValue
        );
      }

      // FIXED: More aggressive active state updates for shortcuts
      setTimeout(() => updateActiveStates(), 100);
      setTimeout(() => updateActiveStates(), 300);
      setTimeout(() => updateActiveStates(), 500);
    } catch (e) {
      console.error("[YT Controller] Speed change error:", e);
    }
  }

  function getCurrentQuality() {
    const p = getPlayer();
    if (!p) return "auto";

    try {
      let quality = null;
      let isPremium = false;

      // Method 1: Check YouTube's quality selector text first
      const settingsBtn = document.querySelector(".ytp-settings-button");
      if (settingsBtn) {
        const qualityDisplays = document.querySelectorAll(".ytp-menuitem");
        for (const display of qualityDisplays) {
          const text = display.textContent.toLowerCase();
          
          // Check main settings menu summary item
          if (text.includes("quality")) {
            if (text.includes("auto")) {
              console.log("[YT Controller] Detected Auto quality from menu text");
              return "auto";
            }
            if (text.includes("premium") || text.includes("enhanced")) {
              isPremium = true;
            }
          }
          
          // Check quality submenu explicitly checked item (YouTube uses aria-checked)
          if (display.getAttribute("aria-checked") === "true") {
             if (text.includes("premium") || text.includes("enhanced")) {
                isPremium = true;
             }
             if (text.includes("auto")) {
                return "auto";
             }
          }
        }
      }

      // Method 2: Direct API (try next, but don't always trust it for Auto)
      if (typeof p.getPlaybackQuality === "function") {
        quality = p.getPlaybackQuality();
        console.log("[YT Controller] API quality:", quality);

        // If API returns a specific quality (not auto/unknown), trust it
        if (
          quality &&
          quality !== "unknown" &&
          quality !== "" &&
          quality !== "auto"
        ) {
          if (quality === "hd1080" && isPremium) {
            return "hd1080premium";
          }
          return quality;
        }
      }

      // Method 3: Check video element dimensions (for non-Auto qualities)
      const video = document.querySelector("video");
      if (video && video.videoHeight && video.videoWidth) {
        const videoHeight = video.videoHeight;
        console.log("[YT Controller] Video height:", videoHeight);

        // If we have a valid quality from API and video dimensions match, use API
        if (quality && quality !== "unknown" && quality !== "") {
          if (quality === "hd1080" && isPremium) {
            return "hd1080premium";
          }
          return quality;
        }

        // Map video height to quality levels
        if (videoHeight <= 144) return "tiny";
        if (videoHeight <= 240) return "small";
        if (videoHeight <= 360) return "medium";
        if (videoHeight <= 480) return "large";
        if (videoHeight <= 720) return "hd720";
        if (videoHeight <= 1080) return isPremium ? "hd1080premium" : "hd1080";
        if (videoHeight <= 1440) return "hd1440";
        if (videoHeight <= 2160) return "hd2160";
        if (videoHeight <= 2880) return "hd2880";
        if (videoHeight <= 4320) return "hd4320";
        return "highres";
      }

      // Method 4: Default to auto if nothing else works
      console.log("[YT Controller] Defaulting to auto quality");
      return "auto";
    } catch (e) {
      console.log("[YT Controller] Error getting current quality:", e);
      return "auto";
    }
  }

  function getCurrentSpeed() {
    const p = getPlayer();
    const video = document.querySelector("video");

    try {
      if (p && typeof p.getPlaybackRate === "function") {
        return p.getPlaybackRate();
      } else if (video) {
        return video.playbackRate;
      }
    } catch (e) {
      return 1;
    }
    return 1;
  }

  function getCurrentVolume() {
    const p = getPlayer();
    if (p && typeof p.getVolume === "function") {
      return p.isMuted() ? 0 : p.getVolume();
    }
    const v = document.querySelector("video");
    return v ? Math.round(v.muted ? 0 : v.volume * 100) : 100;
  }

  function setVolume(val) {
    const p = getPlayer();
    if (p && typeof p.setVolume === "function") {
      p.setVolume(val);
      if (val > 0 && typeof p.unMute === "function") p.unMute();
      if (val === 0 && typeof p.mute === "function") p.mute();
    } else {
      const v = document.querySelector("video");
      if (v) {
        v.volume = val / 100;
        v.muted = val === 0;
      }
    }
    if (val > 0) _lastVol = val; // track last non-zero for restore-on-unmute
    updateVolumeUI(val);
  }

  function updateVolumeUI(val) {
    if (!container) return;
    const volPill = container.querySelector(".ytc-vol-pill");
    const volSlider = container.querySelector(".ytc-vol-slider");
    if (!volPill || !volSlider) return;

    if (val === undefined) val = getCurrentVolume();

    const icon = val === 0 ? ICONS.mute : ICONS.volume;
    const label = val === 0 ? "Muted" : `${val}%`;
    volPill.innerHTML = svgIcon(icon) + ` ${label}`;
    volPill.classList.toggle("ytc-vol-muted", val === 0);

    // ALWAYS update the visual progress fill even while dragging
    volSlider.style.setProperty("--val", val);
    
    // Only update the actual slider pointer if the user isn't actively dragging it
    if (document.activeElement !== volSlider) {
      volSlider.value = val;
    }
  }

  // FIXED: Enhanced updateActiveStates with forced refresh
  function updateActiveStates() {
    if (!container) return;

    const currentQuality = getCurrentQuality();
    const currentSpeed = getCurrentSpeed();

    console.log(
      "[YT Controller] Updating active states - Quality:",
      currentQuality,
      "Speed:",
      currentSpeed
    );

    // Update quality buttons - FORCE remove all active states first
    if (settings.qualityEnabled) {
      container.querySelectorAll(".ytc-quality-btn").forEach((btn) => {
        btn.classList.remove("active");
        btn.style.backgroundColor = ""; // Force style reset
        btn.style.borderColor = ""; // Force style reset
        btn.style.color = ""; // Force style reset
      });

      // Find and highlight the current quality button
      let qualityFound = false;
      container.querySelectorAll(".ytc-quality-btn").forEach((btn) => {
        if (btn.dataset.quality === currentQuality) {
          btn.classList.add("active");
          qualityFound = true;
          console.log(
            "[YT Controller] Activated quality button:",
            currentQuality
          );
        }
      });

      if (!qualityFound) {
        console.log(
          "[YT Controller] No quality button found for:",
          currentQuality
        );
      }
    }

    // Update speed buttons - FORCE remove all active states first
    if (settings.speedEnabled) {
      container.querySelectorAll(".ytc-speed-btn").forEach((btn) => {
        btn.classList.remove("active");
        btn.style.backgroundColor = ""; // Force style reset
        btn.style.borderColor = ""; // Force style reset
        btn.style.color = ""; // Force style reset
      });

      // Find and highlight the current speed button
      let speedFound = false;
      container.querySelectorAll(".ytc-speed-btn").forEach((btn) => {
        const buttonSpeed = parseFloat(btn.dataset.speed);
        if (Math.abs(buttonSpeed - currentSpeed) < 0.01) {
          btn.classList.add("active");
          speedFound = true;
          console.log("[YT Controller] Activated speed button:", buttonSpeed);
        }
      });

      if (!speedFound) {
        console.log("[YT Controller] No speed button found for:", currentSpeed);
      }
    }

    // Update volume UI
    if (settings.toolsEnabled !== false) {
      updateVolumeUI();
    }

    // FIXED: Force CSS reflow to ensure styles apply
    if (container.offsetHeight) {
      // Force reflow
    }
  }

  function createButton(type, value, label, handler) {
    const btn = document.createElement("button");
    btn.className = `ytc-btn ytc-${type}-btn`;
    btn.dataset[type] = value;
    btn.textContent = label;
    btn.title = `Set ${type} to ${label}`;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log(`[YT Controller] ${type} button clicked:`, value);

      // Immediately update visual state for responsiveness
      if (type === "quality") {
        container
          .querySelectorAll(".ytc-quality-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      } else if (type === "speed") {
        container
          .querySelectorAll(".ytc-speed-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      }

      handler(value);
    });

    return btn;
  }

  function createControls() {
    if (container) {
      container.remove();
      container = null;
    }

    // Check if either control type is enabled
    if (!settings.qualityEnabled && !settings.speedEnabled) {
      console.log(
        "[YT Controller] Both controls disabled, not creating interface"
      );
      return;
    }

    // Wait for the watch metadata element to appear
    let injectionAttempts = 0;
    const MAX_INJECTION_ATTEMPTS = 100; // 100 * 100ms = 10 seconds

    const checkForMetadata = () => {
      injectionAttempts++;
      if (injectionAttempts > MAX_INJECTION_ATTEMPTS) {
        console.log(
          "[YT Controller] Could not find metadata element after 10s. Aborting."
        );
        return;
      }

      const metadataElement =
        document.querySelector("ytd-watch-metadata") ||
        document.querySelector("ytd-watch-flexy #below");

      // Also check for parentNode to ensure it's attached to the DOM
      if (!metadataElement || !metadataElement.parentNode) {
        setTimeout(checkForMetadata, 100);
        return;
      }

      console.log(
        "[YT Controller] Found metadata element, creating controls above it"
      );

      container = document.createElement("div");
      container.id = "ytc-controls";
      container.className = "ytc-inline-controls";

      // Create a horizontal layout with speed on left, quality on right
      const controlsWrapper = document.createElement("div");
      controlsWrapper.className = "ytc-controls-wrapper";

      // ── 1. Quality section (top row) ──
      if (settings.qualityEnabled) {
        const qualitySection = document.createElement("div");
        qualitySection.className = "ytc-inline-section";

        const qualityToggleBtn = document.createElement("button");
        qualityToggleBtn.className = "ytc-section-toggle";
        qualityToggleBtn.innerHTML = svgIcon(ICONS.quality) + " Quality " + svgIcon(ICONS.chevron, 11);
        qualityToggleBtn.title = "Toggle Quality controls";
        let qualityExpanded = true;

        const qualityButtons = document.createElement("div");
        qualityButtons.className = "ytc-inline-buttons ytc-collapsible";
        qualityButtons.id = "quality-buttons";

        qualityToggleBtn.addEventListener("click", (e) => {
          e.preventDefault(); e.stopPropagation();
          qualityExpanded = !qualityExpanded;
          qualityButtons.classList.toggle("collapsed", !qualityExpanded);
          qualityToggleBtn.classList.toggle("section-collapsed", !qualityExpanded);
        });

        qualitySection.appendChild(qualityButtons);  // buttons LEFT of toggle
        qualitySection.appendChild(qualityToggleBtn); // toggle stays RIGHT
        controlsWrapper.appendChild(qualitySection);
      }

      // ── 2. Tools section (middle row) ──
      if (settings.toolsEnabled !== false) {
        const toolsSection = document.createElement("div");
        toolsSection.className = "ytc-inline-section";

        const toolsHeader = document.createElement("div");
        toolsHeader.className = "ytc-inline-header";

        const toolsButtons = document.createElement("div");
        toolsButtons.className = "ytc-inline-buttons";
        toolsButtons.id = "tools-buttons";

        toolsSection.appendChild(toolsHeader);
        toolsSection.appendChild(toolsButtons);
        controlsWrapper.appendChild(toolsSection);
      }

      // ── 3. Speed section (bottom row) ──
      if (settings.speedEnabled) {
        const speedSection = document.createElement("div");
        speedSection.className = "ytc-inline-section";

        const speedToggleBtn = document.createElement("button");
        speedToggleBtn.className = "ytc-section-toggle";
        speedToggleBtn.innerHTML = svgIcon(ICONS.speed) + " Speed " + svgIcon(ICONS.chevron, 11);
        speedToggleBtn.title = "Toggle Speed controls";
        let speedExpanded = true;

        const speedButtons = document.createElement("div");
        speedButtons.className = "ytc-inline-buttons ytc-collapsible";
        speedButtons.id = "speed-buttons";

        speedToggleBtn.addEventListener("click", (e) => {
          e.preventDefault(); e.stopPropagation();
          speedExpanded = !speedExpanded;
          speedButtons.classList.toggle("collapsed", !speedExpanded);
          speedToggleBtn.classList.toggle("section-collapsed", !speedExpanded);
        });

        speedSection.appendChild(speedButtons);     // buttons LEFT of toggle
        speedSection.appendChild(speedToggleBtn);    // toggle stays RIGHT
        controlsWrapper.appendChild(speedSection);
      }

      container.appendChild(controlsWrapper);

      // Insert directly BEFORE the metadata element (above it)
      metadataElement.parentNode.insertBefore(container, metadataElement);

      // Populate buttons based on settings
      if (settings.qualityEnabled) {
        // Optimization: if we already have qualities, show them immediately to avoid "reload" flash
        if (availableQualities.length > 0) {
          populateQualityButtons(availableQualities);
        }
        startQualityDetection();
      } else {
        setupPlayerListeners();
      }

      if (settings.toolsEnabled !== false) {
        populateToolsButtons();
      }

      if (settings.speedEnabled) {
        populateSpeedButtons();
      }

      console.log("[YT Controller] Controls created with settings:", settings);
    };

    checkForMetadata();
  }

  function populateSpeedButtons() {
    const speedContainer = document.getElementById("speed-buttons");
    if (!speedContainer) return;

    speedContainer.innerHTML = "";
    speedValues.forEach((speed) => {
      let label;
      if (speed === "1") {
        label = "Normal";
      } else {
        label = `${speed}x`;
      }

      const btn = createButton("speed", speed, label, setSpeed);
      speedContainer.appendChild(btn);
    });

    console.log(
      "[YT Controller] Speed buttons populated with extended options:",
      speedValues
    );
  }

  // SVG icon helper — Lucide-compatible inline SVGs
  function svgIcon(path, size = 13) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  const ICONS = {
    volume:    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    mute:      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
    cc:        '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M7 12h2m4 0h4"/><path d="M7 16h8"/>',
    // Camera icon for screenshot
    frame:     '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    loop:      '<polyline points="17 2 21 6 17 10"/><path d="M21 6H8a6 6 0 0 0-6 6v1"/><polyline points="7 22 3 18 7 14"/><path d="M3 18h13a6 6 0 0 0 6-6v-1"/>',
    link:      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    copyurl:   '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    embed:     '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    chevron:   '<polyline points="6 9 12 15 18 9"/>',
    quality:   '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    speed:     '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  };

  // Tracks last non-zero volume for mute toggle restore
  let _lastVol = 100;

  function populateToolsButtons() {
    const toolsContainer = document.getElementById("tools-buttons");
    if (!toolsContainer) return;
    toolsContainer.innerHTML = "";

    // ── 1. Custom Volume Slider Widget ──────────────────────────────────────
    const volWrapper = document.createElement("div");
    volWrapper.className = "ytc-vol-widget";

    // Distinct volume pill — has extra accent class
    const volPill = document.createElement("button");
    volPill.className = "ytc-btn ytc-tool-btn ytc-vol-pill ytc-vol-accent";
    
    // Init: capture real volume before any state changes
    const initVol = getCurrentVolume();
    if (initVol > 0) _lastVol = initVol;

    // Slider panel (hidden by default, shown on hover/click)
    const volPanel = document.createElement("div");
    volPanel.className = "ytc-vol-panel";

    const volSlider = document.createElement("input");
    volSlider.type = "range";
    volSlider.min = 0;
    volSlider.max = 100;
    volSlider.step = 5;   // Snaps every 5%
    volSlider.value = initVol;
    volSlider.className = "ytc-vol-slider";

    // Snap labels (0, 25, 50, 75, 100)
    const volTicks = document.createElement("div");
    volTicks.className = "ytc-vol-ticks";
    [0, 25, 50, 75, 100].forEach(v => {
      const t = document.createElement("span");
      t.textContent = v + "%";
      volTicks.appendChild(t);
    });

    volSlider.addEventListener("input", (e) => setVolume(parseInt(e.target.value)));

    // Click on pill: mute → restore previous vol; unmuted → mute
    volPill.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = getCurrentVolume();
      setVolume(cur === 0 ? _lastVol : 0);
    });

    // Initial update
    volSlider.style.setProperty("--val", initVol);
    // (We'll update the pill text after it's attached or just do it now)
    const icon = initVol === 0 ? ICONS.mute : ICONS.volume;
    const label = initVol === 0 ? "Muted" : `${initVol}%`;
    volPill.innerHTML = svgIcon(icon) + ` ${label}`;
    volPill.classList.toggle("ytc-vol-muted", initVol === 0);

    // ── Hover: show panel immediately, hide with a grace-period delay ──────────
    // This prevents the panel from vanishing before the cursor can reach it.
    let _volHideTimer = null;

    const showPanel = () => {
      clearTimeout(_volHideTimer);
      volPanel.classList.add("show");
    };
    const hidePanel = () => {
      _volHideTimer = setTimeout(() => volPanel.classList.remove("show"), 350);
    };

    // Pill hover
    volWrapper.addEventListener("mouseenter", showPanel);
    volWrapper.addEventListener("mouseleave", hidePanel);

    // Panel itself — cancel hide when cursor is inside
    volPanel.addEventListener("mouseenter", showPanel);
    volPanel.addEventListener("mouseleave", hidePanel);

    volPanel.appendChild(volSlider);
    volPanel.appendChild(volTicks);
    volWrapper.appendChild(volPill);
    volWrapper.appendChild(volPanel);
    toolsContainer.appendChild(volWrapper);

    // ── 2. CC Toggle ─────────────────────────────────────────────────────────
    const ccBtn = document.createElement("button");
    ccBtn.className = "ytc-btn ytc-tool-btn";
    ccBtn.innerHTML = svgIcon(ICONS.cc) + " CC";
    ccBtn.title = "Toggle Captions";
    ccBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const btn = document.querySelector(".ytp-subtitles-button");
      if (btn) btn.click();
    });
    toolsContainer.appendChild(ccBtn);

    // ── 3. Screenshot ─────────────────────────────────────────────────────────
    const screenshotBtn = document.createElement("button");
    screenshotBtn.className = "ytc-btn ytc-tool-btn";
    screenshotBtn.innerHTML = svgIcon(ICONS.frame) + " Frame";
    screenshotBtn.title = "Screenshot current frame";
    screenshotBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const video = document.querySelector("video");
      if (!video) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `YouTube_Screenshot_${Date.now()}.png`;
      a.click();
    });
    toolsContainer.appendChild(screenshotBtn);

    // ── 4. Loop ───────────────────────────────────────────────────────────────
    const loopBtn = document.createElement("button");
    loopBtn.className = "ytc-btn ytc-tool-btn";
    loopBtn.innerHTML = svgIcon(ICONS.loop) + " Loop";
    loopBtn.title = "Toggle Loop";
    const vid = document.querySelector("video");
    if (vid && vid.loop) loopBtn.classList.add("active");
    loopBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const video = document.querySelector("video");
      if (!video) return;
      video.loop = !video.loop;
      loopBtn.classList.toggle("active", video.loop);
    });
    toolsContainer.appendChild(loopBtn);

    // ── 5. Copy Time Link ─────────────────────────────────────────────────────
    const copyLinkBtn = document.createElement("button");
    copyLinkBtn.className = "ytc-btn ytc-tool-btn";
    copyLinkBtn.innerHTML = svgIcon(ICONS.link) + " Time Link";
    copyLinkBtn.title = "Copy link at current timestamp";
    copyLinkBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const v = document.querySelector("video");
      if (!v) return;
      const url = new URL(location.href);
      url.searchParams.set("t", Math.floor(v.currentTime) + "s");
      navigator.clipboard.writeText(url.toString()).then(() => {
        const orig = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = svgIcon(ICONS.link) + " Copied!";
        setTimeout(() => copyLinkBtn.innerHTML = orig, 1500);
      });
    });
    toolsContainer.appendChild(copyLinkBtn);

    // ── 5b. Copy Plain URL ────────────────────────────────────────────────────
    const copyUrlBtn = document.createElement("button");
    copyUrlBtn.className = "ytc-btn ytc-tool-btn";
    copyUrlBtn.innerHTML = svgIcon(ICONS.copyurl) + " Copy URL";
    copyUrlBtn.title = "Copy clean video URL (no timestamp)";
    copyUrlBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const url = new URL(location.href);
      // Keep only the video ID — strip timestamp and other params
      const videoId = url.searchParams.get("v");
      const cleanUrl = videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : `https://www.youtube.com/watch?v=${url.searchParams.get("v")}`;
      navigator.clipboard.writeText(cleanUrl).then(() => {
        const orig = copyUrlBtn.innerHTML;
        copyUrlBtn.innerHTML = svgIcon(ICONS.copyurl) + " Copied!";
        setTimeout(() => copyUrlBtn.innerHTML = orig, 1500);
      });
    });
    toolsContainer.appendChild(copyUrlBtn);

    // ── 6. Copy Embed ─────────────────────────────────────────────────────────
    const embedBtn = document.createElement("button");
    embedBtn.className = "ytc-btn ytc-tool-btn";
    embedBtn.innerHTML = svgIcon(ICONS.embed) + " Embed";
    embedBtn.title = "Copy embed code";
    embedBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const url = new URL(location.href);
      const videoId = url.searchParams.get("v");
      if (!videoId) return;
      const code = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
      navigator.clipboard.writeText(code).then(() => {
        const orig = embedBtn.innerHTML;
        embedBtn.innerHTML = svgIcon(ICONS.embed) + " Copied!";
        setTimeout(() => embedBtn.innerHTML = orig, 1500);
      });
    });
    toolsContainer.appendChild(embedBtn);

    // ── 7. Audio Language Track (hidden until multiple tracks found) ──────────
    const langSelect = document.createElement("select");
    langSelect.className = "ytc-select ytc-tool-btn";
    langSelect.innerHTML = `<option value="">Audio Track</option>`;
    langSelect.style.display = "none";
    langSelect.addEventListener("change", (e) => {
      const p = getPlayer();
      if (!p || e.target.value === "") return;
      if (typeof p.setAudioTrack === "function" && typeof p.getAvailableAudioTracks === "function") {
        const tracks = p.getAvailableAudioTracks();
        if (tracks && tracks[e.target.value]) p.setAudioTrack(tracks[e.target.value]);
      }
    });
    toolsContainer.appendChild(langSelect);

    setTimeout(() => {
      const p = getPlayer();
      if (p && typeof p.getAvailableAudioTracks === "function") {
        const tracks = p.getAvailableAudioTracks();
        if (tracks && tracks.length > 1) {
          langSelect.innerHTML = `<option value="">Audio Track</option>`;
          tracks.forEach((track, index) => {
            const opt = document.createElement("option");
            opt.value = index;
            opt.textContent = track.name || track.id || `Track ${index + 1}`;
            langSelect.appendChild(opt);
          });
          langSelect.style.display = "inline-flex";
        }
      }
    }, 2500);
  }

  function fillMissingQualities(qualities) {
    const list = [...new Set(qualities)];
    const hasHighRes = list.some(q => 
      ["hd1080", "hd1080premium", "hd1440", "hd2160", "hd2880", "hd4320", "highres"].includes(q)
    );
    
    if (hasHighRes) {
      // If 1080p or higher is available, the standard set of lower qualities is virtually always there
      const standards = ["hd1080", "hd1080premium", "hd720", "large", "medium", "small", "tiny"];
      standards.forEach(s => {
        if (!list.includes(s)) list.push(s);
      });
    }

    // Always sort for consistent comparison in detectQualities
    const order = [
      "auto", "tiny", "small", "medium", "large", "hd720", "hd1080", 
      "hd1080premium", "hd1440", "hd2160", "hd2880", "hd4320", "highres"
    ];
    return list.sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  function startQualityDetection() {
    console.log("[YT Controller] Starting quality detection");
    qualityDetectionAttempts = 0;

    if (detectionTimer) {
      clearInterval(detectionTimer);
    }

    detectionTimer = setInterval(() => {
      detectQualities();
    }, 200); // Check every 200ms
  }

  function detectQualities() {
    qualityDetectionAttempts++;

    const p = getPlayer();
    if (!p) {
      if (qualityDetectionAttempts > MAX_DETECTION_ATTEMPTS) {
        console.log("[YT Controller] Max detection attempts reached, using fallback if needed");
        clearInterval(detectionTimer);
        if (availableQualities.length === 0) {
          availableQualities = ["auto", "hd720", "hd1080", "hd1080premium"];
          populateQualityButtons(availableQualities);
        }
      }
      return;
    }

    try {
      if (typeof p.getAvailableQualityLevels === "function") {
        const qualities = p.getAvailableQualityLevels();

        if (qualities && qualities.length > 0) {
          // Check if it's likely a complete list (YouTube usually returns auto + at least 2 formats when ready)
          const isComplete = qualities.length >= 3;

          // Fill in missing qualities if 1080p+ is available
          let modifiedQualities = fillMissingQualities(qualities);

          // If qualities changed, update UI and internal list
          if (modifiedQualities.join(",") !== availableQualities.join(",")) {
            console.log("[YT Controller] Detected qualities:", modifiedQualities);
            availableQualities = modifiedQualities;
            populateQualityButtons(modifiedQualities);
            setupPlayerListeners();
          }

          // Stop checking if we found multiple (proper list), or if max retry exhausted
          if (isComplete || qualityDetectionAttempts > MAX_DETECTION_ATTEMPTS) {
            clearInterval(detectionTimer);
            return;
          }
        }
      }
    } catch (e) {
      console.log("[YT Controller] Quality detection error:", e);
    }

    // Try alternative detection via DOM inspection ONLY once to avoid spamming the DOM settings click.
    if (qualityDetectionAttempts === 20 && availableQualities.length <= 1) {
      tryDOMQualityDetection();
    }

    if (qualityDetectionAttempts > MAX_DETECTION_ATTEMPTS) {
      console.log("[YT Controller] Max detection attempts reached, using fallback if needed");
      clearInterval(detectionTimer);
      if (availableQualities.length === 0) {
        availableQualities = ["auto", "hd720", "hd1080", "hd1080premium"];
        populateQualityButtons(availableQualities);
      }
    }
  }

  function tryDOMQualityDetection() {
    console.log("[YT Controller] Trying DOM quality detection");

    const settingsBtn = document.querySelector(".ytp-settings-button");
    if (!settingsBtn) return;

    // Briefly open settings to detect qualities
    settingsBtn.click();

    setTimeout(() => {
      const qualityMenuItem = Array.from(
        document.querySelectorAll(".ytp-menuitem")
      ).find((item) => item.textContent.toLowerCase().includes("quality"));

      if (qualityMenuItem) {
        qualityMenuItem.click();

        setTimeout(() => {
          const detectedQualities = [];
          const qualityOptions = document.querySelectorAll(".ytp-menuitem");

          qualityOptions.forEach((option) => {
            const text = option.textContent.toLowerCase();
            if (text.includes("auto")) detectedQualities.push("auto");
            if (text.includes("144p")) detectedQualities.push("tiny");
            if (text.includes("240p")) detectedQualities.push("small");
            if (text.includes("360p")) detectedQualities.push("medium");
            if (text.includes("480p")) detectedQualities.push("large");
            if (text.includes("720p")) detectedQualities.push("hd720");
            if (
              text.includes("1080p") &&
              !text.includes("premium") &&
              !text.includes("enhanced")
            ) {
              detectedQualities.push("hd1080");
            }
            if (
              text.includes("1080p") &&
              (text.includes("premium") || text.includes("enhanced"))
            ) {
              detectedQualities.push("hd1080premium");
            }
            if (text.includes("1440p")) detectedQualities.push("hd1440");
            if (text.includes("2160p") || text.includes("4k"))
              detectedQualities.push("hd2160");
            // Enhanced 8K detection
            if (text.includes("2880p") || text.includes("5k"))
              detectedQualities.push("hd2880");
            if (text.includes("4320p") || text.includes("8k"))
              detectedQualities.push("hd4320");
            if (text.includes("highres")) detectedQualities.push("highres");
          });

          // Close settings
          settingsBtn.click();

          if (detectedQualities.length > 0) {
            // Apply filling logic and update
            const finalQualities = fillMissingQualities(detectedQualities);
            
            console.log(
              "[YT Controller] DOM detected qualities (filled):",
              finalQualities
            );
            
            clearInterval(detectionTimer);
            availableQualities = finalQualities;
            populateQualityButtons(finalQualities);
            setupPlayerListeners();
          }
        }, 200);
      } else {
        // Close settings if quality menu not found
        settingsBtn.click();
      }
    }, 150);
  }

  function populateQualityButtons(qualities) {
    const qualityContainer = document.getElementById("quality-buttons");
    const loadingEl = document.getElementById("quality-loading");

    if (!qualityContainer) return;

    // Hide loading indicator
    if (loadingEl) {
      loadingEl.style.display = "none";
    }

    qualityContainer.innerHTML = "";

    // Sort qualities in logical order (including 8K variants)
    const sortedQualities = qualities.sort((a, b) => {
      const order = [
        "auto",
        "tiny",
        "small",
        "medium",
        "large",
        "hd720",
        "hd1080",
        "hd1080premium",
        "hd1440",
        "hd2160",
        "hd2880",
        "hd4320",
        "highres",
      ];
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);

      // If quality not found in our order list, put it at the end
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    });

    sortedQualities.forEach((quality) => {
      if (qualityLabels[quality]) {
        const btn = createButton(
          "quality",
          quality,
          qualityLabels[quality],
          setQuality
        );
        qualityContainer.appendChild(btn);
      } else {
        // Handle unknown quality formats
        console.log("[YT Controller] Unknown quality format:", quality);
        const label = quality.replace("hd", "") + "p";
        const btn = createButton("quality", quality, label, setQuality);
        qualityContainer.appendChild(btn);
      }
    });

    console.log("[YT Controller] Quality buttons populated with:", qualities);

    // Update active states multiple times to ensure proper detection
    setTimeout(() => updateActiveStates(), 500);
    setTimeout(() => updateActiveStates(), 1000);
    setTimeout(() => updateActiveStates(), 2000);
  }

  function setupPlayerListeners() {
    const p = getPlayer();
    if (!p) return;

    try {
      // Remove existing listeners to prevent duplicates
      p.removeEventListener("onPlaybackQualityChange", updateActiveStates);
      p.removeEventListener("onPlaybackRateChange", updateActiveStates);
      p.removeEventListener("onStateChange", updateActiveStates);

      // Add fresh listeners
      p.addEventListener("onPlaybackQualityChange", updateActiveStates);
      p.addEventListener("onPlaybackRateChange", updateActiveStates);
      p.addEventListener("onStateChange", updateActiveStates);

      console.log("[YT Controller] Player listeners attached");
    } catch (e) {
      console.log("[YT Controller] Could not attach player listeners:", e);
    }

    // Also listen to video element
    const video = document.querySelector("video");
    if (video) {
      video.removeEventListener("ratechange", updateActiveStates);
      video.addEventListener("ratechange", updateActiveStates);

      // Listen for video quality changes
      video.removeEventListener("loadedmetadata", updateActiveStates);
      video.addEventListener("loadedmetadata", updateActiveStates);

      // Listen for volume changes (external or internal)
      video.removeEventListener("volumechange", updateActiveStates);
      video.addEventListener("volumechange", updateActiveStates);
    }

    // Start periodic updates with more frequent checks
    if (window.ytcUpdateInterval) clearInterval(window.ytcUpdateInterval);
    window.ytcUpdateInterval = setInterval(updateActiveStates, 2000);
  }

  async function init() {
    if (!location.pathname.startsWith("/watch")) {
      if (container) {
        container.remove();
        container = null;
      }
      if (detectionTimer) {
        clearInterval(detectionTimer);
      }
      availableQualities = []; // Reset available qualities
      return;
    }

    console.log("[YT Controller] Initializing for:", location.pathname);

    // Load settings first
    await loadSettings();

    // Reset state
    player = null;
    qualityDetectionAttempts = 0;
    availableQualities = []; // Reset available qualities

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Create controls immediately
    createControls();
  }

  function handleUrlChange() {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log("[YT Controller] URL changed to:", currentUrl);
      setTimeout(init, 100);
    }
  }

  // Early DOM ready detection
  function waitForDOMReady() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  // Navigation observer
  const observer = new MutationObserver(handleUrlChange);

  // Wait for body to exist before observing
  function startObserving() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });

      // *** RELIABILITY FIX: Listen for YouTube's own navigation event ***
      window.addEventListener("yt-navigate-finish", handleUrlChange, true);

      lastUrl = location.href;
      waitForDOMReady();
    } else {
      setTimeout(startObserving, 10);
    }
  }

  startObserving();
})();
