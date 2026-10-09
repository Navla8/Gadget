// 모든 모듈이 공유하는 URL 옵션 처리
//   ?theme=auto|light|dark   글자색 테마 (기본 auto = OS/브라우저 설정)
//   ?accent=c8553d           포인트 색 (# 없이 hex)
//   ?scheme=light|dark       배경이 불투명하게 보일 때만 사용 (README 참고)
export const params = new URLSearchParams(location.search);

export function param(name, fallback) {
  const v = params.get(name);
  return v === null || v === '' ? fallback : v;
}

export function numParam(name, fallback) {
  const n = Number(params.get(name));
  return params.has(name) && Number.isFinite(n) ? n : fallback;
}

const root = document.documentElement;

const theme = param('theme', 'auto');
if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;

const accent = param('accent', '');
if (/^[0-9a-f]{3,8}$/i.test(accent)) root.style.setProperty('--accent', `#${accent}`);

const scheme = param('scheme', '');
if (scheme === 'light' || scheme === 'dark') root.style.colorScheme = scheme;

// 숨겨졌다가 다시 보일 때(최소화 해제, 탭 복귀) 즉시 다시 그리기
export function onVisible(fn) {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fn();
  });
}

export const pad = (n) => String(n).padStart(2, '0');
