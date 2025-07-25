// 페이지 로드 즉시 테마 적용
(async () => {
  try {
    await applyThemeImmediately();
  } catch (error) {
    console.error('Error applying immediate theme:', error);
  }
})();

// 즉시 테마 적용 함수 (사이드바용 간소화)
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
      const rgb = bgColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
        isDarkTheme = brightness < 128;
      }
    } else {
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
                    (isDarkTheme ? '#e8eaed' : '#202124');

    // 사이드바 배경 직접 적용
    document.body.style.setProperty('background', backgroundColor, 'important');
    document.body.style.setProperty('color', textColor, 'important');

    // 카드 배경색과 기타 변수 설정
    const cardBg = isDarkTheme ? '#303134' : '#ffffff';
    const secondaryText = isDarkTheme ? 'rgba(232, 234, 237, 0.7)' : '#666';
    const borderColor = isDarkTheme ? 'rgba(95, 99, 104, 0.3)' : 'rgba(0, 0, 0, 0.1)';
    const hoverColor = isDarkTheme ? 'rgba(232, 234, 237, 0.1)' : '#f8f9fa';

    root.style.setProperty('--theme-text', textColor);
    root.style.setProperty('--theme-card-background', cardBg);
    root.style.setProperty('--theme-secondary-text', secondaryText);
    root.style.setProperty('--theme-border', borderColor);
    root.style.setProperty('--theme-hover', hoverColor);

    // 다크/라이트 테마 클래스 설정
    document.body.classList.toggle('dark-theme', isDarkTheme);
    document.body.classList.toggle('light-theme', !isDarkTheme);

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

  // CSS 변수 설정
  root.style.setProperty('--theme-text', theme.textColor);
  root.style.setProperty('--theme-card-background', theme.cardBg);
  root.style.setProperty('--theme-secondary-text', theme.secondaryText);
  root.style.setProperty('--theme-border', theme.isDarkTheme ? 'rgba(95, 99, 104, 0.3)' : 'rgba(0, 0, 0, 0.1)');
  root.style.setProperty('--theme-hover', theme.isDarkTheme ? 'rgba(232, 234, 237, 0.1)' : '#f8f9fa');

  // 테마 클래스 설정
  document.body.classList.toggle('dark-theme', theme.isDarkTheme);
  document.body.classList.toggle('light-theme', !theme.isDarkTheme);
}

// 시스템 테마 적용 (fallback)
function applySystemTheme() {
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const root = document.documentElement;

  if (isDark) {
    document.body.style.setProperty('background', '#202124', 'important');
    document.body.style.setProperty('color', '#e8eaed', 'important');
    root.style.setProperty('--theme-text', '#e8eaed');
    root.style.setProperty('--theme-card-background', '#303134');
    root.style.setProperty('--theme-secondary-text', 'rgba(232, 234, 237, 0.7)');
    root.style.setProperty('--theme-border', 'rgba(95, 99, 104, 0.3)');
    root.style.setProperty('--theme-hover', 'rgba(232, 234, 237, 0.1)');
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  } else {
    document.body.style.setProperty('background', '#ffffff', 'important');
    document.body.style.setProperty('color', '#202124', 'important');
    root.style.setProperty('--theme-text', '#202124');
    root.style.setProperty('--theme-card-background', '#ffffff');
    root.style.setProperty('--theme-secondary-text', '#666');
    root.style.setProperty('--theme-border', 'rgba(0, 0, 0, 0.1)');
    root.style.setProperty('--theme-hover', '#f8f9fa');
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const closedSessionsContainer = document.getElementById('closedSessions');
  const autoSavedSessionsContainer = document.getElementById('autoSavedSessions');

  // Chrome 테마 적용
  await applyTheme();

  // 일괄 제거 버튼 이벤트 리스너 추가
  document.querySelectorAll('.clear-all-btn').forEach(btn => {
      btn.addEventListener('click', handleClearAll);
  });

  // 초기 로드
  await loadAllSessions();

  async function loadAllSessions() {
      try {
          const [closedSessions, autoSavedSessions] = await Promise.all([
              loadClosedSessions(),
              loadAutoSavedSessions()
          ]);

          renderSessions(closedSessionsContainer, closedSessions, 'closed');
          renderSessions(autoSavedSessionsContainer, autoSavedSessions, 'auto');
      } catch (error) {
          console.error('Error loading sessions:', error);
      }
  }

  async function loadClosedSessions() {
      try {
          const result = await chrome.storage.local.get(['closedSessions']);
          return result.closedSessions || [];
      } catch (error) {
          console.error('Error loading closed sessions:', error);
          return [];
      }
  }

  async function loadAutoSavedSessions() {
      try {
          const result = await chrome.storage.local.get(['autoSavedSessions']);
          return result.autoSavedSessions || [];
      } catch (error) {
          console.error('Error loading auto-saved sessions:', error);
          return [];
      }
  }

  function renderSessions(container, sessions, type) {
      if (sessions.length === 0) {
          container.innerHTML = `
              <div class="no-sessions">
                  ${type === 'closed' ? 'No recently closed sessions' : 'No auto-saved sessions'}
              </div>
          `;
          return;
      }

      if (type === 'closed') {
          // 닫힌 세션은 개별 아이템으로 렌더링
          container.innerHTML = sessions.map(session => createClosedSessionItem(session)).join('');

          // 닫힌 세션 아이템 이벤트 리스너
          container.querySelectorAll('.closed-tab-item').forEach(item => {
              item.addEventListener('click', handleClosedTabRestore);
          });

          container.querySelectorAll('.delete-closed-btn').forEach(btn => {
              btn.addEventListener('click', handleClosedItemDelete);
          });
      } else {
          // 일반 세션은 기존 방식으로 렌더링
          container.innerHTML = sessions.map(session => createSessionCard(session, type)).join('');

          // 이벤트 리스너 추가
          container.querySelectorAll('.session-header').forEach(header => {
              header.addEventListener('click', toggleSessionContent);
          });

          container.querySelectorAll('.tab-item').forEach(item => {
              item.addEventListener('click', handleTabRestore);
          });

          container.querySelectorAll('.group-item').forEach(item => {
              item.addEventListener('click', handleGroupRestore);
          });

          container.querySelectorAll('.restore-btn').forEach(btn => {
              btn.addEventListener('click', handleSessionRestore);
          });

          container.querySelectorAll('.delete-session-btn').forEach(btn => {
              btn.addEventListener('click', handleSessionDelete);
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
                      <div class="session-time">${date} ${time}</div>
                      <div class="session-info">
                          📑 ${session.tabCount} tabs • 📁 ${session.groupCount} groups
                          ${session.windowCount > 1 ? ` • 🪟 ${session.windowCount} windows` : ''}
                      </div>
                  </div>
                  <div class="session-header-right">
                      <button class="delete-session-btn" data-session-id="${session.id}" data-type="${type}" title="Delete session">🗑️</button>
                  </div>
              </div>

              <div class="session-content">
                  <div class="tabs-groups-container">
                      ${ungroupedTabs.length > 0 ? `
                      <div class="tabs-section">
                          <h4>📑 Individual Tabs (${ungroupedTabs.length})</h4>
                          <div class="tabs-list">
                              ${ungroupedTabs.map(tab => createTabItem(tab)).join('')}
                          </div>
                      </div>
                      ` : ''}

                      ${session.groupCount > 0 ? `
                      <div class="groups-section">
                          <h4>📁 Tab Groups (${session.groupCount})</h4>
                          <div class="groups-list">
                              ${session.groups.map(group => createGroupItem(group, tabsByGroup.get(group.id) || [])).join('')}
                          </div>
                      </div>
                      ` : ''}
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

      // 모든 닫힌 세션을 개별 탭으로 렌더링
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
          await chrome.tabs.create({
              url: tabUrl,
              active: true
          });

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
              openInNewWindow: false
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
              openInNewWindow
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
          padding: 8px 12px;
          border-radius: 4px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          font-size: 12px;
          max-width: 250px;
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
          await chrome.tabs.create({ url: tabUrl });
          showNotification('Tab restored successfully!');
      } catch (error) {
          console.error('Error restoring closed tab:', error);
          showNotification('Failed to restore tab', 'error');
      }
  }

  // 닫힌 아이템 삭제
  async function handleClosedItemDelete(event) {
      event.stopPropagation();

      const btn = event.target;
      const sessionId = btn.dataset.sessionId;
      const item = btn.closest('.closed-tab-item');

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

  function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
  }

  // ============== Chrome Theme Integration ==============

  async function applyTheme() {
      try {
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

          // 카드 배경 색상 설정
          const cardBackground = colors.toolbar ||
                               adjustBrightness(backgroundColor, isDarkTheme ? 15 : -5);

          // 보조 텍스트 색상
          const secondaryTextColor = adjustOpacity(textColor, 0.7);

          // 구분선 색상
          const borderColor = adjustOpacity(textColor, 0.12);

          // 호버 색상
          const hoverColor = adjustOpacity(textColor, 0.08);

          // 사이드바 배경에 직접 적용
          document.body.style.setProperty('background', backgroundColor, 'important');
          document.body.style.setProperty('color', textColor, 'important');

          // CSS 변수 설정
          root.style.setProperty('--theme-background', backgroundColor);
          root.style.setProperty('--theme-text', textColor);
          root.style.setProperty('--theme-card-background', cardBackground);
          root.style.setProperty('--theme-secondary-text', secondaryTextColor);
          root.style.setProperty('--theme-border', borderColor);
          root.style.setProperty('--theme-hover', hoverColor);

          // 테마 클래스 추가
          document.body.classList.toggle('dark-theme', isDarkTheme);
          document.body.classList.toggle('light-theme', !isDarkTheme);

      } catch (error) {
          console.error('Error applying theme:', error);
          applyDefaultTheme();
      }
  }

  function applyDefaultTheme() {
      console.log('Applying default theme');
      const root = document.documentElement;
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (isDark) {
          document.body.style.setProperty('background', '#202124', 'important');
          document.body.style.setProperty('color', '#e8eaed', 'important');
          root.style.setProperty('--theme-text', '#e8eaed');
          root.style.setProperty('--theme-card-background', '#303134');
          root.style.setProperty('--theme-secondary-text', 'rgba(232, 234, 237, 0.7)');
          root.style.setProperty('--theme-border', 'rgba(95, 99, 104, 0.3)');
          root.style.setProperty('--theme-hover', 'rgba(232, 234, 237, 0.1)');
          document.body.classList.add('dark-theme');
          document.body.classList.remove('light-theme');
      } else {
          document.body.style.setProperty('background', '#ffffff', 'important');
          document.body.style.setProperty('color', '#202124', 'important');
          root.style.setProperty('--theme-text', '#202124');
          root.style.setProperty('--theme-card-background', '#ffffff');
          root.style.setProperty('--theme-secondary-text', '#666');
          root.style.setProperty('--theme-border', 'rgba(0, 0, 0, 0.1)');
          root.style.setProperty('--theme-hover', '#f8f9fa');
          document.body.classList.add('light-theme');
          document.body.classList.remove('dark-theme');
      }
  }

  function isDarkMode(colors) {
      const bgColor = colors.ntp_background || colors.frame;
      if (!bgColor) return false;

      const rgb = hexToRgb(bgColor);
      if (!rgb) return false;

      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      return brightness < 128;
  }

  function hexToRgb(hex) {
      if (!hex) return null;

      const cleanHex = hex.replace('#', '');
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
});
