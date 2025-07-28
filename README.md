# SessionVault 🔐

**Powerful Session Management Chrome Extension**

SessionVault는 브라우저 세션을 안전하게 백업하고 복원할 수 있는 강력한 Chrome 확장프로그램입니다. 실수로 닫힌 탭을 즉시 복원하고, 자동 백업된 세션을 효율적으로 관리할 수 있습니다.

## 다운로드 📦

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/mmcddpjlkgbflhcfchenbjebkbhhfepa?style=for-the-badge&logo=googlechrome&logoColor=white&label=CHROME%20WEB%20STORE)](https://chromewebstore.google.com/detail/sessionvault/ibipemjdjplapcgbhnokhopkmonpkfcn)

## 주요 기능 ✨

### 🔐 강력한 세션 관리
- **Recently Closed Sessions**: 실수로 닫힌 탭과 그룹을 즉시 복원
- **Auto-Saved Sessions**: 시간 기반 또는 변경 감지 기반 자동 백업
- **Manual Session Save**: 중요한 작업 세션을 수동으로 저장
- **Selective Restoration**: 개별 탭, 그룹, 전체 세션 단위로 복원
- **Smart Filtering**: 새탭, 내부 페이지 등 불필요한 탭 자동 제외

### 🎯 편리한 접근 방식
- **New Tab Integration**: 새탭에서 바로 세션 관리 및 복원
- **Sidebar Panel**: 확장프로그램 아이콘 클릭으로 사이드바에서 세션 관리
- **Current Tab Redirection**: 새탭에서 복원 시 현재 탭을 활용하여 자연스러운 경험

### 🎨 세련된 사용자 경험
- **Chrome Theme Integration**: 사용자의 Chrome 테마에 완벽 적응
- **Dark/Light Mode**: 시스템 설정에 따른 자동 테마 전환
- **Infinite Scroll**: 대량의 세션 데이터를 효율적으로 탐색 (최대 1000개)
- **Loading Indicators**: 부드러운 로딩 애니메이션과 상태 표시

### 🔍 통합 검색 및 바로가기
- **Google Search Integration**: 새탭에서 바로 검색 가능
- **Search History & Suggestions**: 검색 기록 및 실시간 자동완성
- **Top Sites**: 자주 방문하는 사이트 바로가기
- **Google Apps Menu**: Gmail, Drive, YouTube 등 빠른 접근

### 📋 부가 기능
- **Smart Tab Grouping**: 도메인별 탭 자동 그룹화
- **Window Management**: 키보드 단축키로 윈도우 배치
- **Favicon Integration**: 사이트별 아이콘으로 시각적 구분

## 설치 방법 📥

### Chrome Web Store (권장)
1. [Chrome Web Store 링크](https://chromewebstore.google.com/detail/sessionvault/mmcddpjlkgbflhcfchenbjebkbhhfepa) 방문
2. "Chrome에 추가" 클릭
3. 권한 승인 후 설치 완료

### 개발자 모드 (개발자용)
1. `chrome://extensions/` 페이지 이동
2. "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 프로젝트 폴더 선택

## 사용 방법 🚀

### 세션 복원
1. **새탭에서**: 새 탭을 열어 Recently Closed Sessions 또는 Auto-Saved Sessions에서 복원
2. **사이드바에서**: 확장프로그램 아이콘 클릭하여 사이드바에서 세션 관리
3. **개별 복원**: 특정 탭이나 그룹만 선택하여 복원

### 설정
1. 확장프로그램 아이콘 우클릭 > "옵션"
2. **Auto-Save 설정**: 시간 기반(예: 60초마다) 또는 변경 감지 기반
3. **New Tab Override**: SessionVault 새탭 사용 여부 설정
4. **Detection Options**: 탭 생성, 삭제, URL 변경 감지 설정

## 권한 설명 🔐

- **tabs**: 탭 정보 읽기 및 세션 백업
- **storage**: 세션 데이터 및 설정 저장
- **tabGroups**: 탭 그룹 관리
- **sidePanel**: 사이드바 기능
- **topSites**: 자주 방문하는 사이트 표시
- **search**: Chrome 검색 API 사용

모든 데이터는 사용자 기기에 로컬 저장되며, 외부로 전송되지 않습니다.

## 파일 구조 📂

```
session-vault/
├── manifest.json          # 확장프로그램 설정
├── background.js          # 백그라운드 스크립트 (세션 관리)
├── popup.html/js          # 팝업 UI 및 로직
├── newtab.html/js         # 새탭 페이지
├── sidepanel.html/js      # 사이드바 패널
├── options.html/js        # 설정 페이지
├── offscreen.html/js      # 오프스크린 문서
└── icons/                # 아이콘 파일들
```

## 버전 히스토리 📋

### v1.0.1 (최신)
- 🎯 **무한 스크롤 페이지네이션**: 30개씩 로드, 최대 1000개 지원
- 📱 **사이드바 기능 추가**: 확장프로그램 아이콘 클릭으로 사이드바에서 세션 관리
- 🎨 **Session 복원 UX 개선**: newtab에서 복원 시 현재 탭 활용
- 🔍 **검색 기능 통합**: Google 검색, 검색 기록, 자동완성 제안
- 🌐 **Google Apps 메뉴**: 주요 Google 서비스 빠른 접근
- 📱 **Top Sites 바로가기**: 자주 방문하는 사이트 표시
- 🎨 **Chrome 테마 완전 통합**: 사용자 테마에 자동 적응
- 🌙 **다크모드 깜빡임 수정**: 새탭 로드 시 시각적 문제 해결
- 🚫 **스마트 탭 필터링**: 새탭, Chrome 내부 페이지 등 불필요한 탭 자동 제외
- ✨ **헤더 아이콘 Hover 효과**: Flask, Google Apps 아이콘에 시각적 피드백 추가
- 🐛 **Auto-save 로직 개선**: Time-based 모드 안정성 향상

### v1.0.0
- 🔐 **핵심 세션 관리 기능**: Recently Closed Sessions, Auto-Saved Sessions
- 📋 **수동 세션 저장**: 중요한 작업 세션 보존
- 🎯 **선택적 복원**: 탭, 그룹, 전체 세션 단위 복원
- 📦 **기본 탭 그룹핑**: 도메인별 자동 그룹화
- 🆕 **새탭 페이지**: Google 스타일 인터페이스로 세션 관리

---

**SessionVault** - Your browsing sessions, safely vaulted! 🔐
