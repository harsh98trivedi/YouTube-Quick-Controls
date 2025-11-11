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
    shortcuts: {
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

    try {
      // Method 1: Try direct API call
      if (typeof p.setPlaybackQuality === "function") {
        p.setPlaybackQuality(quality);
        console.log("[YT Controller] Quality set via player API");

        // FIXED: More aggressive active state updates for shortcuts
        setTimeout(() => updateActiveStates(), 100);
        setTimeout(() => updateActiveStates(), 300);
        setTimeout(() => updateActiveStates(), 500);
        return;
      }
    } catch (e) {
      console.log("[YT Controller] Player API failed:", e);
    }

    // Method 2: Simulate clicking YouTube's quality menu (more reliable)
    try {
      simulateQualityClick(quality);
    } catch (e) {
      console.error("[YT Controller] Quality simulation failed:", e);
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
            } else if (targetQuality === "hd1080" && text.includes("1080")) {
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

      // Method 1: Direct API (try first, but don't always trust it for Auto)
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
          return quality;
        }
      }

      // Method 2: Check if YouTube's quality selector shows Auto
      // This is the most reliable way to detect Auto mode
      const settingsBtn = document.querySelector(".ytp-settings-button");
      if (settingsBtn) {
        // Look for existing quality display text in the player
        const qualityDisplays = document.querySelectorAll(".ytp-menuitem");
        for (const display of qualityDisplays) {
          const text = display.textContent.toLowerCase();
          if (text.includes("quality")) {
            // Check if the quality line shows "Auto"
            if (text.includes("auto")) {
              console.log(
                "[YT Controller] Detected Auto quality from menu text"
              );
              return "auto";
            }
          }
        }
      }

      // Method 3: Check video element dimensions (for non-Auto qualities)
      const video = document.querySelector("video");
      if (video && video.videoHeight && video.videoWidth) {
        const videoHeight = video.videoHeight;
        console.log("[YT Controller] Video height:", videoHeight);

        // If we have a valid quality from API and video dimensions match, use API
        if (quality && quality !== "unknown" && quality !== "") {
          return quality;
        }

        // Map video height to quality levels
        if (videoHeight <= 144) return "tiny";
        if (videoHeight <= 240) return "small";
        if (videoHeight <= 360) return "medium";
        if (videoHeight <= 480) return "large";
        if (videoHeight <= 720) return "hd720";
        if (videoHeight <= 1080) return "hd1080";
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

      // Create speed section (left side) - only if enabled
      if (settings.speedEnabled) {
        const speedSection = document.createElement("div");
        speedSection.className = "ytc-inline-section";

        const speedHeader = document.createElement("div");
        speedHeader.className = "ytc-inline-header";

        const speedButtons = document.createElement("div");
        speedButtons.className = "ytc-inline-buttons";
        speedButtons.id = "speed-buttons";

        speedSection.appendChild(speedHeader);
        speedSection.appendChild(speedButtons);
        controlsWrapper.appendChild(speedSection);
      }

      // Create quality section (right side) - only if enabled
      if (settings.qualityEnabled) {
        const qualitySection = document.createElement("div");
        qualitySection.className = "ytc-inline-section";

        const qualityHeader = document.createElement("div");
        qualityHeader.className = "ytc-inline-header";

        const qualityButtons = document.createElement("div");
        qualityButtons.className = "ytc-inline-buttons";
        qualityButtons.id = "quality-buttons";

        qualitySection.appendChild(qualityHeader);
        qualitySection.appendChild(qualityButtons);
        controlsWrapper.appendChild(qualitySection);
      }

      container.appendChild(controlsWrapper);

      // Insert directly BEFORE the metadata element (above it)
      metadataElement.parentNode.insertBefore(container, metadataElement);

      // Populate buttons based on settings
      if (settings.speedEnabled) {
        populateSpeedButtons();
      }

      if (settings.qualityEnabled) {
        startQualityDetection();
      } else {
        // Still setup player listeners for speed if quality is disabled
        setupPlayerListeners();
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

    if (qualityDetectionAttempts > MAX_DETECTION_ATTEMPTS) {
      console.log(
        "[YT Controller] Max detection attempts reached, using fallback"
      );
      clearInterval(detectionTimer);
      populateQualityButtons(["auto", "hd720", "hd1080"]);
      return;
    }

    const p = getPlayer();
    if (!p) return;

    try {
      if (typeof p.getAvailableQualityLevels === "function") {
        const qualities = p.getAvailableQualityLevels();

        if (qualities && qualities.length > 0) {
          console.log("[YT Controller] Detected qualities:", qualities);
          clearInterval(detectionTimer);
          availableQualities = qualities; // Store available qualities
          populateQualityButtons(qualities);

          // Setup player listeners
          setupPlayerListeners();
          return;
        }
      }
    } catch (e) {
      console.log("[YT Controller] Quality detection error:", e);
    }

    // Try alternative detection via DOM inspection
    if (qualityDetectionAttempts > 10) {
      tryDOMQualityDetection();
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
            if (text.includes("1080p")) detectedQualities.push("hd1080");
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
            console.log(
              "[YT Controller] DOM detected qualities:",
              detectedQualities
            );
            clearInterval(detectionTimer);
            availableQualities = detectedQualities; // Store available qualities
            populateQualityButtons([...new Set(detectedQualities)]);
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
