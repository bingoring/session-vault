// ============== Side Panel Management ==============

// Handle action button click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('Action button clicked, opening side panel');

    // Simply open the side panel for this window
    await chrome.sidePanel.open({
      windowId: tab.windowId
    });

    console.log('Side panel opened successfully');
  } catch (error) {
    console.error('Error opening side panel:', error);

    // Fallback: try setting side panel options first
    try {
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        enabled: true,
        path: 'sidepanel.html'
      });

      await chrome.sidePanel.open({
        windowId: tab.windowId
      });
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
    }
  }
});

// ============== Auto Session Save System ==============

let autoSaveInterval = null;
let lastSaveTime = 0;
let autoSaveSettings = {
  enabled: true,
  trigger: "time", // "time" or "change"
  interval: 60, // seconds for time-based saving
  detectTabClose: true,
  detectTabCreate: true,
  detectUrlChange: true
};

// 탭 정보 캐시 (탭 닫힘 감지를 위해)
let tabCache = new Map();
let groupCache = new Map();

// 탭 필터링 함수 - 새 탭과 불필요한 탭들을 제외
function shouldFilterTab(tab) {
  if (!tab.url) return true;

  // 새 탭 제외
  if (tab.url === 'chrome://newtab/' || tab.url.includes('chrome://newtab')) {
    return true;
  }

  // 크롬 내부 페이지들 제외
  if (tab.url.startsWith('chrome://')) {
    return true;
  }

  // 확장프로그램 페이지들 제외
  if (tab.url.startsWith('chrome-extension://')) {
    return true;
  }

  // about:blank 제외
  if (tab.url === 'about:blank') {
    return true;
  }

  // 제목이 없거나 'New Tab'인 경우도 제외
  if (!tab.title || tab.title.trim() === '' || tab.title === 'New Tab') {
    return true;
  }

  return false;
}

// 사용하지 않는 변수 제거됨

// 탭과 그룹 정보 캐시 업데이트
async function updateTabCache() {
  try {
    const tabs = await chrome.tabs.query({});
    // 기존 캐시를 완전히 지우지 말고 업데이트만 하기
    tabs.forEach(tab => {
      // 새 탭과 불필요한 탭들은 캐시하지 않기
      if (shouldFilterTab(tab)) {
        return;
      }

      tabCache.set(tab.id, {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        index: tab.index,
        active: tab.active,
        pinned: tab.pinned,
        groupId: tab.groupId,
        windowId: tab.windowId,
        favicon: tab.favIconUrl
      });
    });

    // 그룹 정보도 캐시
    const groups = await chrome.tabGroups.query({});
    groups.forEach(group => {
      groupCache.set(group.id, {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId
      });
    });
  } catch (error) {
    console.error("Error updating tab/group cache:", error);
  }
}

// 탭 생성/업데이트 감지
chrome.tabs.onCreated.addListener(async (tab) => {
  // 새로 생성된 탭만 캐시에 추가
  if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    tabCache.set(tab.id, {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      index: tab.index,
      active: tab.active,
      pinned: tab.pinned,
      groupId: tab.groupId,
      windowId: tab.windowId,
      favicon: tab.favIconUrl
    });

    // 변경 감지 기반 자동 저장
    if (autoSaveSettings.enabled && autoSaveSettings.trigger === "change" && autoSaveSettings.detectTabCreate) {
      // 새 탭이 실제로 어떤 웹사이트로 이동했을 때만 저장 (chrome://newtab이 아닌 경우)
      if (tab.url && tab.url !== 'chrome://newtab/' && !tab.url.startsWith('chrome://')) {
        setTimeout(async () => {
          try {
            const { autoSaveAllWindows } = await chrome.storage.sync.get(['autoSaveAllWindows']);
            await autoSaveCurrentSession(autoSaveAllWindows === true);
          } catch (error) {
            console.error("Auto-save on tab create error:", error);
          }
        }, 1000); // 1초 후에 저장 (페이지 로딩 대기)
      }
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // URL이 chrome:// 등으로 변경되면 캐시를 업데이트하지 않음
  if (changeInfo.url && (changeInfo.url.startsWith('chrome://') || changeInfo.url.startsWith('chrome-extension://'))) {
    console.log(`Ignoring update to ${changeInfo.url} for tab ${tabId}`);
    return;
  }

  // 유효한 URL로 업데이트되는 경우에만 캐시 갱신
  if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    const oldTabInfo = tabCache.get(tabId);

    tabCache.set(tab.id, {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      index: tab.index,
      active: tab.active,
      pinned: tab.pinned,
      groupId: tab.groupId,
      windowId: tab.windowId,
      favicon: tab.favIconUrl
    });

    // 변경 감지 기반 자동 저장 (URL이나 도메인이 변경되었을 때)
    if (autoSaveSettings.enabled && autoSaveSettings.trigger === "change" && autoSaveSettings.detectUrlChange) {
      if (changeInfo.url && oldTabInfo && oldTabInfo.url !== changeInfo.url) {
        // 도메인이나 경로가 실제로 변경되었는지 확인
        try {
          const oldDomain = new URL(oldTabInfo.url).hostname;
          const newDomain = new URL(changeInfo.url).hostname;
          const oldPath = new URL(oldTabInfo.url).pathname;
          const newPath = new URL(changeInfo.url).pathname;

          if (oldDomain !== newDomain || oldPath !== newPath) {
            setTimeout(async () => {
              try {
                const { autoSaveAllWindows } = await chrome.storage.sync.get(['autoSaveAllWindows']);
                await autoSaveCurrentSession(autoSaveAllWindows === true);
              } catch (error) {
                console.error("Auto-save on URL change error:", error);
              }
            }, 1000); // 1초 후에 저장 (페이지 로딩 대기)
          }
        } catch (error) {
          console.error("Error parsing URLs for change detection:", error);
        }
      }
    }
  }
});

chrome.tabs.onMoved.addListener(() => updateTabCache());
chrome.tabs.onAttached.addListener(() => updateTabCache());
chrome.tabs.onDetached.addListener(() => updateTabCache());

// 그룹 변경 감지
chrome.tabGroups.onCreated.addListener(() => updateTabCache());
chrome.tabGroups.onUpdated.addListener(() => updateTabCache());
chrome.tabGroups.onMoved.addListener(() => updateTabCache());

// 그룹 제거 감지
chrome.tabGroups.onRemoved.addListener(async (group) => {
  try {
    console.log(`Group removed - ID: ${group.id}`);

    // 그룹에 속한 탭들을 개별 탭으로 저장하도록 표시
    const groupTabs = [];
    for (const [tabId, tabInfo] of tabCache.entries()) {
      if (tabInfo.groupId === group.id) {
        groupTabs.push(tabId);
        // 개별 탭으로 저장하기 위해 그룹 ID 제거
        tabInfo.groupId = -1;
        tabCache.set(tabId, tabInfo);
      }
    }
    console.log(`Found ${groupTabs.length} tabs from deleted group, will save as individual tabs`);

  } catch (error) {
    console.error("Error in group remove handler:", error);
  }
});

// 자동 세션 저장 시작 (설정에 따라 분기)
function startAutoSave() {
  if (!autoSaveSettings.enabled) return;

  if (autoSaveSettings.trigger === "time") {
    startTimeBasedAutoSave();
  }
  // change-based는 이벤트 리스너에서 자동 처리됨
}

// 시간 기반 자동 저장 시작
function startTimeBasedAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }

  autoSaveInterval = setInterval(async () => {
    try {
      if (autoSaveSettings.enabled && autoSaveSettings.trigger === "time") {
        const { autoSaveAllWindows } = await chrome.storage.sync.get(['autoSaveAllWindows']);
        await autoSaveCurrentSession(autoSaveAllWindows === true);
      }
    } catch (error) {
      console.error("Auto-save error:", error);
    }
  }, autoSaveSettings.interval * 1000);
}

// 자동 세션 저장 중지
function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

// 자동 세션 저장 함수
async function autoSaveCurrentSession(saveAllWindows = false) {
  try {
    const now = Date.now();

    // 너무 자주 저장하는 것을 방지 (최소 5초 간격)
    if (now - lastSaveTime < 5000) {
      return;
    }

    let allTabs = [];
    let allGroups = [];

    if (saveAllWindows) {
      // 모든 창의 탭과 그룹 가져오기
      const windows = await chrome.windows.getAll();

      for (const window of windows) {
        const tabs = await chrome.tabs.query({ windowId: window.id });
        const groups = await chrome.tabGroups.query({ windowId: window.id });

        // 탭에 windowId 추가
        const tabsWithWindow = tabs.map(tab => ({
          ...tab,
          sourceWindowId: window.id
        }));

        // 그룹에 windowId 추가
        const groupsWithWindow = groups.map(group => ({
          ...group,
          sourceWindowId: window.id
        }));

        allTabs = allTabs.concat(tabsWithWindow);
        allGroups = allGroups.concat(groupsWithWindow);
      }
    } else {
      // 현재 활성 창의 탭과 그룹만 가져오기
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (activeTab) {
        allTabs = await chrome.tabs.query({ windowId: activeTab.windowId });
        allGroups = await chrome.tabGroups.query({ windowId: activeTab.windowId });
      }
    }

    if (allTabs.length === 0) {
      return;
    }

    // 필터링된 탭 목록 생성
    const filteredTabs = allTabs.filter(tab => !shouldFilterTab(tab));

    // 필터링 후 저장할 탭이 없으면 리턴
    if (filteredTabs.length === 0) {
      console.log("No valid tabs to save in auto-save after filtering");
      return;
    }

    // 세션 데이터 생성
    const sessionData = {
      id: `auto_${now}`,
      name: `Auto-saved ${new Date(now).toLocaleString()}`,
      createdAt: now,
      isAutoSaved: true,
      saveAllWindows: saveAllWindows,
      tabs: filteredTabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        index: tab.index,
        active: tab.active,
        pinned: tab.pinned,
        groupId: tab.groupId,
        favicon: tab.favIconUrl || null,
        sourceWindowId: tab.sourceWindowId || tab.windowId
      })),
      groups: allGroups.map(group => ({
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        sourceWindowId: group.sourceWindowId || group.windowId
      })),
      tabCount: filteredTabs.length,
      groupCount: allGroups.length,
      windowCount: saveAllWindows ? (await chrome.windows.getAll()).length : 1
    };

    // 자동 저장 세션 목록 관리
    const result = await chrome.storage.local.get(['autoSavedSessions']);
    let autoSavedSessions = result.autoSavedSessions || [];

    // 최신 세션 추가
    autoSavedSessions.unshift(sessionData);

    // 최대 50개 자동 저장 세션 유지
    if (autoSavedSessions.length > 50) {
      autoSavedSessions = autoSavedSessions.slice(0, 50);
    }

    await chrome.storage.local.set({ autoSavedSessions });

    lastSaveTime = now;
    console.log("Auto-saved session:", sessionData.id);

  } catch (error) {
    console.error("Error in auto-save:", error);
  }
}

// Chrome 테마 캐시
let cachedTheme = null;

// Chrome 테마 감지 및 캐시
async function cacheCurrentTheme() {
  try {
    if (chrome.theme && chrome.theme.getCurrent) {
      const theme = await chrome.theme.getCurrent();
      const colors = theme.colors || {};

      // 다크모드 감지
      const bgColor = colors.ntp_background || colors.frame;
      let isDarkTheme = false;
      if (bgColor) {
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
          isDarkTheme = brightness < 128;
        }
      } else {
        // 시스템 설정 확인 (미디어 쿼리는 background에서 직접 사용 불가)
        isDarkTheme = false; // 기본값
      }

      const backgroundColor = colors.ntp_background || colors.frame || (isDarkTheme ? '#202124' : '#ffffff');
      const textColor = colors.ntp_text || colors.tab_text || colors.bookmark_text || (isDarkTheme ? '#e8eaed' : '#333333');

      cachedTheme = {
        backgroundColor,
        textColor,
        isDarkTheme,
        cardBg: isDarkTheme ? '#3c4043' : 'rgba(255, 255, 255, 0.95)',
        secondaryText: isDarkTheme ? 'rgba(232, 234, 237, 0.7)' : 'rgba(60, 64, 67, 0.7)',
        boxShadow: isDarkTheme ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)',
        timestamp: Date.now()
      };

      console.log("Theme cached:", cachedTheme);
    }
  } catch (error) {
    console.error("Error caching theme:", error);
  }
}

// 확장 프로그램 시작 시 탭 캐시 초기화
setTimeout(async () => {
  await updateTabCache();
  await cacheCurrentTheme(); // 테마도 캐시

  console.log("Initial tab cache populated:", tabCache.size, "tabs");
  console.log("Initial group cache populated:", groupCache.size, "groups");

  // 현재 그룹 정보 로그
  for (const [groupId, groupInfo] of groupCache.entries()) {
    console.log(`Group ${groupId}: ${groupInfo.title} (${groupInfo.color})`);
  }
}, 1000);

// 주기적으로 캐시 업데이트 (그룹 정보 유지)
setInterval(async () => {
  await updateTabCache();
}, 10000); // 10초마다

// Chrome 테마 변경 감지
if (chrome.theme && chrome.theme.onUpdated) {
  chrome.theme.onUpdated.addListener(async (updateInfo) => {
    console.log('Theme updated, refreshing cache');
    await cacheCurrentTheme();
  });
}

// 탭 닫힘 감지 및 마지막 세션 저장
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    console.log(`Tab removed - ID: ${tabId}, Window: ${removeInfo.windowId}, IsWindowClosing: ${removeInfo.isWindowClosing}`);

    // 캐시된 탭 정보가 있는지 먼저 확인
    const cachedTab = tabCache.get(tabId);
    console.log("Cached tab info before removal:", cachedTab);

    // 변경 감지 기반 자동 저장 (탭 닫힘)
    if (autoSaveSettings.enabled && autoSaveSettings.trigger === "change" && autoSaveSettings.detectTabClose) {
      const { autoSaveAllWindows } = await chrome.storage.sync.get(['autoSaveAllWindows']);
      await autoSaveCurrentSession(autoSaveAllWindows === true);
    }
  } catch (error) {
    console.error("Error in tab close handler:", error);
  }
});

// 닫힌 탭 저장
async function saveClosedTab(closedTabId, closedWindowId, isWindowClosing = false) {
  try {
    const now = Date.now();

    // 현재 남은 탭들과 그룹들을 조회 (창이 닫혔을 수도 있으므로 예외 처리)
    let currentTabs = [];
    let currentGroups = [];

    try {
      if (!isWindowClosing) {
        currentTabs = await chrome.tabs.query({ windowId: closedWindowId });
        currentGroups = await chrome.tabGroups.query({ windowId: closedWindowId });
      }
    } catch (error) {
      console.log("Window already closed, using empty current tabs list");
    }

    // 최근 자동 저장된 세션에서 해당 창의 정보 가져오기
    const result = await chrome.storage.local.get(['autoSavedSessions']);
    const autoSavedSessions = result.autoSavedSessions || [];

    let closedTabs = [];
    let closedGroups = [];
    let sessionName = "";

    if (isWindowClosing) {
      // 창 전체가 닫힌 경우
      if (autoSavedSessions.length > 0) {
        const lastSession = autoSavedSessions[0];
        closedTabs = lastSession.tabs.filter(tab => tab.sourceWindowId === closedWindowId);
        closedGroups = lastSession.groups.filter(group => group.sourceWindowId === closedWindowId);
      }
      sessionName = `Closed window ${new Date(now).toLocaleString()}`;
    } else {
             // 개별 탭이 닫힌 경우 - 최근 세션에서 닫힌 탭 찾기
       if (autoSavedSessions.length > 0) {
         const lastSession = autoSavedSessions[0];

         console.log("Looking for closed tab ID:", closedTabId);
         console.log("Available tabs in last session:", lastSession.tabs.map(tab => `${tab.id}: ${tab.title}`));

         // 닫힌 탭 ID로 직접 검색
         const closedTab = lastSession.tabs.find(tab =>
           tab.id === closedTabId && tab.sourceWindowId === closedWindowId
         );

         if (closedTab) {
           console.log("Found closed tab:", closedTab);
           closedTabs = [closedTab];

           // 닫힌 탭이 속한 그룹이 있다면 그 그룹 정보도 포함
           if (closedTab.groupId && closedTab.groupId !== -1) {
             const relatedGroup = lastSession.groups.find(group =>
               group.id === closedTab.groupId && group.sourceWindowId === closedWindowId
             );
             if (relatedGroup) {
               closedGroups = [relatedGroup];
               console.log("Found related group:", relatedGroup);
             }
           }

           sessionName = `Closed tab: ${closedTab.title || 'Untitled'}`;
         } else {
           console.log("Could not find tab with ID", closedTabId, "in last session");
         }
       }

             // 자동 저장된 세션에서 찾지 못한 경우, 캐시된 탭 정보 사용
       if (closedTabs.length === 0) {
         const cachedTab = tabCache.get(closedTabId);
         console.log("Looking for tab in cache. Cache size:", tabCache.size);
         console.log("Available cached tab IDs:", Array.from(tabCache.keys()));

         if (cachedTab) {
           console.log("Using cached tab info:", cachedTab);
           closedTabs = [{
             id: cachedTab.id,
             url: cachedTab.url,
             title: cachedTab.title,
             index: cachedTab.index,
             active: cachedTab.active,
             pinned: cachedTab.pinned,
             groupId: cachedTab.groupId,
             sourceWindowId: cachedTab.windowId,
             favicon: cachedTab.favicon
           }];
           sessionName = `Closed tab: ${cachedTab.title || 'Untitled'}`;

           // 그룹 정보도 캐시에서 확인
           if (cachedTab.groupId && cachedTab.groupId !== -1) {
             const cachedGroup = groupCache.get(cachedTab.groupId);
             if (cachedGroup) {
               console.log("Found cached group info:", cachedGroup);
               closedGroups = [{
                 id: cachedGroup.id,
                 title: cachedGroup.title,
                 color: cachedGroup.color,
                 collapsed: cachedGroup.collapsed,
                 sourceWindowId: cachedGroup.windowId
               }];
             }
           }
         } else {
           // 캐시에도 없는 경우 기본 정보 생성
           const timestamp = new Date(now).toLocaleTimeString([], {
             hour: '2-digit',
             minute: '2-digit'
           });
           closedTabs = [{
             id: closedTabId,
             url: 'chrome://newtab/',
             title: `Closed tab (${timestamp})`,
             index: 0,
             active: false,
             pinned: false,
             groupId: -1,
             sourceWindowId: closedWindowId,
             favicon: null
           }];
           sessionName = `Closed tab: ${timestamp}`;
         }

         // 사용된 캐시 삭제
         tabCache.delete(closedTabId);
       }
    }

    if (closedTabs.length === 0) {
      return;
    }

        // 새 탭과 불필요한 탭들 필터링
    closedTabs = closedTabs.filter(tab => {
      if (shouldFilterTab(tab)) {
        console.log("Filtering out tab:", tab.title, tab.url);
        return false;
      }
      return true;
    });

    // 필터링 후 저장할 탭이 없으면 리턴
    if (closedTabs.length === 0) {
      console.log("No valid tabs to save after filtering");
      return;
    }

    // 닫힌 세션 데이터 생성
    const closedSessionData = {
      id: `closed_${now}`,
      name: sessionName,
      createdAt: now,
      isClosedSession: true,
      tabs: closedTabs,
      groups: closedGroups,
      tabCount: closedTabs.length,
      groupCount: closedGroups.length,
      windowCount: isWindowClosing ? 1 : 0
    };

    // 닫힌 세션 목록 관리
    const closedResult = await chrome.storage.local.get(['closedSessions']);
    let closedSessions = closedResult.closedSessions || [];

    // 최신 닫힌 세션 추가
    closedSessions.unshift(closedSessionData);

    // 최대 20개 닫힌 세션 유지
    if (closedSessions.length > 20) {
      closedSessions = closedSessions.slice(0, 20);
    }

    await chrome.storage.local.set({ closedSessions });

    console.log("Saved closed session:", closedSessionData.id, "isWindowClosing:", isWindowClosing, "tabs:", closedTabs.length);
    console.log("Closed session data:", JSON.stringify(closedSessionData, null, 2));

  } catch (error) {
    console.error("Error saving closed session:", error);
  }
}

// ============== Session Management Functions ==============

// 세션 저장 함수
async function saveCurrentSession(sessionName) {
  try {
    console.log("Saving current session:", sessionName);

    // 현재 창의 모든 탭 가져오기
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // 현재 창의 모든 그룹 가져오기
    const groups = await chrome.tabGroups.query({ windowId: tabs[0].windowId });

    // 그룹 정보 매핑
    const groupsMap = new Map();
    for (const group of groups) {
      groupsMap.set(group.id, {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed
      });
    }

    // 탭 정보 수집
    const tabsData = tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      index: tab.index,
      active: tab.active,
      pinned: tab.pinned,
      groupId: tab.groupId !== -1 ? tab.groupId : null,
      favicon: tab.favIconUrl || null
    }));

    // 세션 데이터 생성
    const sessionData = {
      id: `session_${Date.now()}`,
      name: sessionName,
      createdAt: Date.now(),
      tabs: tabsData,
      groups: Array.from(groupsMap.values()),
      tabCount: tabs.length,
      groupCount: groups.length
    };

    // 기존 세션 목록 가져오기
    const result = await chrome.storage.local.get(['savedSessions']);
    const savedSessions = result.savedSessions || [];

    // 새 세션 추가
    savedSessions.push(sessionData);

    // 저장 (최대 20개 세션 유지)
    if (savedSessions.length > 20) {
      savedSessions.shift();
    }

    await chrome.storage.local.set({ savedSessions });

    console.log("Session saved successfully:", sessionData.id);
    return { success: true, sessionId: sessionData.id };

  } catch (error) {
    console.error("Error saving session:", error);
    return { success: false, error: error.message };
  }
}

// 세션 복원 함수
async function restoreSession(sessionId, openInNewWindow = true) {
  try {
    console.log("Restoring session:", sessionId);

    // 세션 데이터 가져오기 (수동 저장, 자동 저장, 닫힌 세션 모두 확인)
    const [manualResult, autoResult, closedResult] = await Promise.all([
      chrome.storage.local.get(['savedSessions']),
      chrome.storage.local.get(['autoSavedSessions']),
      chrome.storage.local.get(['closedSessions'])
    ]);

    let sessionData = null;

    // 수동 저장된 세션에서 찾기
    const savedSessions = manualResult.savedSessions || [];
    sessionData = savedSessions.find(session => session.id === sessionId);

    // 자동 저장된 세션에서 찾기
    if (!sessionData) {
      const autoSavedSessions = autoResult.autoSavedSessions || [];
      sessionData = autoSavedSessions.find(session => session.id === sessionId);
    }

    // 닫힌 세션에서 찾기
    if (!sessionData) {
      const closedSessions = closedResult.closedSessions || [];
      sessionData = closedSessions.find(session => session.id === sessionId);
    }

    if (!sessionData) {
      throw new Error("Session not found");
    }

    console.log("Found session data:", sessionData);

    // 새 창 생성 또는 현재 창 사용
    let windowId;
    if (openInNewWindow) {
      const newWindow = await chrome.windows.create({
        focused: true,
        state: "normal"
      });
      windowId = newWindow.id;

      // 창이 제대로 생성되었는지 확인
      const windowInfo = await chrome.windows.get(windowId);
      if (!windowInfo) {
        throw new Error("Failed to create new window");
      }

      console.log("Created new window:", windowId);
    } else {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab) {
        throw new Error("No active tab found");
      }
      windowId = currentTab.windowId;
    }

    // 탭 생성 (그룹 생성 전에 먼저 탭을 생성)
    const createdTabs = [];
    const validTabs = sessionData.tabs.filter(tabInfo => {
      // 접근할 수 없는 URL 필터링
      if (tabInfo.url.startsWith('chrome://') ||
          tabInfo.url.startsWith('chrome-extension://') ||
          tabInfo.url.startsWith('edge://') ||
          tabInfo.url.startsWith('about:')) {
        console.log("Skipping restricted URL:", tabInfo.url);
        return false;
      }
      return true;
    });

    console.log(`Creating ${validTabs.length} tabs from ${sessionData.tabs.length} total tabs`);

    for (const tabInfo of validTabs) {
      try {
        const newTab = await chrome.tabs.create({
          windowId,
          url: tabInfo.url,
          pinned: tabInfo.pinned,
          active: false
        });

        createdTabs.push({
          tab: newTab,
          originalGroupId: tabInfo.groupId,
          originalIndex: tabInfo.index,
          wasActive: tabInfo.active
        });

        // 탭 생성 간격 조정
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error("Error creating tab:", tabInfo.url, error);
      }
    }

    console.log(`Successfully created ${createdTabs.length} tabs`);

    // 그룹 생성 및 탭 할당
    const groupIdMap = new Map();

    for (const groupInfo of sessionData.groups) {
      try {
        // 이 그룹에 속하는 탭들 찾기
        const tabsForGroup = createdTabs.filter(item => item.originalGroupId === groupInfo.id);

        if (tabsForGroup.length === 0) {
          console.log("No tabs for group:", groupInfo.title);
          continue;
        }

        const tabIds = tabsForGroup.map(item => item.tab.id);

        // 그룹 생성 시 탭 ID 배열을 함께 전달
        const newGroupId = await chrome.tabs.group({
          tabIds: tabIds,
          createProperties: { windowId }
        });

        // 그룹 속성 설정
        await chrome.tabGroups.update(newGroupId, {
          title: groupInfo.title,
          color: groupInfo.color,
          collapsed: groupInfo.collapsed
        });

        groupIdMap.set(groupInfo.id, newGroupId);
        console.log(`Created group: ${groupInfo.title} with ${tabIds.length} tabs`);

      } catch (error) {
        console.error("Error creating group:", groupInfo.title, error);
      }
    }

    // 활성 탭 설정
    const activeTabItem = createdTabs.find(item => item.wasActive);
    if (activeTabItem) {
      try {
        await chrome.tabs.update(activeTabItem.tab.id, { active: true });
        console.log("Set active tab:", activeTabItem.tab.id);
      } catch (error) {
        console.error("Error setting active tab:", error);
      }
    }

    // 새 창에서 생성된 경우, 기본 빈 탭 제거
    if (openInNewWindow) {
      try {
        const allTabs = await chrome.tabs.query({ windowId });
        const blankTabs = allTabs.filter(tab =>
          tab.url === 'chrome://newtab/' ||
          tab.url === 'about:blank' ||
          tab.url === ''
        );

        // 생성된 탭이 있고, 빈 탭이 있으면 제거
        if (createdTabs.length > 0 && blankTabs.length > 0) {
          for (const blankTab of blankTabs) {
            // 생성된 탭이 아닌 빈 탭만 제거
            if (!createdTabs.some(item => item.tab.id === blankTab.id)) {
              await chrome.tabs.remove(blankTab.id);
            }
          }
        }
      } catch (error) {
        console.error("Error removing blank tabs:", error);
      }
    }

    console.log("Session restored successfully");
    return { success: true, tabCount: createdTabs.length };

  } catch (error) {
    console.error("Error restoring session:", error);
    return { success: false, error: error.message };
  }
}

// 개별 그룹 복원 함수
async function restoreGroup(sessionId, groupId, openInNewWindow = true) {
  try {
    console.log("Restoring group:", groupId, "from session:", sessionId);

    // 세션 데이터 가져오기
    const [manualResult, autoResult, closedResult] = await Promise.all([
      chrome.storage.local.get(['savedSessions']),
      chrome.storage.local.get(['autoSavedSessions']),
      chrome.storage.local.get(['closedSessions'])
    ]);

    let sessionData = null;
    let sessionSource = null;

    // 모든 세션 타입에서 찾기 (더 자세한 검색)
    const savedSessions = manualResult.savedSessions || [];
    const autoSavedSessions = autoResult.autoSavedSessions || [];
    const closedSessions = closedResult.closedSessions || [];

    sessionData = savedSessions.find(session => session.id === sessionId);
    if (sessionData) sessionSource = 'manual';

    if (!sessionData) {
      sessionData = autoSavedSessions.find(session => session.id === sessionId);
      if (sessionData) sessionSource = 'auto';
    }

    if (!sessionData) {
      sessionData = closedSessions.find(session => session.id === sessionId);
      if (sessionData) sessionSource = 'closed';
    }

    if (!sessionData) {
      throw new Error("Session not found");
    }

    console.log(`Found session from ${sessionSource} storage:`, sessionData.name);
    console.log(`Session groups:`, sessionData.groups.map(g => `${g.id}: ${g.title}`));
    console.log(`Looking for group ID: ${groupId} (type: ${typeof groupId})`);

    // 그룹 ID 타입 안전 비교를 위한 함수
    const groupIdMatches = (group, targetId) => {
      return group.id === targetId ||
             group.id == targetId ||
             String(group.id) === String(targetId) ||
             Number(group.id) === Number(targetId);
    };

    // 해당 그룹 정보 찾기 (타입 안전 비교)
    const groupInfo = sessionData.groups.find(group => groupIdMatches(group, groupId));

    if (!groupInfo) {
      console.error(`Group ${groupId} not found in session. Available groups:`,
                    sessionData.groups.map(g => `${g.id}: ${g.title} (type: ${typeof g.id})`));

      // 그룹이 없는 경우 해당 그룹 ID를 가진 탭들을 찾아서 대체 그룹 생성 (타입 안전 비교)
      const groupTabs = sessionData.tabs.filter(tab =>
        tab.groupId === groupId ||
        tab.groupId == groupId ||
        String(tab.groupId) === String(groupId) ||
        Number(tab.groupId) === Number(groupId)
      );

      if (groupTabs.length === 0) {
        throw new Error(`No tabs found for group ${groupId}. The group may have been removed.`);
      }

      // 대체 그룹 정보 생성
      const fallbackGroupInfo = {
        id: groupId,
        title: `Restored Group (${groupTabs.length} tabs)`,
        color: 'blue',
        collapsed: false
      };

      console.log(`Creating fallback group info:`, fallbackGroupInfo);
      return await restoreGroupWithInfo(sessionId, fallbackGroupInfo, groupTabs, openInNewWindow);
    }

    console.log(`Found group: ${groupInfo.title} (ID: ${groupInfo.id})`);

    // 해당 그룹의 탭들 찾기 (타입 안전 비교)
    const groupTabs = sessionData.tabs.filter(tab => {
      return tab.groupId === groupId ||
             tab.groupId == groupId ||
             String(tab.groupId) === String(groupId) ||
             Number(tab.groupId) === Number(groupId);
    });

    console.log(`Filtering tabs for group ${groupId}:`);
    console.log(`Available tabs:`, sessionData.tabs.map(t => `${t.title} (groupId: ${t.groupId}, type: ${typeof t.groupId})`));
    console.log(`Matched tabs:`, groupTabs.map(t => `${t.title} (groupId: ${t.groupId})`));

    if (groupTabs.length === 0) {
      throw new Error(`No tabs found in group "${groupInfo.title}"`);
    }

    console.log(`Found ${groupTabs.length} tabs in group: ${groupInfo.title}`);

    return await restoreGroupWithInfo(sessionId, groupInfo, groupTabs, openInNewWindow);

  } catch (error) {
    console.error("Error restoring group:", error);
    return { success: false, error: error.message };
  }
}

// 그룹 정보와 탭 정보를 받아서 실제 복원을 수행하는 헬퍼 함수
async function restoreGroupWithInfo(sessionId, groupInfo, groupTabs, openInNewWindow = true) {
  try {
    console.log(`Starting group restore: ${groupInfo.title} with ${groupTabs.length} tabs`);

    // 새 창 생성 또는 현재 창 사용
    let windowId;
    if (openInNewWindow) {
      console.log("Creating new window for group restoration...");
      const newWindow = await chrome.windows.create({
        focused: true,
        state: "normal"
      });
      windowId = newWindow.id;
      console.log(`New window created with ID: ${windowId}`);

      // 생성 확인
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        await chrome.windows.get(windowId);
        console.log(`Window ${windowId} confirmed to exist`);
      } catch (e) {
        throw new Error(`Failed to create window: ${e.message}`);
      }
    } else {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab) {
        throw new Error("No active tab found");
      }
      windowId = currentTab.windowId;
      console.log(`Using current window ID: ${windowId}`);
    }

    // 탭 생성
    const createdTabs = [];
    const validTabs = groupTabs.filter(tabInfo => {
      // 접근할 수 없는 URL 필터링
      if (tabInfo.url.startsWith('chrome://') ||
          tabInfo.url.startsWith('chrome-extension://') ||
          tabInfo.url.startsWith('edge://') ||
          tabInfo.url.startsWith('about:')) {
        console.log("Skipping restricted URL:", tabInfo.url);
        return false;
      }
      return true;
    });

    console.log(`Creating ${validTabs.length} valid tabs out of ${groupTabs.length} total tabs`);

    for (const tabInfo of validTabs) {
      try {
        console.log(`Creating tab: ${tabInfo.title} (${tabInfo.url}) in window ${windowId}`);

        // Window가 여전히 존재하는지 확인
        try {
          await chrome.windows.get(windowId);
        } catch (e) {
          throw new Error(`Window ${windowId} no longer exists`);
        }

        const newTab = await chrome.tabs.create({
          windowId: windowId,
          url: tabInfo.url,
          pinned: tabInfo.pinned || false,
          active: false
        });

        createdTabs.push(newTab);
        console.log(`Tab created successfully: ${newTab.id}`);

        // 탭 생성 간격 조정
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error creating tab: ${tabInfo.url}`, error);
        console.error(`Error details:`, error.message);
      }
    }

    if (createdTabs.length === 0) {
      throw new Error("No tabs could be created");
    }

    console.log(`Successfully created ${createdTabs.length} tabs`);

    // 빈 탭 제거 (새 창인 경우에만)
    if (openInNewWindow) {
      try {
        const blankTabs = await chrome.tabs.query({
          windowId: windowId,
          url: ["chrome://newtab/", "about:blank", ""]
        });

        // 생성된 탭이 아닌 빈 탭만 제거
        const blankTabsToRemove = blankTabs.filter(tab =>
          !createdTabs.some(created => created.id === tab.id)
        );

        if (blankTabsToRemove.length > 0) {
          console.log(`Removing ${blankTabsToRemove.length} blank tabs`);
          await chrome.tabs.remove(blankTabsToRemove.map(tab => tab.id));
        }
      } catch (error) {
        console.error("Error removing blank tabs:", error);
      }
    }

    // 그룹 생성 및 탭 할당
    const tabIds = createdTabs.map(tab => tab.id);
    console.log(`Creating group with tab IDs:`, tabIds);

    const newGroupId = await chrome.tabs.group({
      tabIds: tabIds,
      createProperties: { windowId: windowId }
    });

    console.log(`Group created with ID: ${newGroupId}`);

    // 그룹 속성 설정
    await chrome.tabGroups.update(newGroupId, {
      title: groupInfo.title || 'Restored Group',
      color: groupInfo.color || 'blue',
      collapsed: groupInfo.collapsed || false
    });

    console.log(`Group properties set: ${groupInfo.title} (${groupInfo.color})`);

    // 첫 번째 탭 활성화
    if (createdTabs.length > 0) {
      await chrome.tabs.update(createdTabs[0].id, { active: true });
      console.log(`Activated first tab: ${createdTabs[0].id}`);
    }

    console.log(`=== Group restored successfully: ${groupInfo.title} (${createdTabs.length} tabs) ===`);
    return { success: true, tabCount: createdTabs.length, groupTitle: groupInfo.title };

  } catch (error) {
    console.error("Error in restoreGroupWithInfo:", error);
    return { success: false, error: error.message };
  }
}

// 세션 목록 가져오기
async function getSavedSessions() {
  try {
    const result = await chrome.storage.local.get(['savedSessions']);
    const savedSessions = result.savedSessions || [];

    // 최신순 정렬
    return savedSessions.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("Error getting saved sessions:", error);
    return [];
  }
}

// 세션 삭제
async function deleteSession(sessionId) {
  try {
    const result = await chrome.storage.local.get(['savedSessions']);
    const savedSessions = result.savedSessions || [];

    const filteredSessions = savedSessions.filter(session => session.id !== sessionId);

    await chrome.storage.local.set({ savedSessions: filteredSessions });

    console.log("Session deleted:", sessionId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting session:", error);
    return { success: false, error: error.message };
  }
}

// 세션 이름 변경
async function renameSession(sessionId, newName) {
  try {
    const result = await chrome.storage.local.get(['savedSessions']);
    const savedSessions = result.savedSessions || [];

    const sessionIndex = savedSessions.findIndex(session => session.id === sessionId);
    if (sessionIndex === -1) {
      throw new Error("Session not found");
    }

    savedSessions[sessionIndex].name = newName;

    await chrome.storage.local.set({ savedSessions });

    console.log("Session renamed:", sessionId, "->", newName);
    return { success: true };
  } catch (error) {
    console.error("Error renaming session:", error);
    return { success: false, error: error.message };
  }
}

// 메시지 리스너에 세션 관리 기능 추가
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleAutoSave") {
    autoSaveSettings.enabled = request.enabled;
    chrome.storage.sync.set({ autoSaveEnabled: request.enabled });

    if (request.enabled) {
      startAutoSave();
    } else {
      stopAutoSave();
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "toggleNewTabOverride") {
    chrome.storage.sync.set({ newTabOverride: request.enabled });
    sendResponse({ success: true });
    return true;
  }

    if (request.action === "openChromeNewTab") {
    // Google 홈페이지로 리다이렉트 (안정적이고 간단함)
    chrome.tabs.update(sender.tab.id, { url: 'https://www.google.com' })
      .then(() => {
        console.log('Successfully redirected to Google homepage');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Error redirecting to Google:', error);
        // 최종 fallback
        chrome.tabs.update(sender.tab.id, { url: 'about:blank' })
          .then(() => sendResponse({ success: true }))
          .catch(() => sendResponse({ success: false }));
      });
    return true;
  }

  if (request.action === "updateAutoSaveSettings") {
    autoSaveSettings.trigger = request.trigger;

    if (request.trigger === "time") {
      autoSaveSettings.interval = request.interval;
      stopAutoSave();
      if (autoSaveSettings.enabled) {
        startTimeBasedAutoSave();
      }
    } else if (request.trigger === "change") {
      autoSaveSettings.detectTabClose = request.detectTabClose;
      autoSaveSettings.detectTabCreate = request.detectTabCreate;
      autoSaveSettings.detectUrlChange = request.detectUrlChange;
      stopAutoSave();
      // Change-based saving은 이벤트 리스너에서 자동으로 처리됨
    }

    sendResponse({ success: true });
    return true;
  }

  if (request.action === "saveSession") {
    saveCurrentSession(request.sessionName)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "restoreSession") {
    restoreSession(request.sessionId, request.openInNewWindow)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "restoreGroup") {
    const openInNewWindow = request.openInNewWindow !== false; // 기본값 true
    restoreGroup(request.sessionId, request.groupId, openInNewWindow)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "getSavedSessions") {
    getSavedSessions()
      .then(sessions => sendResponse({ success: true, sessions }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "deleteSession") {
    deleteSessionById(request.sessionId, request.type)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "clearAllSessions") {
    clearAllSessions(request.type)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "renameSession") {
    renameSession(request.sessionId, request.newName)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "getCachedTheme") {
    // 캐시된 테마가 너무 오래되었으면 다시 가져오기
    if (!cachedTheme || (Date.now() - cachedTheme.timestamp > 5000)) {
      cacheCurrentTheme().then(() => {
        sendResponse({ success: true, theme: cachedTheme });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
    } else {
      sendResponse({ success: true, theme: cachedTheme });
    }
    return true;
  }
});

// 개별 세션 삭제 함수
async function deleteSessionById(sessionId, type) {
  try {
    const storageKey = type === 'closed' ? 'closedSessions' : 'autoSavedSessions';
    const result = await chrome.storage.local.get([storageKey]);
    let sessions = result[storageKey] || [];

    // 해당 세션 찾기
    const sessionIndex = sessions.findIndex(session => session.id === sessionId);

    if (sessionIndex === -1) {
      return { success: false, error: 'Session not found' };
    }

    // 세션 삭제
    sessions.splice(sessionIndex, 1);

    // 스토리지 업데이트
    await chrome.storage.local.set({ [storageKey]: sessions });

    console.log(`Deleted session: ${sessionId} from ${type} sessions`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting session:', error);
    return { success: false, error: error.message };
  }
}

// 모든 세션 삭제 함수
async function clearAllSessions(type) {
  try {
    const storageKey = type === 'closed' ? 'closedSessions' : 'autoSavedSessions';

    // 빈 배열로 설정
    await chrome.storage.local.set({ [storageKey]: [] });

    console.log(`Cleared all ${type} sessions`);
    return { success: true };
  } catch (error) {
    console.error('Error clearing sessions:', error);
    return { success: false, error: error.message };
  }
}

// ============== Extension Initialization ==============

// 확장 프로그램 시작 시 설정 로드
async function loadAutoSaveSettings(retryCount = 0) {
  const maxRetries = 3;

  try {
    // Chrome runtime이 준비되었는지 확인
    if (!chrome.storage || !chrome.storage.sync) {
      throw new Error("Chrome storage not available");
    }

    const settings = await chrome.storage.sync.get([
      'autoSaveEnabled',
      'autoSaveTrigger',
      'autoSaveInterval',
      'detectTabClose',
      'detectTabCreate',
      'detectUrlChange'
    ]);

    autoSaveSettings.enabled = settings.autoSaveEnabled ?? true;
    autoSaveSettings.trigger = settings.autoSaveTrigger ?? "time";
    autoSaveSettings.interval = settings.autoSaveInterval ?? 60;
    autoSaveSettings.detectTabClose = settings.detectTabClose ?? true;
    autoSaveSettings.detectTabCreate = settings.detectTabCreate ?? true;
    autoSaveSettings.detectUrlChange = settings.detectUrlChange ?? true;

    console.log("Auto save settings loaded:", autoSaveSettings);

    // 설정에 따라 자동 저장 시작
    startAutoSave();
  } catch (error) {
    console.error("Error loading auto save settings:", error);

    // 재시도 로직
    if (retryCount < maxRetries) {
      console.log(`Retrying to load auto save settings (${retryCount + 1}/${maxRetries})`);
      setTimeout(() => {
        loadAutoSaveSettings(retryCount + 1);
      }, 1000 * (retryCount + 1)); // 1초, 2초, 3초 후 재시도
    } else {
      console.error("Failed to load auto save settings after all retries, using defaults");
      // 기본값으로 설정
      autoSaveSettings.enabled = true;
      autoSaveSettings.trigger = "time";
      autoSaveSettings.interval = 60;
      autoSaveSettings.detectTabClose = true;
      autoSaveSettings.detectTabCreate = true;
      autoSaveSettings.detectUrlChange = true;
      startAutoSave();
    }
  }
}

// 확장 프로그램 설치/시작 시 설정 로드
chrome.runtime.onStartup.addListener(() => {
  loadAutoSaveSettings();
});

chrome.runtime.onInstalled.addListener(() => {
  loadAutoSaveSettings();
});

// 지연된 설정 로드 (서비스 워커 재시작 시)
setTimeout(() => {
  loadAutoSaveSettings();
}, 100); // 100ms 지연
