// 내용물을 임베드 크기에 꽉 맞추기: 100px 기준으로 잰 뒤 비율만큼 글자 크기를 바꿈
// (모든 치수를 em으로 잡은 요소에 사용 → 여백 없이 가로나 세로 중 한쪽을 가득 채움)
export function fit(el, { pad = 4, max = 2000 } = {}) {
  el.style.fontSize = '100px';
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const scale = Math.min((innerWidth - pad * 2) / w, (innerHeight - pad * 2) / h);
  el.style.fontSize = `${Math.min(max, Math.max(1, 100 * scale))}px`;
}

// 창 크기·웹폰트 로딩이 바뀔 때마다 layout()을 다시 실행
export function autoFit(layout) {
  addEventListener('resize', layout);
  document.fonts?.ready.then(layout);
  layout();
}
