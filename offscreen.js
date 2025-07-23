const CHROME_GROUP_COLORS = {
  blue: [66, 133, 244],
  cyan: [0, 188, 212],
  green: [15, 157, 88],
  grey: [158, 158, 158],
  orange: [255, 109, 0],
  pink: [233, 30, 99],
  purple: [156, 39, 176],
  red: [219, 68, 55],
  yellow: [244, 180, 0]
};

// RGB -> HSL 변환 함수
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // 무채색
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }

  return [h, s, l];
}

// Chrome 색상을 HSL로 변환
const CHROME_GROUP_HSL = Object.fromEntries(
  Object.entries(CHROME_GROUP_COLORS).map(([name, [r, g, b]]) => [name, rgbToHsl(r, g, b)])
);

// 가장 가까운 Chrome 그룹 색상 찾기 (RGB 기준으로 개선)
function getClosestChromeColor(r, g, b) {
  console.log(`Finding closest color for RGB(${r}, ${g}, ${b})`);

  // 먼저 RGB 값으로 직접 매칭 시도
  if (r > 200 && g < 100 && b < 100) return "red";
  if (r < 100 && g > 200 && b < 100) return "green";
  if (r < 100 && g < 100 && b > 200) return "blue";
  if (r > 200 && g > 150 && b < 100) return "orange";
  if (r > 200 && g > 200 && b < 100) return "yellow";
  if (r > 150 && g < 100 && b > 150) return "purple";
  if (r < 100 && g > 150 && b > 150) return "cyan";
  if (r < 150 && g < 100 && b > 100) return "pink";

  // RGB 거리 계산으로 가장 가까운 색상 찾기
  let closestColor = "grey";
  let minDistance = Number.MAX_VALUE;

  for (const [colorName, [cr, cg, cb]] of Object.entries(CHROME_GROUP_COLORS)) {
    // 유클리드 거리 계산
    const distance = Math.sqrt(
      Math.pow(r - cr, 2) +
      Math.pow(g - cg, 2) +
      Math.pow(b - cb, 2)
    );

    console.log(`Distance to ${colorName}: ${distance.toFixed(2)}`);

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = colorName;
    }
  }

  console.log(`Selected color: ${closestColor}`);
  return closestColor;
}

// const CORS_PROXY = "https://cors-anywhere.herokuapp.com/"; // CORS 프록시 URL
// const CORS_PROXY = "https://api.allorigins.win/raw?url="; // CORS 프록시

// 간단한 평균 색상 추출
function extractDominantColor(imageData) {
  const data = imageData.data;
  let r = 0, g = 0, b = 0, count = 0;

  // 투명도가 있는 픽셀 제외하고 평균 색상 계산
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue; // 투명한 픽셀 제외

    const pr = data[i];
    const pg = data[i + 1];
    const pb = data[i + 2];

    // 너무 어둡거나 밝은 색상 제외
    const brightness = (pr + pg + pb) / 3;
    if (brightness < 20 || brightness > 235) continue;

    r += pr;
    g += pg;
    b += pb;
    count++;
  }

  if (count > 0) {
    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);
  } else {
    r = g = b = 128; // 기본 회색
  }

  console.log(`Average color extracted: RGB(${r}, ${g}, ${b})`);
  return [r, g, b];
}

// 여러 favicon URL 시도 (CORS 프록시 포함)
function getFaviconUrls(domain) {
  const corsProxies = [
    "https://api.allorigins.win/raw?url=",
    "https://cors-anywhere.herokuapp.com/",
    "https://proxy.cors.sh/"
  ];

  const directUrls = [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
    `https://www.google.com/s2/favicons?domain=${domain}`,
    `https://favicon.yandex.net/favicon/${domain}`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`
  ];

  const urls = [];

  // 먼저 직접 URL 시도
  urls.push(...directUrls);

  // 그 다음 CORS 프록시를 통한 URL 시도
  for (const proxy of corsProxies) {
    for (const url of directUrls.slice(0, 3)) { // 처음 3개만 프록시로 시도
      urls.push(`${proxy}${encodeURIComponent(url)}`);
    }
  }

  return urls;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fetchFavicon") {
    const domain = message.domain;
    const faviconUrls = getFaviconUrls(domain);

         // 여러 URL을 순차적으로 시도 (개선된 버전)
     async function tryFetchFavicon(urls, index = 0) {
       if (index >= urls.length) {
         throw new Error("All favicon URLs failed");
       }

       const url = urls[index];
       console.log(`Trying favicon URL ${index + 1}/${urls.length}: ${url}`);

       try {
         const controller = new AbortController();
         const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃

         const response = await fetch(url, {
           signal: controller.signal,
           mode: 'cors',
           cache: 'default',
           headers: {
             'Accept': 'image/*',
             'User-Agent': 'Mozilla/5.0 (compatible; SessionVault/1.4.0)'
           }
         });

         clearTimeout(timeoutId);

         if (!response.ok) {
           throw new Error(`HTTP ${response.status}: ${response.statusText}`);
         }

         const contentType = response.headers.get('content-type');
         if (contentType && !contentType.startsWith('image/')) {
           throw new Error(`Invalid content type: ${contentType}`);
         }

         const blob = await response.blob();
         if (blob.size < 50) { // 너무 작은 파일은 제외
           throw new Error(`File too small: ${blob.size} bytes`);
         }

         console.log(`Successfully fetched favicon: ${url} (${blob.size} bytes)`);
         return blob;
       } catch (error) {
         if (error.name === 'AbortError') {
           console.warn(`Timeout for ${url}`);
         } else {
           console.warn(`Failed to fetch ${url}:`, error.message);
         }
         return tryFetchFavicon(urls, index + 1);
       }
     }

    tryFetchFavicon(faviconUrls)
      .then(blob => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(blob);

          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0);

              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const [r, g, b] = extractDominantColor(imageData);

              console.log(`Extracted color for ${domain}: rgb(${r}, ${g}, ${b})`);

              URL.revokeObjectURL(url);
              resolve(getClosestChromeColor(r, g, b));
            } catch (error) {
              reject(error);
            }
          };

          img.onerror = () => reject(new Error("Failed to load favicon image"));
          img.src = url;
        });
      })
      .then(color => {
        console.log(`Final color for ${domain}: ${color}`);
        sendResponse({ color });
      })
            .catch(error => {
        console.error(`Error fetching favicon for ${domain}:`, error);
        // 도메인에 따른 기본 색상 설정 (더 많은 사이트 추가)
        const defaultColors = {
          // 구글 서비스
          'google': 'blue',
          'gmail': 'red',
          'youtube': 'red',
          'drive': 'yellow',
          'docs': 'blue',
          'sheets': 'green',
          'slides': 'yellow',

          // 소셜 미디어
          'facebook': 'blue',
          'twitter': 'blue',
          'instagram': 'purple',
          'linkedin': 'blue',
          'tiktok': 'red',
          'snapchat': 'yellow',
          'discord': 'purple',
          'telegram': 'blue',
          'whatsapp': 'green',

          // 개발/기술
          'github': 'grey',
          'stackoverflow': 'orange',
          'codepen': 'grey',
          'jsfiddle': 'blue',
          'replit': 'orange',
          'vercel': 'grey',
          'netlify': 'cyan',
          'heroku': 'purple',

          // 한국 사이트
          'naver': 'green',
          'daum': 'orange',
          'kakao': 'yellow',
          'coupang': 'red',
          'baemin': 'cyan',
          'yogiyo': 'red',
          'toss': 'blue',
          'kakaopay': 'yellow',
          '11st': 'red',
          'gmarket': 'red',
          'interpark': 'blue',

          // 쇼핑/이커머스
          'amazon': 'orange',
          'ebay': 'yellow',
          'aliexpress': 'orange',
          'shopify': 'green',
          'etsy': 'orange',

          // 엔터테인먼트
          'netflix': 'red',
          'spotify': 'green',
          'apple': 'grey',
          'microsoft': 'blue',
          'steam': 'blue',
          'twitch': 'purple',
          'pornhub': 'orange',
          'xvideos': 'red',

          // 뉴스/정보
          'cnn': 'red',
          'bbc': 'red',
          'reuters': 'orange',
          'nytimes': 'grey',
          'washingtonpost': 'blue',
          'guardian': 'blue',
          'medium': 'grey',
          'reddit': 'orange',

          // 기타
          'paypal': 'blue',
          'stripe': 'purple',
          'slack': 'purple',
          'zoom': 'blue',
          'notion': 'grey',
          'trello': 'blue',
          'asana': 'red',
          'dropbox': 'blue',
          'onedrive': 'blue',
          'icloud': 'blue'
        };

        let defaultColor = defaultColors[domain];

        // 도메인에 특정 키워드가 포함된 경우 색상 추정
        if (!defaultColor) {
          if (domain.includes('google') || domain.includes('gmail')) defaultColor = 'blue';
          else if (domain.includes('youtube')) defaultColor = 'red';
          else if (domain.includes('facebook') || domain.includes('fb')) defaultColor = 'blue';
          else if (domain.includes('instagram')) defaultColor = 'purple';
          else if (domain.includes('twitter')) defaultColor = 'blue';
          else if (domain.includes('github')) defaultColor = 'grey';
          else if (domain.includes('naver')) defaultColor = 'green';
          else if (domain.includes('kakao')) defaultColor = 'yellow';
          else if (domain.includes('amazon')) defaultColor = 'orange';
          else if (domain.includes('netflix')) defaultColor = 'red';
          else if (domain.includes('spotify')) defaultColor = 'green';
          else if (domain.includes('reddit')) defaultColor = 'orange';
          else if (domain.includes('shop') || domain.includes('store')) defaultColor = 'orange';
          else if (domain.includes('blog') || domain.includes('news')) defaultColor = 'grey';
          else if (domain.includes('video') || domain.includes('tv')) defaultColor = 'red';
          else if (domain.includes('music') || domain.includes('sound')) defaultColor = 'green';
          else if (domain.includes('game')) defaultColor = 'blue';
          else if (domain.includes('pay') || domain.includes('bank')) defaultColor = 'blue';
          else defaultColor = 'grey';
        }

        console.log(`Using default color for ${domain}: ${defaultColor}`);
        sendResponse({ color: defaultColor });
      });

    return true; // 비동기 응답을 위해 반드시 true 반환
  }
});

