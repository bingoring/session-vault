document.addEventListener("DOMContentLoaded", async () => {
  // UI Elements
  const newTabOverrideToggle = document.getElementById("newTabOverrideToggle");
  const autoSaveToggle = document.getElementById("autoSaveToggle");
  const autoSaveAllWindowsToggle = document.getElementById("autoSaveAllWindowsToggle");
  const radioOptions = document.querySelectorAll('.radio-option');
  const autoSaveInterval = document.getElementById("autoSaveInterval");
  const timeIntervalSection = document.getElementById("timeIntervalSection");
  const changeDetectionSection = document.getElementById("changeDetectionSection");
  const checkboxes = document.querySelectorAll('.checkbox');
  const statusMessage = document.getElementById("statusMessage");

  // Load saved settings
  const settings = await chrome.storage.sync.get([
    "newTabOverride",
    "autoSaveEnabled",
    "autoSaveAllWindows",
    "autoSaveTrigger",
    "autoSaveInterval",
    "detectTabClose",
    "detectTabCreate",
    "detectUrlChange"
  ]);

  // Initialize UI with saved settings
  initializeUI(settings);

  // Event Listeners
  setupEventListeners();

  function initializeUI(settings) {
    // New Tab Override
    setToggleState(newTabOverrideToggle, settings.newTabOverride ?? false);

    // Auto Save
    setToggleState(autoSaveToggle, settings.autoSaveEnabled ?? true);
    setToggleState(autoSaveAllWindowsToggle, settings.autoSaveAllWindows ?? false);

    // Auto Save Trigger
    const trigger = settings.autoSaveTrigger ?? "time";
    setRadioSelection(trigger);

    // Auto Save Interval
    autoSaveInterval.value = settings.autoSaveInterval ?? 60;

    // Change Detection
    setCheckboxState('detectTabClose', settings.detectTabClose ?? true);
    setCheckboxState('detectTabCreate', settings.detectTabCreate ?? true);
    setCheckboxState('detectUrlChange', settings.detectUrlChange ?? true);

    // Show/hide sections based on trigger
      toggleTriggerSections(trigger);
  }

  function setupEventListeners() {
    // Toggle switches
    newTabOverrideToggle.addEventListener("click", () => {
      const isActive = toggleSwitch(newTabOverrideToggle);
      chrome.storage.sync.set({ newTabOverride: isActive });
      chrome.runtime.sendMessage({ action: "toggleNewTabOverride", enabled: isActive });
      showStatus("New tab override " + (isActive ? "enabled" : "disabled"), "success");
    });

    autoSaveToggle.addEventListener("click", () => {
      const isActive = toggleSwitch(autoSaveToggle);
      chrome.storage.sync.set({ autoSaveEnabled: isActive });
      chrome.runtime.sendMessage({ action: "toggleAutoSave", enabled: isActive });
      showStatus("Auto save " + (isActive ? "enabled" : "disabled"), "success");
  });

    autoSaveAllWindowsToggle.addEventListener("click", () => {
      const isActive = toggleSwitch(autoSaveAllWindowsToggle);
      chrome.storage.sync.set({ autoSaveAllWindows: isActive });
      showStatus("Save all windows " + (isActive ? "enabled" : "disabled"), "success");
  });

    // Radio options
    radioOptions.forEach(option => {
      option.addEventListener("click", () => {
        const value = option.dataset.value;
        setRadioSelection(value);
        chrome.storage.sync.set({ autoSaveTrigger: value });
        toggleTriggerSections(value);

        if (value === "time") {
      chrome.runtime.sendMessage({
        action: "updateAutoSaveSettings",
        trigger: "time",
        interval: parseInt(autoSaveInterval.value)
      });
        } else {
      chrome.runtime.sendMessage({
        action: "updateAutoSaveSettings",
        trigger: "change",
            detectTabClose: isCheckboxChecked('detectTabClose'),
            detectTabCreate: isCheckboxChecked('detectTabCreate'),
            detectUrlChange: isCheckboxChecked('detectUrlChange')
      });
    }

        showStatus("Backup trigger updated", "success");
      });
  });

    // Auto Save Interval
  autoSaveInterval.addEventListener("change", () => {
    const interval = parseInt(autoSaveInterval.value);
    chrome.storage.sync.set({ autoSaveInterval: interval });

      if (getSelectedRadioValue() === "time") {
      chrome.runtime.sendMessage({
        action: "updateAutoSaveSettings",
        trigger: "time",
        interval: interval
      });
    }

      showStatus("Save interval updated", "success");
    });

    // Checkboxes
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener("click", () => {
        const id = checkbox.dataset.id;
        const isChecked = toggleCheckbox(checkbox);

        const settingKey = id; // detectTabClose, detectTabCreate, detectUrlChange
        chrome.storage.sync.set({ [settingKey]: isChecked });

        if (getSelectedRadioValue() === "change") {
        chrome.runtime.sendMessage({
          action: "updateAutoSaveSettings",
          trigger: "change",
            detectTabClose: isCheckboxChecked('detectTabClose'),
            detectTabCreate: isCheckboxChecked('detectTabCreate'),
            detectUrlChange: isCheckboxChecked('detectUrlChange')
          });
        }

        showStatus("Change detection updated", "success");
      });
    });
  }

  // Helper Functions
  function setToggleState(toggle, isActive) {
    if (isActive) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  }

  function toggleSwitch(toggle) {
    const isActive = !toggle.classList.contains('active');
    setToggleState(toggle, isActive);
    return isActive;
  }

  function setRadioSelection(value) {
    radioOptions.forEach(option => {
      if (option.dataset.value === value) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
  }

  function getSelectedRadioValue() {
    const selected = document.querySelector('.radio-option.selected');
    return selected ? selected.dataset.value : 'time';
  }

  function setCheckboxState(id, isChecked) {
    const checkbox = document.querySelector(`[data-id="${id}"]`);
    if (checkbox) {
      if (isChecked) {
        checkbox.classList.add('checked');
      } else {
        checkbox.classList.remove('checked');
      }
    }
  }

  function toggleCheckbox(checkbox) {
    const isChecked = !checkbox.classList.contains('checked');
    if (isChecked) {
      checkbox.classList.add('checked');
    } else {
      checkbox.classList.remove('checked');
    }
    return isChecked;
  }

  function isCheckboxChecked(id) {
    const checkbox = document.querySelector(`[data-id="${id}"]`);
    return checkbox ? checkbox.classList.contains('checked') : false;
  }

  function toggleTriggerSections(trigger) {
    if (trigger === "time") {
      timeIntervalSection.style.display = "block";
      changeDetectionSection.style.display = "none";
    } else {
      timeIntervalSection.style.display = "none";
      changeDetectionSection.style.display = "block";
    }
  }

  function showStatus(message, type = "success") {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.style.display = "block";

    // Hide after 3 seconds
    setTimeout(() => {
      statusMessage.style.display = "none";
    }, 3000);
  }
});
