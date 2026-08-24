// window.storage API(get/set/delete/list)를 Firestore로 구현합니다.
// App.jsx는 이 파일이 무엇으로 구현되어 있는지 몰라도 되도록, 원래
// 아티팩트와 동일한 함수 시그니처를 그대로 맞췄습니다.
//
// 저장 위치
//  - 개인 데이터(shared=false): users/{내 uid}/data/{key}
//  - 공유 데이터(shared=true):  shared/{key}   ← 로그인한 모든 사람이 함께 봄

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);

function currentUid() {
  return auth.currentUser ? auth.currentUser.uid : null;
}

function docRef(key, shared) {
  if (shared) return doc(db, "shared", key);
  const uid = currentUid();
  if (!uid) throw new Error("로그인이 필요합니다.");
  return doc(db, "users", uid, "data", key);
}

const storage = {
  async get(key, shared = false) {
    const ref = docRef(key, shared);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { key, value: snap.data().value, shared };
  },
  async set(key, value, shared = false) {
    const ref = docRef(key, shared);
    await setDoc(ref, { value, updatedAt: Date.now() });
    return { key, value, shared };
  },
  async delete(key, shared = false) {
    const ref = docRef(key, shared);
    await deleteDoc(ref);
    return { key, deleted: true, shared };
  },
  async list(prefix = "", shared = false) {
    const uid = currentUid();
    const colRef = shared ? collection(db, "shared") : collection(db, "users", uid, "data");
    const snaps = await getDocs(colRef);
    const keys = [];
    snaps.forEach((d) => {
      if (d.id.startsWith(prefix)) keys.push(d.id);
    });
    return { keys, prefix, shared };
  },
};

if (typeof window !== "undefined") {
  window.storage = storage;
}

export default storage;
