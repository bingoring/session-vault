// 전역 변수로 오버라이드 상태 추적
let isOverrideEnabled = true;

// 페이지 로드 즉시 설정 확인 (DOM 로드 전)
(async () => {
  try {
    // 이미 리다이렉트 중인지 확인 (무한반복 방지)
    const redirecting = sessionStorage.getItem('sessionvault_redirecting');
    if (redirecting === 'true') {
      console.log('Already redirecting, showing blank page');
      document.body.style.visibility = 'visible';
      document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif; color: #666;">Loading...</div>';
      return;
    }

    const settings = await chrome.storage.sync.get(['newTabOverride']);
    if (settings.newTabOverride === false) {
      isOverrideEnabled = false;
      // 리다이렉트 플래그 설정
      sessionStorage.setItem('sessionvault_redirecting', 'true');
      // 새 탭 오버라이드가 비활성화된 경우 즉시 리다이렉트
      chrome.runtime.sendMessage({ action: 'openChromeNewTab' });
      return;
    }

    // 설정이 활성화된 경우 테마를 먼저 적용한 후 페이지 표시
    await applyThemeImmediately();
    document.body.style.visibility = 'visible';
  } catch (error) {
    console.error('Error checking newTab override setting:', error);
    // 오류 시 페이지 표시
    document.body.style.visibility = 'visible';
  }
})();

// 즉시 테마 적용 함수 (깜빡임 방지용)
async function applyThemeImmediately() {
  try {
    // 먼저 캐시된 테마 정보를 요청
    try {
      const response = await chrome.runtime.sendMessage({ action: "getCachedTheme" });
      if (response.success && response.theme) {
        console.log('Using cached theme:', response.theme);
        applyThemeFromCache(response.theme);
        return;
      }
    } catch (error) {
      console.log('Failed to get cached theme, falling back to direct API call:', error);
    }

    // 캐시된 테마가 없으면 직접 chrome.theme API 사용
    if (!chrome.theme || !chrome.theme.getCurrent) {
      console.log('Chrome theme API not available, using system theme');
      applySystemTheme();
      return;
    }

        const theme = await chrome.theme.getCurrent();
    const colors = theme.colors || {};

    // 간단한 다크모드 감지
    const bgColor = colors.ntp_background || colors.frame;
    let isDarkTheme = false;
    if (bgColor) {
      // RGB 값 추출하여 밝기 판단
      const rgb = bgColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
        isDarkTheme = brightness < 128;
      }
    } else {
      // 테마 색상이 없으면 시스템 설정 확인
      isDarkTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // 기본 배경과 텍스트 색상만 빠르게 적용
    const root = document.documentElement;

    const backgroundColor = colors.ntp_background ||
                          colors.frame ||
                          (isDarkTheme ? '#202124' : '#ffffff');

    const textColor = colors.ntp_text ||
                    colors.tab_text ||
                    colors.bookmark_text ||
                    (isDarkTheme ? '#e8eaed' : '#333333');

            // 초기 다크 배경을 덮어쓰기 위해 직접 스타일 적용
    document.body.style.setProperty('background', backgroundColor, 'important');
    document.body.style.setProperty('color', textColor, 'important');

    // 검색창 관련 기본 변수 설정
    const cardBg = isDarkTheme ? '#3c4043' : 'rgba(255, 255, 255, 0.95)';
    const secondaryText = isDarkTheme ? 'rgba(232, 234, 237, 0.7)' : 'rgba(60, 64, 67, 0.7)';
    const iconBg = isDarkTheme ? '#2d2d30' : '#f0f0f0';

    // 검색창 스타일도 즉시 적용 (깜빡임 방지)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.style.setProperty('background', cardBg, 'important');
      searchInput.style.setProperty('color', textColor, 'important');
      searchInput.style.setProperty('box-shadow', `0 4px 16px ${isDarkTheme ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)'}`, 'important');

      // placeholder 색상 설정을 위한 CSS 규칙 추가
      const style = document.createElement('style');
      style.textContent = `.search-input::placeholder { color: ${secondaryText} !important; }`;
      document.head.appendChild(style);
    }

    root.style.setProperty('--theme-card-background', cardBg);
    root.style.setProperty('--theme-input-bg', cardBg);
    root.style.setProperty('--theme-input-text', textColor);
    root.style.setProperty('--theme-input-placeholder', secondaryText);
    root.style.setProperty('--theme-secondary-text', secondaryText);
    root.style.setProperty('--theme-icon-background', iconBg);

    // 스크롤바 색상 설정
    const scrollThumb = isDarkTheme ? 'rgba(232, 234, 237, 0.2)' : 'rgba(60, 64, 67, 0.2)';
    const scrollThumbHover = isDarkTheme ? 'rgba(232, 234, 237, 0.3)' : 'rgba(60, 64, 67, 0.3)';

    root.style.setProperty('--theme-scrollbar-thumb', scrollThumb);
    root.style.setProperty('--theme-scrollbar-thumb-hover', scrollThumbHover);

    // 다크/라이트 테마 클래스 설정
    document.body.classList.toggle('dark-theme', isDarkTheme);
    document.body.classList.toggle('light-theme', !isDarkTheme);

    // 헤더 아이콘 테마 업데이트
    updateHeaderIcons(isDarkTheme);

  } catch (error) {
    console.error('Error applying immediate theme:', error);
    applySystemTheme();
  }
}

// 캐시된 테마 적용 함수
function applyThemeFromCache(theme) {
  const root = document.documentElement;

  // body 스타일 직접 적용
  document.body.style.setProperty('background', theme.backgroundColor, 'important');
  document.body.style.setProperty('color', theme.textColor, 'important');

  // 검색창 스타일도 즉시 적용 (깜빡임 방지)
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.style.setProperty('background', theme.cardBg, 'important');
    searchInput.style.setProperty('color', theme.textColor, 'important');
    searchInput.style.setProperty('box-shadow', `0 4px 16px ${theme.boxShadow}`, 'important');

    // placeholder 색상 설정을 위한 CSS 규칙 추가
    const style = document.createElement('style');
    style.textContent = `.search-input::placeholder { color: ${theme.secondaryText} !important; }`;
    document.head.appendChild(style);
  }

  // CSS 변수 설정
  root.style.setProperty('--theme-card-background', theme.cardBg);
  root.style.setProperty('--theme-input-bg', theme.cardBg);
  root.style.setProperty('--theme-input-text', theme.textColor);
  root.style.setProperty('--theme-input-placeholder', theme.secondaryText);
  root.style.setProperty('--theme-secondary-text', theme.secondaryText);
  root.style.setProperty('--theme-icon-background', theme.isDarkTheme ? '#2d2d30' : '#f0f0f0');
  root.style.setProperty('--theme-scrollbar-thumb', theme.isDarkTheme ? 'rgba(232, 234, 237, 0.2)' : 'rgba(60, 64, 67, 0.2)');
  root.style.setProperty('--theme-scrollbar-thumb-hover', theme.isDarkTheme ? 'rgba(232, 234, 237, 0.3)' : 'rgba(60, 64, 67, 0.3)');

  // 테마 클래스 설정
  document.body.classList.toggle('dark-theme', theme.isDarkTheme);
  document.body.classList.toggle('light-theme', !theme.isDarkTheme);

  // 헤더 아이콘 테마 업데이트
  updateHeaderIcons(theme.isDarkTheme);
}

// 헤더 아이콘 테마 업데이트 함수
function updateHeaderIcons(isDarkTheme) {
  try {
    const googleAppsDark = document.querySelector('.google-apps-icon-dark');
    const googleAppsLight = document.querySelector('.google-apps-icon-light');
    const flaskDark = document.querySelector('.flask-icon-dark');
    const flaskLight = document.querySelector('.flask-icon-light');

    if (isDarkTheme) {
      // 다크 테마: 흰색 아이콘 표시
      if (googleAppsDark) googleAppsDark.style.display = 'block';
      if (googleAppsLight) googleAppsLight.style.display = 'none';
      if (flaskDark) flaskDark.style.display = 'block';
      if (flaskLight) flaskLight.style.display = 'none';
    } else {
      // 라이트 테마: 어두운 아이콘 표시
      if (googleAppsDark) googleAppsDark.style.display = 'none';
      if (googleAppsLight) googleAppsLight.style.display = 'block';
      if (flaskDark) flaskDark.style.display = 'none';
      if (flaskLight) flaskLight.style.display = 'block';
    }
  } catch (error) {
    console.error('Error updating header icons:', error);
  }
}

// 시스템 테마 적용 (fallback)
function applySystemTheme() {
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const root = document.documentElement;

  if (isDark) {
    document.body.style.setProperty('background', 'linear-gradient(135deg, #1a1a1a 0%, #2d2d30 100%)', 'important');
    document.body.style.setProperty('color', '#e8eaed', 'important');

    // 검색창 스타일 직접 적용
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.style.setProperty('background', '#3c4043', 'important');
      searchInput.style.setProperty('color', '#e8eaed', 'important');
      searchInput.style.setProperty('box-shadow', '0 4px 16px rgba(0, 0, 0, 0.3)', 'important');

      // placeholder 색상 설정
      const style = document.createElement('style');
      style.textContent = `.search-input::placeholder { color: rgba(232, 234, 237, 0.7) !important; }`;
      document.head.appendChild(style);
    }

    // 다크 테마 검색창 변수 설정
    root.style.setProperty('--theme-card-background', '#3c4043');
    root.style.setProperty('--theme-input-bg', '#3c4043');
    root.style.setProperty('--theme-input-text', '#e8eaed');
    root.style.setProperty('--theme-input-placeholder', 'rgba(232, 234, 237, 0.7)');
    root.style.setProperty('--theme-secondary-text', 'rgba(232, 234, 237, 0.7)');
    root.style.setProperty('--theme-icon-background', '#2d2d30');
    root.style.setProperty('--theme-scrollbar-thumb', 'rgba(232, 234, 237, 0.2)');
    root.style.setProperty('--theme-scrollbar-thumb-hover', 'rgba(232, 234, 237, 0.3)');

        document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
    updateHeaderIcons(true);
  } else {
            document.body.style.setProperty('background', 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)', 'important');
      document.body.style.setProperty('color', '#202124', 'important');

    // 검색창 스타일 직접 적용
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.style.setProperty('background', 'rgba(255, 255, 255, 0.95)', 'important');
      searchInput.style.setProperty('color', '#333333', 'important');
      searchInput.style.setProperty('box-shadow', '0 4px 16px rgba(0, 0, 0, 0.1)', 'important');

      // placeholder 색상 설정
      const style = document.createElement('style');
      style.textContent = `.search-input::placeholder { color: rgba(60, 64, 67, 0.7) !important; }`;
      document.head.appendChild(style);
    }

    // 라이트 테마 검색창 변수 설정
    root.style.setProperty('--theme-card-background', 'rgba(255, 255, 255, 0.95)');
    root.style.setProperty('--theme-input-bg', 'rgba(255, 255, 255, 0.95)');
    root.style.setProperty('--theme-input-text', '#333333');
    root.style.setProperty('--theme-input-placeholder', 'rgba(60, 64, 67, 0.7)');
    root.style.setProperty('--theme-secondary-text', 'rgba(60, 64, 67, 0.7)');
    root.style.setProperty('--theme-icon-background', '#f0f0f0');
    root.style.setProperty('--theme-scrollbar-thumb', 'rgba(60, 64, 67, 0.2)');
    root.style.setProperty('--theme-scrollbar-thumb-hover', 'rgba(60, 64, 67, 0.3)');

    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
    updateHeaderIcons(false);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 오버라이드가 비활성화된 경우 모든 초기화 건너뛰기
  if (!isOverrideEnabled) {
    return;
  }

  const closedSessionsContainer = document.getElementById('closedSessions');
  const autoSavedSessionsContainer = document.getElementById('autoSavedSessions');

  // Chrome 테마 적용
  await applyTheme();

  // Google 헤더 메뉴 초기화
  initializeGoogleHeader();

  // 검색 기능 초기화
  initializeSearch();

  // 바로가기 사이트 로드
  await loadTopSites();

  // 페이지네이션 변수들
  const ITEMS_PER_PAGE = 30;
  const MAX_ITEMS = 10000;

  let closedSessionsState = {
      currentPage: 0,
      totalLoaded: 0,
      isLoading: false,
      hasMore: true
  };

  let autoSavedSessionsState = {
      currentPage: 0,
      totalLoaded: 0,
      isLoading: false,
      hasMore: true
  };

  // 일괄 제거 버튼 이벤트 리스너 추가
  document.querySelectorAll('.clear-all-btn').forEach(btn => {
      btn.addEventListener('click', handleClearAll);
  });

  // 스크롤 이벤트 리스너 추가
  addScrollListeners();

  // 초기 로드
  await loadAllSessions();

  // 스크롤 이벤트 리스너 추가
  function addScrollListeners() {
      const closedSessionsContainer = document.getElementById('closedSessions');
      const autoSavedSessionsContainer = document.getElementById('autoSavedSessions');

      // Recently Closed Sessions 스크롤 리스너
      closedSessionsContainer.addEventListener('scroll', () => {
          if (isNearBottom(closedSessionsContainer) && !closedSessionsState.isLoading && closedSessionsState.hasMore) {
              loadMoreClosedSessions();
          }
      });

      // Auto-Saved Sessions 스크롤 리스너
      autoSavedSessionsContainer.addEventListener('scroll', () => {
          if (isNearBottom(autoSavedSessionsContainer) && !autoSavedSessionsState.isLoading && autoSavedSessionsState.hasMore) {
              loadMoreAutoSavedSessions();
          }
      });
  }

  // 스크롤이 하단 근처인지 확인
  function isNearBottom(element) {
      const threshold = 100; // 하단에서 100px 이내
      return element.scrollTop + element.clientHeight >= element.scrollHeight - threshold;
  }

  async function loadAllSessions() {
      try {
          // 상태 초기화
          closedSessionsState = { currentPage: 0, totalLoaded: 0, isLoading: false, hasMore: true };
          autoSavedSessionsState = { currentPage: 0, totalLoaded: 0, isLoading: false, hasMore: true };

          const [closedSessions, autoSavedSessions] = await Promise.all([
              loadClosedSessions(0, ITEMS_PER_PAGE),
              loadAutoSavedSessions(0, ITEMS_PER_PAGE)
          ]);

          renderSessions(closedSessionsContainer, closedSessions, 'closed', true);
          renderSessions(autoSavedSessionsContainer, autoSavedSessions, 'auto', true);

          // 상태 업데이트
          closedSessionsState.totalLoaded = closedSessions.length;
          closedSessionsState.currentPage = 1;
          closedSessionsState.hasMore = closedSessions.length === ITEMS_PER_PAGE;

          autoSavedSessionsState.totalLoaded = autoSavedSessions.length;
          autoSavedSessionsState.currentPage = 1;
          autoSavedSessionsState.hasMore = autoSavedSessions.length === ITEMS_PER_PAGE;
      } catch (error) {
          console.error('Error loading sessions:', error);
      }
  }

  async function loadClosedSessions(startIndex = 0, limit = ITEMS_PER_PAGE) {
      try {
          const result = await chrome.storage.local.get(['closedSessions']);
          const allSessions = result.closedSessions || [];

          // 페이지네이션 적용
          const endIndex = Math.min(startIndex + limit, allSessions.length, MAX_ITEMS);
          return allSessions.slice(startIndex, endIndex);
      } catch (error) {
          console.error('Error loading closed sessions:', error);
          return [];
      }
  }

  async function loadAutoSavedSessions(startIndex = 0, limit = ITEMS_PER_PAGE) {
      try {
          const result = await chrome.storage.local.get(['autoSavedSessions']);
          const allSessions = result.autoSavedSessions || [];

          // 페이지네이션 적용
          const endIndex = Math.min(startIndex + limit, allSessions.length, MAX_ITEMS);
          return allSessions.slice(startIndex, endIndex);
      } catch (error) {
          console.error('Error loading auto-saved sessions:', error);
          return [];
      }
  }

  // 더 많은 닫힌 세션 로드
  async function loadMoreClosedSessions() {
      if (closedSessionsState.isLoading || !closedSessionsState.hasMore || closedSessionsState.totalLoaded >= MAX_ITEMS) {
          return;
      }

      closedSessionsState.isLoading = true;
      showLoadingIndicator(closedSessionsContainer, 'closed');

      try {
          const startIndex = closedSessionsState.totalLoaded;
          const newSessions = await loadClosedSessions(startIndex, ITEMS_PER_PAGE);

          if (newSessions.length > 0) {
              renderSessions(closedSessionsContainer, newSessions, 'closed', false);
              closedSessionsState.totalLoaded += newSessions.length;
              closedSessionsState.currentPage++;
          }

          // 더 이상 로드할 항목이 있는지 확인
          closedSessionsState.hasMore = newSessions.length === ITEMS_PER_PAGE && closedSessionsState.totalLoaded < MAX_ITEMS;
      } catch (error) {
          console.error('Error loading more closed sessions:', error);
      } finally {
          closedSessionsState.isLoading = false;
          hideLoadingIndicator(closedSessionsContainer);
      }
  }

  // 더 많은 자동 저장 세션 로드
  async function loadMoreAutoSavedSessions() {
      if (autoSavedSessionsState.isLoading || !autoSavedSessionsState.hasMore || autoSavedSessionsState.totalLoaded >= MAX_ITEMS) {
          return;
      }

      autoSavedSessionsState.isLoading = true;
      showLoadingIndicator(autoSavedSessionsContainer, 'auto');

      try {
          const startIndex = autoSavedSessionsState.totalLoaded;
          const newSessions = await loadAutoSavedSessions(startIndex, ITEMS_PER_PAGE);

          if (newSessions.length > 0) {
              renderSessions(autoSavedSessionsContainer, newSessions, 'auto', false);
              autoSavedSessionsState.totalLoaded += newSessions.length;
              autoSavedSessionsState.currentPage++;
          }

          // 더 이상 로드할 항목이 있는지 확인
          autoSavedSessionsState.hasMore = newSessions.length === ITEMS_PER_PAGE && autoSavedSessionsState.totalLoaded < MAX_ITEMS;
      } catch (error) {
          console.error('Error loading more auto-saved sessions:', error);
      } finally {
          autoSavedSessionsState.isLoading = false;
          hideLoadingIndicator(autoSavedSessionsContainer);
      }
  }

  // 로딩 인디케이터 표시
  function showLoadingIndicator(container, type) {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'loading-indicator';
      loadingDiv.innerHTML = `
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading more ${type === 'closed' ? 'closed sessions' : 'auto-saved sessions'}...</div>
      `;
      container.appendChild(loadingDiv);
  }

  // 로딩 인디케이터 숨기기
  function hideLoadingIndicator(container) {
      const loadingIndicator = container.querySelector('.loading-indicator');
      if (loadingIndicator) {
          loadingIndicator.remove();
      }
  }

  function renderSessions(container, sessions, type, isInitial = true) {
      if (sessions.length === 0) {
          if (isInitial) {
              container.innerHTML = `
                  <div class="no-sessions">
                      ${type === 'closed' ? 'No recently closed sessions' : 'No auto-saved sessions'}
                  </div>
              `;
          }
          return;
      }

      // 초기 로드가 아닌 경우 기존 내용에 추가
      if (!isInitial) {
          // 로딩 인디케이터 제거
          hideLoadingIndicator(container);

          // 기존 "no-sessions" 메시지가 있으면 제거
          const noSessionsMsg = container.querySelector('.no-sessions');
          if (noSessionsMsg) {
              noSessionsMsg.remove();
          }
      } else {
          // 초기 로드인 경우 기존 내용 모두 제거
          container.innerHTML = '';
      }

      if (type === 'closed') {
          // 닫힌 세션은 개별 아이템으로 렌더링
          const newItemsHtml = sessions.map(session => createClosedSessionItem(session)).join('');

          if (isInitial) {
              container.innerHTML = newItemsHtml;
          } else {
              container.insertAdjacentHTML('beforeend', newItemsHtml);
          }

          // 새로 추가된 닫힌 세션 아이템에만 이벤트 리스너 추가
          const allItems = container.querySelectorAll('.closed-tab-item');
          const allDeleteBtns = container.querySelectorAll('.delete-closed-btn');

          // 기존 이벤트 리스너가 없는 새 아이템들만 이벤트 리스너 추가
          allItems.forEach(item => {
              if (!item.hasAttribute('data-listener-added')) {
                  item.addEventListener('click', handleClosedTabRestore);
                  item.setAttribute('data-listener-added', 'true');
              }
          });

          allDeleteBtns.forEach(btn => {
              if (!btn.hasAttribute('data-listener-added')) {
                  btn.addEventListener('click', handleClosedItemDelete);
                  btn.setAttribute('data-listener-added', 'true');
              }
          });
      } else {
          // 일반 세션은 기존 방식으로 렌더링
          const newItemsHtml = sessions.map(session => createSessionCard(session, type)).join('');

          if (isInitial) {
              container.innerHTML = newItemsHtml;
          } else {
              container.insertAdjacentHTML('beforeend', newItemsHtml);
          }

          // 새로 추가된 세션 카드들에만 이벤트 리스너 추가
          const allHeaders = container.querySelectorAll('.session-header');
          const allTabItems = container.querySelectorAll('.tab-item');
          const allGroupItems = container.querySelectorAll('.group-item');
          const allRestoreBtns = container.querySelectorAll('.restore-btn');
          const allDeleteBtns = container.querySelectorAll('.delete-session-btn');

          // 기존 이벤트 리스너가 없는 새 요소들만 이벤트 리스너 추가
          allHeaders.forEach(header => {
              if (!header.hasAttribute('data-listener-added')) {
                  header.addEventListener('click', toggleSessionContent);
                  header.setAttribute('data-listener-added', 'true');
              }
          });

          allTabItems.forEach(item => {
              if (!item.hasAttribute('data-listener-added')) {
                  item.addEventListener('click', handleTabRestore);
                  item.setAttribute('data-listener-added', 'true');
              }
          });

          allGroupItems.forEach(item => {
              if (!item.hasAttribute('data-listener-added')) {
                  item.addEventListener('click', handleGroupRestore);
                  item.setAttribute('data-listener-added', 'true');
              }
          });

          allRestoreBtns.forEach(btn => {
              if (!btn.hasAttribute('data-listener-added')) {
                  btn.addEventListener('click', handleSessionRestore);
                  btn.setAttribute('data-listener-added', 'true');
              }
          });

          allDeleteBtns.forEach(btn => {
              if (!btn.hasAttribute('data-listener-added')) {
                  btn.addEventListener('click', handleSessionDelete);
                  btn.setAttribute('data-listener-added', 'true');
              }
          });
      }
  }

  function createSessionCard(session, type) {
      const date = new Date(session.createdAt).toLocaleDateString();
      const time = new Date(session.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
      });

      // 그룹별로 탭 분류
      const tabsByGroup = new Map();
      const ungroupedTabs = [];

      session.tabs.forEach(tab => {
          if (tab.groupId && tab.groupId !== -1) {
              if (!tabsByGroup.has(tab.groupId)) {
                  tabsByGroup.set(tab.groupId, []);
              }
              tabsByGroup.get(tab.groupId).push(tab);
          } else {
              ungroupedTabs.push(tab);
          }
      });

      // 그룹 정보 매핑
      const groupsMap = new Map();
      session.groups.forEach(group => {
          groupsMap.set(group.id, group);
      });

      return `
          <div class="session-item" data-session-id="${session.id}">
              <div class="session-header">
                  <div class="session-header-left">
                      <div class="session-title">${escapeHtml(session.name)}</div>
                      <div class="session-info">
                          📑 ${session.tabCount} tabs • 📁 ${session.groupCount} groups
                          ${session.windowCount > 1 ? ` • 🪟 ${session.windowCount} windows` : ''}
                      </div>
                  </div>
                  <div class="session-header-right">
                      <div class="session-time">${date} ${time}</div>
                      <button class="delete-session-btn" data-session-id="${session.id}" data-type="${type}" title="Delete session">🗑️</button>
                  </div>
              </div>

              <div class="session-content">
                  <div class="tabs-groups-container">
                      ${(session.isClosedSession && ungroupedTabs.length === 0) ? '' : `
                      <div class="tabs-section">
                          <h4>📑 Individual Tabs (${ungroupedTabs.length})</h4>
                          <div class="tabs-list">
                              ${ungroupedTabs.map(tab => createTabItem(tab)).join('')}
                              ${ungroupedTabs.length === 0 ? '<div style="color: #999; font-size: 12px;">No individual tabs</div>' : ''}
                          </div>
                      </div>
                      `}

                      ${(session.isClosedSession && session.groupCount === 0) ? '' : `
                      <div class="groups-section">
                          <h4>📁 Tab Groups (${session.groupCount})</h4>
                          <div class="groups-list">
                              ${session.groups.map(group => createGroupItem(group, tabsByGroup.get(group.id) || [])).join('')}
                              ${session.groupCount === 0 ? '<div style="color: #999; font-size: 12px;">No tab groups</div>' : ''}
                          </div>
                      </div>
                      `}
                  </div>

                  <div class="restore-buttons">
                      <button class="restore-btn primary" data-action="restore-all" data-session-id="${session.id}">
                          🔄 Restore All
                      </button>
                      <button class="restore-btn secondary" data-action="restore-new-window" data-session-id="${session.id}">
                          📱 New Window
                      </button>
                  </div>
              </div>
          </div>
      `;
  }

  function createTabItem(tab) {
      const faviconUrl = tab.favicon || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMy41IDJDMi42NzE1NyAyIDIgMi42NzE1NyAyIDMuNVYxMi41QzIgMTMuMzI4NCAyLjY3MTU3IDE0IDMuNSAxNEgxMi41QzEzLjMyODQgMTQgMTQgMTMuMzI4NCAxNDEyLjVWMy41QzE0IDIuNjcxNTcgMTMuMzI4NCAyIDEyLjUgMkgzLjVaTTMuNSAzSDEyLjVDMTIuNzc2MSAzIDEzIDMuMjIzODYgMTMgMy41VjEyLjVDMTMgMTIuNzc2MSAxMi43NzYxIDEzIDEyLjUgMTNIMy41QzMuMjIzODYgMTMgMyAxMi43NzYxIDMgMTIuNVYzLjVDMyAzLjIyMzg2IDMuMjIzODYgMyAzLjUgM1oiIGZpbGw9IiM5OTk5OTkiLz48L3N2Zz4=';

      return `
          <div class="tab-item" data-tab-url="${escapeHtml(tab.url)}" data-tab-title="${escapeHtml(tab.title)}">
              <img class="tab-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">
              <div class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</div>
          </div>
      `;
  }

  function createGroupItem(group, tabs) {
      return `
          <div class="group-item" data-group-id="${group.id}" data-group-title="${escapeHtml(group.title)}">
              <div class="group-color group-color-${group.color}"></div>
              <div class="group-title">${escapeHtml(group.title) || 'Unnamed Group'}</div>
              <div class="group-count">${tabs.length}</div>
          </div>
      `;
  }

      function createClosedSessionItem(session) {
      const time = new Date(session.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
      });

      // 모든 닫힌 세션을 개별 탭으로 렌더링 (그룹 여부에 관계없이)
      if (session.tabCount > 0 && session.tabs.length > 0) {
          const tab = session.tabs[0];
          const faviconUrl = tab.favicon || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMy41IDJDMi42NzE1NyAyIDIgMi42NzE1NyAyIDMuNVYxMi41QzIgMTMuMzI4NCAyLjY3MTU3IDE0IDMuNSAxNEgxMi41QzEzLjMyODQgMTQgMTQgMTMuMzI4NCAxNDEyLjVWMy41QzE0IDIuNjcxNTcgMTMuMzI4NCAyIDEyLjUgMkgzLjVaTTMuNSAzSDEyLjVDMTIuNzc2MSAzIDEzIDMuMjIzODYgMTMgMy41VjEyLjVDMTMgMTIuNzc2MSAxMi43NzYxIDEzIDEyLjUgMTNIMy41QzMuMjIzODYgMTMgMyAxMi43NzYxIDMgMTIuNVYzLjVDMyAzLjIyMzg2IDMuMjIzODYgMyAzLjUgM1oiIGZpbGw9IiM5OTk5OTkiLz48L3N2Zz4=';

          return `
              <div class="closed-tab-item" data-session-id="${session.id}" data-tab-url="${escapeHtml(tab.url)}">
                  <div class="closed-item-content">
                      <div class="closed-item-icon">
                          <img class="tab-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">
                      </div>
                      <div class="closed-item-info">
                          <div class="closed-item-title">${escapeHtml(tab.title)}</div>
                          <div class="closed-item-detail">${time}</div>
                      </div>
                      <button class="delete-closed-btn" data-session-id="${session.id}" title="Delete">🗑️</button>
                  </div>
              </div>
          `;
      }

      return '';
  }

  function toggleSessionContent(event) {
      const sessionItem = event.target.closest('.session-item');
      const content = sessionItem.querySelector('.session-content');

      content.classList.toggle('expanded');
  }

  async function handleTabRestore(event) {
      event.stopPropagation();

      const tabItem = event.target.closest('.tab-item');
      const tabUrl = tabItem.dataset.tabUrl;
      const tabTitle = tabItem.dataset.tabTitle;

      try {
          // newtab에서는 현재 탭을 리다이렉트, 그 외에서는 새 탭 생성
          if (window.location.pathname.includes('newtab.html')) {
              // 현재 탭을 해당 URL로 이동
              window.location.href = tabUrl;
          } else {
              // 새 탭 생성
              await chrome.tabs.create({
                  url: tabUrl,
                  active: true
              });
          }

          showNotification(`Restored tab: ${tabTitle}`);
      } catch (error) {
          console.error('Error restoring tab:', error);
          showNotification('Failed to restore tab', 'error');
      }
  }

      async function handleGroupRestore(event) {
      event.stopPropagation();

      const groupItem = event.target.closest('.group-item');
      const sessionItem = event.target.closest('.session-item');
      const sessionId = sessionItem.dataset.sessionId;
      const groupId = groupItem.dataset.groupId;
      const groupTitle = groupItem.dataset.groupTitle;

      // 버튼 비활성화 및 로딩 표시
      const originalText = groupItem.innerHTML;
      groupItem.style.opacity = '0.5';
      groupItem.style.pointerEvents = 'none';

                try {
          const response = await chrome.runtime.sendMessage({
              action: 'restoreGroup',
              sessionId: sessionId,
              groupId: groupId,
              openInNewWindow: false, // 현재 창에서 열기
              fromNewTab: true // newtab에서 호출됨을 표시
          });

          if (response.success) {
              const restoredTitle = response.groupTitle || groupTitle;
              showNotification(`Restored group: ${restoredTitle} (${response.tabCount} tabs)`);
          } else {
              console.error('Group restore failed:', response.error);
              showNotification(`Failed to restore group: ${response.error}`, 'error');
          }
      } catch (error) {
          console.error('Error restoring group:', error);
          showNotification(`Failed to restore group: ${error.message}`, 'error');
      } finally {
          // 버튼 상태 복원
          groupItem.style.opacity = '1';
          groupItem.style.pointerEvents = 'auto';
          groupItem.innerHTML = originalText;
      }
  }

  async function handleSessionRestore(event) {
      event.stopPropagation();

      const btn = event.target;
      const action = btn.dataset.action;
      const sessionId = btn.dataset.sessionId;
      const openInNewWindow = action === 'restore-new-window';

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Restoring...';

      try {
          const response = await chrome.runtime.sendMessage({
              action: 'restoreSession',
              sessionId: sessionId,
              openInNewWindow,
              fromNewTab: true // newtab에서 호출됨을 표시
          });

          if (response.success) {
              showNotification(`Session restored successfully! (${response.tabCount} tabs)`);
          } else {
              showNotification(`Failed to restore session: ${response.error}`, 'error');
          }
      } catch (error) {
          console.error('Error restoring session:', error);
          showNotification('Failed to restore session', 'error');
      } finally {
          btn.disabled = false;
          btn.textContent = originalText;
      }
  }

  function showNotification(message, type = 'success') {
      // 기존 알림 제거
      const existingNotification = document.querySelector('.notification');
      if (existingNotification) {
          existingNotification.remove();
      }

      // 새 알림 생성
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.textContent = message;
      notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: ${type === 'error' ? '#dc3545' : '#28a745'};
          color: white;
          padding: 12px 20px;
          border-radius: 6px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          font-size: 14px;
          max-width: 300px;
          word-wrap: break-word;
      `;

      document.body.appendChild(notification);

      // 3초 후 제거
      setTimeout(() => {
          if (notification.parentNode) {
              notification.remove();
          }
      }, 3000);
  }

  async function handleSessionDelete(event) {
      event.stopPropagation();

      const btn = event.target;
      const sessionId = btn.dataset.sessionId;
      const type = btn.dataset.type;

      if (!confirm('Are you sure you want to delete this session?')) {
          return;
      }

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = '⏳';

      try {
          const response = await chrome.runtime.sendMessage({
              action: 'deleteSession',
              sessionId: sessionId,
              type: type
          });

          if (response.success) {
              // 해당 세션 아이템 제거
              const sessionItem = btn.closest('.session-item');
              sessionItem.remove();

              // 섹션이 비어있는지 확인하고 업데이트
              const container = type === 'closed' ? closedSessionsContainer : autoSavedSessionsContainer;
              if (container.children.length === 0) {
                  container.innerHTML = `
                      <div class="no-sessions">
                          ${type === 'closed' ? 'No recently closed sessions' : 'No auto-saved sessions'}
                      </div>
                  `;
              }

              showNotification('Session deleted successfully!');
          } else {
              showNotification(`Failed to delete session: ${response.error}`, 'error');
          }
      } catch (error) {
          console.error('Error deleting session:', error);
          showNotification('Failed to delete session', 'error');
      } finally {
          btn.disabled = false;
          btn.textContent = originalText;
      }
  }

  async function handleClearAll(event) {
      const btn = event.target;
      const type = btn.dataset.type;

      if (!confirm(`Are you sure you want to clear all ${type === 'closed' ? 'closed' : 'auto-saved'} sessions?`)) {
          return;
      }

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = '⏳ Clearing...';

      try {
          const response = await chrome.runtime.sendMessage({
              action: 'clearAllSessions',
              type: type
          });

          if (response.success) {
              // 해당 컨테이너 비우기
              const container = type === 'closed' ? closedSessionsContainer : autoSavedSessionsContainer;
              container.innerHTML = `
                  <div class="no-sessions">
                      ${type === 'closed' ? 'No recently closed sessions' : 'No auto-saved sessions'}
                  </div>
              `;

              showNotification(`All ${type === 'closed' ? 'closed' : 'auto-saved'} sessions cleared!`);
          } else {
              showNotification(`Failed to clear sessions: ${response.error}`, 'error');
          }
      } catch (error) {
          console.error('Error clearing sessions:', error);
          showNotification('Failed to clear sessions', 'error');
      } finally {
          btn.disabled = false;
          btn.textContent = originalText;
      }
  }

  // 닫힌 탭 복원
  async function handleClosedTabRestore(event) {
      // 삭제 버튼 클릭 시 복원 방지
      if (event.target.classList.contains('delete-closed-btn')) {
          return;
      }

      event.stopPropagation();

      const tabItem = event.target.closest('.closed-tab-item');
      const tabUrl = tabItem.dataset.tabUrl;

      try {
          // newtab에서는 현재 탭을 리다이렉트, 그 외에서는 새 탭 생성
          if (window.location.pathname.includes('newtab.html')) {
              // 현재 탭을 해당 URL로 이동
              window.location.href = tabUrl;
          } else {
              // 새 탭 생성
              await chrome.tabs.create({ url: tabUrl });
          }
          showNotification('Tab restored successfully!');
      } catch (error) {
          console.error('Error restoring closed tab:', error);
          showNotification('Failed to restore tab', 'error');
      }
  }

  // 닫힌 그룹 복원 (그룹 헤더 클릭 시 전체 그룹 복원)
  async function handleClosedGroupRestore(event) {
      // 삭제 버튼이나 화살표 클릭 시 복원 방지
      if (event.target.classList.contains('delete-closed-btn') ||
          event.target.classList.contains('expand-arrow')) {
          return;
      }

      event.stopPropagation();

      const container = event.target.closest('.closed-group-container');
      const sessionId = container.dataset.sessionId;
      const groupId = container.dataset.groupId;

      try {
          const response = await chrome.runtime.sendMessage({
              action: 'restoreGroup',
              sessionId: sessionId,
              groupId: groupId,
              openInNewWindow: false, // 현재 창에서 열기
              fromNewTab: true // newtab에서 호출됨을 표시
          });

          if (response.success) {
              showNotification(`Group restored: ${response.groupTitle || 'Restored Group'} (${response.tabCount} tabs)`);
          } else {
              showNotification(`Failed to restore group: ${response.error}`, 'error');
          }
      } catch (error) {
          console.error('Error restoring closed group:', error);
          showNotification('Failed to restore group', 'error');
      }
  }

  // 닫힌 아이템 삭제
  async function handleClosedItemDelete(event) {
      event.stopPropagation();

      const btn = event.target;
      const sessionId = btn.dataset.sessionId;
      const item = btn.closest('.closed-tab-item, .closed-group-item');

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = '⏳';

      try {
          const response = await chrome.runtime.sendMessage({
              action: 'deleteSession',
              sessionId: sessionId,
              type: 'closed'
          });

          if (response.success) {
              // UI에서 아이템 제거
              item.remove();

              // 섹션이 비어있는지 확인
              if (closedSessionsContainer.children.length === 0) {
                  closedSessionsContainer.innerHTML = '<div class="no-sessions">No recently closed sessions</div>';
              }

              showNotification('Item deleted successfully!');
          } else {
              showNotification(`Failed to delete item: ${response.error}`, 'error');
          }
      } catch (error) {
          console.error('Error deleting closed item:', error);
          showNotification('Failed to delete item', 'error');
      } finally {
          btn.disabled = false;
          btn.textContent = originalText;
      }
  }

  // 그룹 펼치기/접기 (화살표 클릭 시만)
  function handleGroupToggle(event) {
      // 화살표가 아니면 무시
      if (!event.target.classList.contains('expand-arrow')) {
          return;
      }

      event.stopPropagation();

      const container = event.target.closest('.closed-group-container');
      const tabsContainer = container.querySelector('.closed-group-tabs');
      const arrow = container.querySelector('.expand-arrow');

      if (tabsContainer.style.display === 'none') {
          // 펼치기
          tabsContainer.style.display = 'block';
          arrow.textContent = '▼';
          container.classList.add('expanded');
      } else {
          // 접기
          tabsContainer.style.display = 'none';
          arrow.textContent = '▶';
          container.classList.remove('expanded');
      }
  }

  // 그룹 내 개별 탭 복원
  async function handleGroupTabRestore(event) {
      event.stopPropagation();

      const tabItem = event.target.closest('.closed-group-tab-item');
      const tabUrl = tabItem.dataset.tabUrl;

      try {
          await chrome.tabs.create({ url: tabUrl });
          showNotification('Tab restored successfully!');
      } catch (error) {
          console.error('Error restoring group tab:', error);
          showNotification('Failed to restore tab', 'error');
      }
  }

      // 검색 기능 초기화
  function initializeSearch() {
      const searchInput = document.getElementById('searchInput');
      const dropdown = document.getElementById('searchHistoryDropdown');
      let highlightedIndex = -1;
      let isNavigating = false; // 방향키 네비게이션 중인지 확인

      // 검색 기록 로드
      loadSearchHistory();

      // 검색 실행
      searchInput.addEventListener('keydown', async (event) => {
          if (event.key === 'Enter') {
              event.preventDefault();
              const query = searchInput.value.trim();
              if (query) {
                  await saveSearchHistory(query);
                  // Ctrl+Enter: 새 탭에서 검색, 일반 Enter: 현재 탭에서 검색
                  const openInNewTab = event.ctrlKey || event.metaKey;
                  handleSearch(query, openInNewTab);
                  highlightedIndex = -1; // 검색 실행 후 하이라이트 인덱스 리셋
              }
          } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              isNavigating = true;
              navigateHistory(1);
              // 짧은 시간 후 네비게이션 플래그 해제
              setTimeout(() => { isNavigating = false; }, 100);
          } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              isNavigating = true;
              navigateHistory(-1);
              // 짧은 시간 후 네비게이션 플래그 해제
              setTimeout(() => { isNavigating = false; }, 100);
          } else if (event.key === 'Escape') {
              hideSearchHistory();
          }
      });

      // 검색창 포커스 시 기록 표시
      searchInput.addEventListener('focus', () => {
          showSearchHistory();
      });

      // 검색창 값 변경 시 필터링 및 자동완성
      let debounceTimer;
      searchInput.addEventListener('input', () => {
          // 방향키 네비게이션 중이면 자동완성 요청하지 않음
          if (isNavigating) {
              return;
          }

          const query = searchInput.value.trim();

          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
              if (query.length > 0) {
                  await loadSuggestionsAndHistory(query);
                  highlightedIndex = -1; // 새로운 검색 시 하이라이트 인덱스 리셋
              } else {
                  await loadSearchHistory();
                  highlightedIndex = -1; // 검색어 삭제 시 하이라이트 인덱스 리셋
              }
          }, 300); // 300ms 디바운스
      });

      // 문서 클릭 시 드롭다운 숨기기
      document.addEventListener('click', (event) => {
          if (!event.target.closest('.search-container')) {
              hideSearchHistory();
          }
      });

              // 키보드 네비게이션
      function navigateHistory(direction) {
          const items = dropdown.querySelectorAll('.search-suggestion-item, .search-history-item');
          if (items.length === 0) {
              highlightedIndex = -1;
              return;
          }

          // 이전 하이라이트 제거
          items.forEach(item => item.classList.remove('highlighted'));

          // 새 인덱스 계산
          highlightedIndex += direction;
          if (highlightedIndex < 0) highlightedIndex = items.length - 1;
          if (highlightedIndex >= items.length) highlightedIndex = 0;

          // 새 아이템 하이라이트
          if (highlightedIndex >= 0 && highlightedIndex < items.length) {
              items[highlightedIndex].classList.add('highlighted');

              // 검색창에 텍스트 입력 (임시로 네비게이션 플래그 연장)
              isNavigating = true;
              const textElement = items[highlightedIndex].querySelector('.search-suggestion-text, .search-history-text');
              if (textElement) {
                  const query = textElement.textContent;
                  searchInput.value = query;
              }

              // 하이라이트된 항목을 뷰포트에 스크롤
              items[highlightedIndex].scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest'
              });
          }
      }
  }

  // 검색 처리
  async function handleSearch(query, openInNewTab = false) {
      if (!query) return;

      try {
          // 입력된 값이 URL인지 확인
          if (isValidUrl(query)) {
              // URL인 경우 해당 사이트로 이동
              const url = query.startsWith('http') ? query : `https://${query}`;
              if (openInNewTab) {
                  window.open(url, '_blank');
              } else {
                  window.location.href = url;
              }
          } else {
              // URL이 아닌 경우 Chrome Search API를 사용하여 기본 검색 공급자로 검색
              await chrome.search.query({
                  text: query,
                  disposition: openInNewTab ? "NEW_TAB" : "CURRENT_TAB"
              });
          }
      } catch (error) {
          console.error('Search error:', error);
          // Chrome Search API 실패 시 Google 검색으로 fallback
          const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          if (openInNewTab) {
              window.open(googleSearchUrl, '_blank');
          } else {
              window.location.href = googleSearchUrl;
          }
      }
  }

  // URL 유효성 검사
  function isValidUrl(string) {
      try {
          // 완전한 URL 체크 (http:// 또는 https://로 시작)
          if (string.startsWith('http://') || string.startsWith('https://')) {
              new URL(string);
              return true;
          }

          // 도메인 패턴 체크 (더 엄격하게)
          const domainPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:[0-9]+)?(\/.*)?$/;
          if (domainPattern.test(string)) {
              // 한국어나 특수문자가 포함된 경우 URL이 아닌 것으로 판단
              if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(string)) {
                  return false;
              }

              // 점(.)이 있고 적절한 도메인 형식인지 확인
              const parts = string.split('.');
              if (parts.length >= 2 && parts[parts.length - 1].length >= 2) {
                  try {
                      new URL(`https://${string}`);
                      return true;
                  } catch (_) {
                      return false;
                  }
              }
          }

          return false;
      } catch (_) {
          return false;
      }
  }

      // 바로가기 사이트 로드
  async function loadTopSites() {
      try {
          const sites = await chrome.topSites.get();
          const shortcutsContainer = document.getElementById('shortcutsContainer');

          if (sites.length === 0) {
              shortcutsContainer.innerHTML = '<div style="text-align: center; color: rgba(255, 255, 255, 0.7); grid-column: 1 / -1;">No shortcuts available</div>';
              return;
          }

          // 최대 8개의 사이트만 표시
          const topSites = sites.slice(0, 8);

          shortcutsContainer.innerHTML = topSites.map(site => {
              const domain = new URL(site.url).hostname;
              const title = site.title || domain;

              return `
                  <a href="${site.url}" class="shortcut-item">
                      <div class="shortcut-icon" data-domain="${domain}">
                          ${getDomainIcon(domain)}
                      </div>
                      <div class="shortcut-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
                  </a>
              `;
          }).join('');

          // 파비콘 로드 시도
          topSites.forEach(async (site, index) => {
              const domain = new URL(site.url).hostname;
              const iconElement = shortcutsContainer.children[index].querySelector('.shortcut-icon');

              try {
                  const faviconUrl = await getFaviconUrl(domain);
                  if (faviconUrl) {
                      iconElement.innerHTML = `<img src="${faviconUrl}" alt="" style="width: 32px; height: 32px; border-radius: 4px;" onerror="this.parentElement.innerHTML='${getDomainIcon(domain)}';">`;
                  }
              } catch (error) {
                  console.log(`Failed to load favicon for ${domain}:`, error);
                  // 기본 아이콘 유지
              }
          });
      } catch (error) {
          console.error('Error loading top sites:', error);
          const shortcutsContainer = document.getElementById('shortcutsContainer');
          shortcutsContainer.innerHTML = '<div style="text-align: center; color: rgba(255, 255, 255, 0.7); grid-column: 1 / -1;">Unable to load shortcuts</div>';
      }
  }

  // 파비콘 URL 가져오기 (여러 서비스 fallback)
  async function getFaviconUrl(domain) {
      const services = [
          `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
          `https://favicon.yandex.net/favicon/${domain}`,
          `https://icons.duckduckgo.com/ip3/${domain}.ico`,
          `https://${domain}/favicon.ico`
      ];

      for (const service of services) {
          try {
              const response = await fetch(service, {
                  method: 'HEAD',
                  mode: 'cors',
                  credentials: 'omit',
                  referrer: 'no-referrer'
              });

              if (response.ok) {
                  return service;
              }
          } catch (error) {
              // 다음 서비스 시도
              continue;
          }
      }

      return null;
  }

  // 도메인별 기본 아이콘 반환
  function getDomainIcon(domain) {
      const domainIcons = {
          'google.com': '🔍',
          'youtube.com': '📺',
          'facebook.com': '👥',
          'instagram.com': '📸',
          'twitter.com': '🐦',
          'x.com': '🐦',
          'linkedin.com': '💼',
          'github.com': '🐙',
          'stackoverflow.com': '📚',
          'reddit.com': '🤖',
          'netflix.com': '🎬',
          'amazon.com': '🛒',
          'ebay.com': '🛍️',
          'paypal.com': '💳',
          'microsoft.com': '🏢',
          'apple.com': '🍎',
          'wikipedia.org': '📖',
          'naver.com': '🟢',
          'daum.net': '📧',
          'kakao.com': '💬',
          'tistory.com': '✍️',
          'blog.naver.com': '📝',
          'yes24.com': '📚',
          'coupang.com': '🛒',
          'baidu.com': '🔍',
          'taobao.com': '🛍️',
          'weibo.com': '🐦',
          'bilibili.com': '📺'
      };

      return domainIcons[domain] || '🌐';
  }

  // 검색 기록 저장
  async function saveSearchHistory(query) {
      try {
          const result = await chrome.storage.local.get(['searchHistory']);
          let history = result.searchHistory || [];

          // 중복 제거
          history = history.filter(item => item !== query);

          // 맨 앞에 추가
          history.unshift(query);

          // 최대 20개까지 유지
          if (history.length > 20) {
              history = history.slice(0, 20);
          }

          await chrome.storage.local.set({ searchHistory: history });
      } catch (error) {
          console.error('Error saving search history:', error);
      }
  }

  // 검색 기록 로드
  async function loadSearchHistory() {
      try {
          const result = await chrome.storage.local.get(['searchHistory']);
          const history = result.searchHistory || [];
          renderSearchHistory(history);
      } catch (error) {
          console.error('Error loading search history:', error);
      }
  }

  // 검색 기록 표시
  function showSearchHistory() {
      const dropdown = document.getElementById('searchHistoryDropdown');
      dropdown.classList.add('visible');
      highlightedIndex = -1; // 드롭다운 표시 시 하이라이트 인덱스 리셋
      loadSearchHistory();
  }

  // 검색 기록 숨기기
  function hideSearchHistory() {
      const dropdown = document.getElementById('searchHistoryDropdown');
      dropdown.classList.remove('visible');
      highlightedIndex = -1; // 드롭다운 숨김 시 하이라이트 인덱스 리셋
  }

      // 검색 기록 필터링
  async function filterSearchHistory(query) {
      try {
          const result = await chrome.storage.local.get(['searchHistory']);
          const history = result.searchHistory || [];

          const filtered = query ?
              history.filter(item => item.toLowerCase().includes(query.toLowerCase())) :
              history;

          renderSearchHistory(filtered);
      } catch (error) {
          console.error('Error filtering search history:', error);
      }
  }

  // 자동완성과 검색 기록을 함께 로드
  async function loadSuggestionsAndHistory(query) {
      try {
          // 자동완성 결과와 검색 기록을 병렬로 가져오기
          const [suggestions, historyResult] = await Promise.all([
              getGoogleSuggestions(query),
              chrome.storage.local.get(['searchHistory'])
          ]);

          const history = historyResult.searchHistory || [];
          const filteredHistory = history.filter(item =>
              item.toLowerCase().includes(query.toLowerCase())
          );

          renderSuggestionsAndHistory(suggestions, filteredHistory, query);
      } catch (error) {
          console.error('Error loading suggestions and history:', error);
          // 오류 발생 시 검색 기록만 표시
          await filterSearchHistory(query);
      }
  }

  // Google Suggest API에서 자동완성 결과 가져오기
  async function getGoogleSuggestions(query) {
      try {
          // 여러 Google Suggest API 엔드포인트 시도
          const endpoints = [
              `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`,
              `https://clients1.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`
          ];

          for (const endpoint of endpoints) {
              try {
                  const response = await fetch(endpoint, {
                      method: 'GET',
                      mode: 'cors',
                      credentials: 'omit'
                  });

                  if (response.ok) {
                      const data = await response.json();
                      if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
                          return data[1].slice(0, 8); // 최대 8개 제안
                      }
                  }
              } catch (error) {
                  console.log(`Failed to fetch from ${endpoint}:`, error);
                  continue;
              }
          }

          // CORS 문제가 있는 경우 JSONP 방식 시도
          return await getGoogleSuggestionsJSONP(query);
      } catch (error) {
          console.error('Error fetching Google suggestions:', error);
          return [];
      }
  }

  // JSONP 방식으로 Google Suggest API 호출
  async function getGoogleSuggestionsJSONP(query) {
      return new Promise((resolve) => {
          const script = document.createElement('script');
          const callbackName = 'google_suggest_callback_' + Date.now();

          // 글로벌 콜백 함수 생성
          window[callbackName] = function(data) {
              try {
                  if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
                      resolve(data[1].slice(0, 8));
                  } else {
                      resolve([]);
                  }
              } catch (error) {
                  resolve([]);
              }

              // 정리
              document.head.removeChild(script);
              delete window[callbackName];
          };

          // 5초 타임아웃
          setTimeout(() => {
              if (window[callbackName]) {
                  window[callbackName]([]);
              }
          }, 5000);

          script.src = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&callback=${callbackName}`;
          document.head.appendChild(script);
      });
  }

      // 자동완성과 검색 기록을 함께 렌더링
  function renderSuggestionsAndHistory(suggestions, history, query) {
      const dropdown = document.getElementById('searchHistoryDropdown');
      let html = '';

      // 자동완성 결과 섹션
      if (suggestions.length > 0) {
          html += '<div class="search-suggestions-section">';
          html += '<div class="search-suggestions-header">Search suggestions</div>';
          html += suggestions.map(suggestion => {
              const highlightedText = highlightQuery(suggestion, query);
              return `
                  <div class="search-suggestion-item" data-query="${escapeHtml(suggestion)}">
                      <div class="search-suggestion-icon">🔍</div>
                      <div class="search-suggestion-text">${highlightedText}</div>
                  </div>
              `;
          }).join('');
          html += '</div>';
      }

      // 검색 기록 섹션
      if (history.length > 0) {
          html += '<div class="search-history-section">';
          if (suggestions.length > 0) {
              html += '<div class="search-suggestions-header">Recent searches</div>';
          }
          html += history.map(historyQuery => {
              const isUrl = isValidUrl(historyQuery);
              const icon = isUrl ? '🌐' : '🔍';
              const highlightedText = highlightQuery(historyQuery, query);

              return `
                  <div class="search-history-item" data-query="${escapeHtml(historyQuery)}">
                      <div class="search-history-icon">${icon}</div>
                      <div class="search-history-text">${highlightedText}</div>
                      <div class="search-history-delete" title="Delete">×</div>
                  </div>
              `;
          }).join('');
          html += '</div>';
      }

      // 결과가 없는 경우
      if (suggestions.length === 0 && history.length === 0) {
          html = '<div class="search-history-empty">No suggestions or history</div>';
      }

      dropdown.innerHTML = html;

      // DOM 재생성 후 하이라이트 인덱스 리셋
      highlightedIndex = -1;

      // 이벤트 리스너 추가
      addSearchItemEventListeners();
  }

  // 검색 기록만 렌더링
  function renderSearchHistory(history) {
      const dropdown = document.getElementById('searchHistoryDropdown');

      if (history.length === 0) {
          dropdown.innerHTML = '<div class="search-history-empty">No search history</div>';
          highlightedIndex = -1; // 빈 기록 시 하이라이트 인덱스 리셋
          return;
      }

      dropdown.innerHTML = history.map(query => {
          const isUrl = isValidUrl(query);
          const icon = isUrl ? '🌐' : '🔍';

          return `
              <div class="search-history-item" data-query="${escapeHtml(query)}">
                  <div class="search-history-icon">${icon}</div>
                  <div class="search-history-text">${escapeHtml(query)}</div>
                  <div class="search-history-delete" title="Delete">×</div>
              </div>
          `;
      }).join('');

      // DOM 재생성 후 하이라이트 인덱스 리셋
      highlightedIndex = -1;

      // 이벤트 리스너 추가
      addSearchItemEventListeners();
  }

  // 검색 아이템 이벤트 리스너 추가
  function addSearchItemEventListeners() {
      const dropdown = document.getElementById('searchHistoryDropdown');

      // 자동완성 및 검색 기록 클릭 이벤트
      dropdown.querySelectorAll('.search-suggestion-item, .search-history-item').forEach(item => {
          item.addEventListener('click', async (event) => {
              if (event.target.classList.contains('search-history-delete')) {
                  return; // 삭제 버튼 클릭 시 무시
              }

              const query = item.dataset.query;
              const searchInput = document.getElementById('searchInput');
              searchInput.value = query;

              await saveSearchHistory(query);
              // Ctrl+클릭: 새 탭에서 검색, 일반 클릭: 현재 탭에서 검색
              const openInNewTab = event.ctrlKey || event.metaKey;
              handleSearch(query, openInNewTab);
          });
      });

      // 검색 기록 삭제 버튼 이벤트
      dropdown.querySelectorAll('.search-history-delete').forEach(deleteBtn => {
          deleteBtn.addEventListener('click', async (event) => {
              event.stopPropagation();
              const query = deleteBtn.closest('.search-history-item').dataset.query;
              await deleteSearchHistoryItem(query);

              // 현재 검색어가 있으면 자동완성과 함께 다시 로드
              const searchInput = document.getElementById('searchInput');
              const currentQuery = searchInput.value.trim();
              if (currentQuery) {
                  await loadSuggestionsAndHistory(currentQuery);
              } else {
                  await loadSearchHistory();
              }
          });
      });
  }

  // 검색어 하이라이트 처리
  function highlightQuery(text, query) {
      if (!query) return escapeHtml(text);

      const escapedText = escapeHtml(text);
      const escapedQuery = escapeHtml(query);

      try {
          const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          return escapedText.replace(regex, '<span class="highlight">$1</span>');
      } catch (error) {
          return escapedText;
      }
  }

  // 검색 기록 개별 삭제
  async function deleteSearchHistoryItem(queryToDelete) {
      try {
          const result = await chrome.storage.local.get(['searchHistory']);
          let history = result.searchHistory || [];

          history = history.filter(item => item !== queryToDelete);

          await chrome.storage.local.set({ searchHistory: history });
      } catch (error) {
          console.error('Error deleting search history item:', error);
      }
  }

  function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
  }

  // Google 헤더 메뉴 초기화
  function initializeGoogleHeader() {
      const googleAppsBtn = document.querySelector('.google-apps-btn');
      const googleAppsDropdown = document.getElementById('googleAppsDropdown');

      // Google 앱 메뉴 클릭 이벤트
      if (googleAppsBtn && googleAppsDropdown) {
          googleAppsBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              googleAppsDropdown.classList.toggle('visible');
          });

          // 드롭다운 외부 클릭 시 닫기
          document.addEventListener('click', (e) => {
              if (!googleAppsBtn.contains(e.target) && !googleAppsDropdown.contains(e.target)) {
                  googleAppsDropdown.classList.remove('visible');
              }
          });

          // 드롭다운 내부 클릭 시 전파 방지 (링크는 제외)
          googleAppsDropdown.addEventListener('click', (e) => {
              if (e.target.tagName === 'A' || e.target.closest('a')) {
                  // 링크 클릭 시 드롭다운 닫기
                  googleAppsDropdown.classList.remove('visible');
              } else {
                  e.stopPropagation();
              }
          });
      }

      // Search Labs 클릭 이벤트
      const searchLabsBtn = document.querySelector('[title="Search Labs"]');
      if (searchLabsBtn) {
          searchLabsBtn.addEventListener('click', () => {
              window.open('https://labs.google.com/search?source=ntp', '_blank');
          });
      }

      // 프로필 버튼 클릭 이벤트
      const profileBtn = document.querySelector('.header-profile-btn');
      if (profileBtn) {
          profileBtn.addEventListener('click', () => {
              window.open('https://myaccount.google.com/', '_blank');
          });
      }
  }

  // ============== Chrome Theme Integration ==============

  async function applyTheme() {
      try {
          // chrome.theme API 사용 가능 여부 확인
          if (!chrome.theme || !chrome.theme.getCurrent) {
              console.log('Chrome theme API not available, using default theme');
              applyDefaultTheme();
              return;
          }

          const theme = await chrome.theme.getCurrent();
          console.log('Current theme:', theme);

          const colors = theme.colors || {};
          const isDarkTheme = isDarkMode(colors);

          // CSS 변수로 테마 색상 설정
          const root = document.documentElement;

          // 배경 색상 설정
          const backgroundColor = colors.ntp_background ||
                                colors.frame ||
                                (isDarkTheme ? '#202124' : '#ffffff');

          // 텍스트 색상 설정
          const textColor = colors.ntp_text ||
                          colors.tab_text ||
                          colors.bookmark_text ||
                          (isDarkTheme ? '#e8eaed' : '#202124');

          // 카드 배경 색상 설정 (배경보다 약간 다른 색상)
          const cardBackground = colors.toolbar ||
                               adjustBrightness(backgroundColor, isDarkTheme ? 15 : -5);

          // 보조 텍스트 색상
          const secondaryTextColor = adjustOpacity(textColor, 0.7);

          // 구분선 색상
          const borderColor = adjustOpacity(textColor, 0.12);

          // 호버 색상
          const hoverColor = adjustOpacity(textColor, 0.08);

          // 초기 다크 배경을 덮어쓰기 위해 직접 스타일 적용
          document.body.style.setProperty('background', backgroundColor, 'important');
          document.body.style.setProperty('color', textColor, 'important');

          // CSS 변수 설정 (하위 요소들을 위해)
          root.style.setProperty('--theme-background', backgroundColor);
          root.style.setProperty('--theme-text', textColor);
          root.style.setProperty('--theme-card-background', cardBackground);
          root.style.setProperty('--theme-secondary-text', secondaryTextColor);
          root.style.setProperty('--theme-border', borderColor);
          root.style.setProperty('--theme-hover', hoverColor);
          root.style.setProperty('--theme-is-dark', isDarkTheme ? '1' : '0');

                    // 검색창 관련 CSS 변수 설정
          root.style.setProperty('--theme-input-bg', cardBackground);
          root.style.setProperty('--theme-input-text', textColor);
          root.style.setProperty('--theme-input-placeholder', secondaryTextColor);

          // 아이콘 배경 색상 설정
          const iconBackground = isDarkTheme ?
            adjustBrightness(backgroundColor, 20) :
            adjustBrightness(backgroundColor, -10);
          root.style.setProperty('--theme-icon-background', iconBackground);

          // 스크롤바 색상 설정
          root.style.setProperty('--theme-scrollbar-track', adjustOpacity(textColor, 0.05));
          root.style.setProperty('--theme-scrollbar-thumb', adjustOpacity(textColor, 0.2));
          root.style.setProperty('--theme-scrollbar-thumb-hover', adjustOpacity(textColor, 0.3));

          // 배경 이미지가 있는 경우 적용
          if (theme.images && theme.images.theme_ntp_background) {
              const bgImage = theme.images.theme_ntp_background;

              // body에 직접 배경 이미지 적용
              document.body.style.setProperty('background-image', `url(${bgImage.url})`, 'important');

              // 배경 이미지 속성 설정
              const properties = theme.properties || {};
              const backgroundRepeat = properties.ntp_background_repeat || 'no-repeat';
              const backgroundPosition = properties.ntp_background_alignment || 'center center';

              document.body.style.setProperty('background-repeat', backgroundRepeat, 'important');
              document.body.style.setProperty('background-position', backgroundPosition, 'important');
              document.body.style.setProperty('background-size', 'cover', 'important');

              // CSS 변수도 설정 (하위 요소들을 위해)
              root.style.setProperty('--theme-background-image', `url(${bgImage.url})`);
              root.style.setProperty('--theme-background-repeat', backgroundRepeat);
              root.style.setProperty('--theme-background-position', backgroundPosition);
          } else {
              // 배경 이미지가 없는 경우 제거
              document.body.style.setProperty('background-image', 'none', 'important');
              root.style.setProperty('--theme-background-image', 'none');
          }

          // 테마 클래스 추가
          document.body.classList.toggle('dark-theme', isDarkTheme);
          document.body.classList.toggle('light-theme', !isDarkTheme);

          // 헤더 아이콘 테마 업데이트
          updateHeaderIcons(isDarkTheme);

      } catch (error) {
          console.error('Error applying theme:', error);
          // 기본 테마 적용
          applyDefaultTheme();
      }
  }

    function applyDefaultTheme() {
      console.log('Applying default theme');
      const root = document.documentElement;

      // 기본 라이트 테마를 body에 직접 적용
      document.body.style.setProperty('background', 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)', 'important');
      document.body.style.setProperty('background-image', 'none', 'important');
      document.body.style.setProperty('color', '#202124', 'important');

      // CSS 변수도 설정 (하위 요소들을 위해)
      root.style.setProperty('--theme-background', 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)');
      root.style.setProperty('--theme-background-image', 'none');
      root.style.setProperty('--theme-text', '#202124');
      root.style.setProperty('--theme-surface', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--theme-surface-hover', 'rgba(255, 255, 255, 0.2)');
      root.style.setProperty('--theme-border', 'rgba(255, 255, 255, 0.2)');
      root.style.setProperty('--theme-input-bg', 'rgba(255, 255, 255, 0.9)');
      root.style.setProperty('--theme-input-text', '#333333');
      root.style.setProperty('--theme-input-placeholder', '#666666');
      root.style.setProperty('--theme-icon-background', '#f0f0f0');
      root.style.setProperty('--theme-button-bg', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--theme-button-hover', 'rgba(255, 255, 255, 0.2)');
      root.style.setProperty('--theme-icon-filter', 'none');
      root.style.setProperty('--theme-scrollbar-track', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--theme-scrollbar-thumb', 'rgba(255, 255, 255, 0.3)');
      root.style.setProperty('--theme-scrollbar-thumb-hover', 'rgba(255, 255, 255, 0.5)');

      // 테마 클래스 설정
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');

      // 헤더 아이콘 테마 업데이트
      updateHeaderIcons(false);
  }

  function isDarkMode(colors) {
      // 배경색이나 프레임 색을 기준으로 다크 모드 판단
      const bgColor = colors.ntp_background || colors.frame;
      if (!bgColor) return false;

      // RGB 값 추출
      const rgb = hexToRgb(bgColor);
      if (!rgb) return false;

      // 밝기 계산 (0-255)
      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      return brightness < 128;
  }

  function hexToRgb(hex) {
      if (!hex) return null;

      // #을 제거하고 처리
      const cleanHex = hex.replace('#', '');

      // 3자리 hex를 6자리로 변환
      const expandedHex = cleanHex.length === 3
          ? cleanHex.split('').map(char => char + char).join('')
          : cleanHex;

      const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(expandedHex);
      return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
      } : null;
  }

  function adjustBrightness(color, percent) {
      if (!color) return color;

      const rgb = hexToRgb(color);
      if (!rgb) return color;

      const adjust = (value, percent) => {
          const adjusted = value + (value * percent / 100);
          return Math.max(0, Math.min(255, Math.round(adjusted)));
      };

      const newR = adjust(rgb.r, percent);
      const newG = adjust(rgb.g, percent);
      const newB = adjust(rgb.b, percent);

      return `rgb(${newR}, ${newG}, ${newB})`;
  }

  function adjustOpacity(color, opacity) {
      if (!color) return color;

      if (color.startsWith('rgb(')) {
          return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
      }

      const rgb = hexToRgb(color);
      if (!rgb) return color;

      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }

  function applyDefaultTheme() {
      const root = document.documentElement;
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (isDark) {
          root.style.setProperty('--theme-background', '#202124');
          root.style.setProperty('--theme-text', '#e8eaed');
          root.style.setProperty('--theme-card-background', '#303134');
          root.style.setProperty('--theme-secondary-text', 'rgba(232, 234, 237, 0.7)');
          root.style.setProperty('--theme-border', 'rgba(232, 234, 237, 0.12)');
          root.style.setProperty('--theme-hover', 'rgba(232, 234, 237, 0.08)');
      } else {
          root.style.setProperty('--theme-background', '#ffffff');
          root.style.setProperty('--theme-text', '#202124');
          root.style.setProperty('--theme-card-background', '#f8f9fa');
          root.style.setProperty('--theme-secondary-text', 'rgba(32, 33, 36, 0.7)');
          root.style.setProperty('--theme-border', 'rgba(32, 33, 36, 0.12)');
          root.style.setProperty('--theme-hover', 'rgba(32, 33, 36, 0.08)');
      }

      root.style.setProperty('--theme-is-dark', isDark ? '1' : '0');
      document.body.classList.toggle('dark-theme', isDark);
      document.body.classList.toggle('light-theme', !isDark);

      // 헤더 아이콘 테마 업데이트
      updateHeaderIcons(isDark);
  }
});
