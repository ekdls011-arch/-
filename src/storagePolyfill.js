// Claude 아티팩트의 window.storage API를 실제 배포 환경(브라우저 localStorage)에서도
// 동일한 코드로 쓸 수 있도록 흉내낸 얇은 폴리필입니다.
//
// 주의: localStorage는 "이 브라우저"에만 저장됩니다. 즉 지금 구조 그대로는
// '공유 모드'를 켜도 실제로는 기기마다 데이터가 따로 저장됩니다.
// 여러 사람이 진짜로 같은 데이터를 보게 하려면 Firebase, Supabase 같은
// 백엔드로 이 부분만 교체하면 됩니다 (App.jsx 코드는 그대로 두고 이 파일만 바꾸면 됨).

function keyFor(key, shared) {
  return shared ? `shared:${key}` : `local:${key}`;
}

const storage = {
  async get(key, shared = false) {
    try {
      const raw = window.localStorage.getItem(keyFor(key, shared));
      if (raw === null) return null;
      return { key, value: raw, shared };
    } catch (e) {
      throw e;
    }
  },
  async set(key, value, shared = false) {
    try {
      window.localStorage.setItem(keyFor(key, shared), value);
      return { key, value, shared };
    } catch (e) {
      return null;
    }
  },
  async delete(key, shared = false) {
    try {
      window.localStorage.removeItem(keyFor(key, shared));
      return { key, deleted: true, shared };
    } catch (e) {
      return null;
    }
  },
  async list(prefix = "", shared = false) {
    const targetPrefix = keyFor(prefix, shared);
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(targetPrefix)) keys.push(k.replace(shared ? "shared:" : "local:", ""));
    }
    return { keys, prefix, shared };
  },
};

if (typeof window !== "undefined") {
  window.storage = storage;
}

export default storage;
