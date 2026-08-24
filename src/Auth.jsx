import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebaseStorage.js";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = 확인중, null = 로그아웃 상태
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요.");
    }
  };

  if (user === undefined) {
    return <div style={styles.centerMsg}>확인 중…</div>;
  }

  if (user === null) {
    return (
      <div style={styles.loginWrap}>
        <form onSubmit={handleLogin} style={styles.loginBox}>
          <div style={styles.loginTitle}>연차 원장 로그인</div>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...styles.input, marginBottom: 14 }}
          />
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.button}>로그인</button>
          <div style={styles.hint}>
            계정은 Firebase 콘솔 → Authentication → 사용자에서 관리자가 미리 추가해둬야 해요.
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.topBar}>
        {user.email} 로그인됨 ·{" "}
        <button onClick={() => signOut(auth)} style={styles.logoutBtn}>
          로그아웃
        </button>
      </div>
      {children}
    </div>
  );
}

const styles = {
  centerMsg: {
    padding: 40, textAlign: "center", fontFamily: "sans-serif", color: "#5B6663",
  },
  loginWrap: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#EFF3F1", fontFamily: "sans-serif",
  },
  loginBox: {
    background: "#fff", padding: 28, borderRadius: 10, width: 280,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)", border: "1px solid #C9D2CC",
  },
  loginTitle: { fontWeight: 700, fontSize: 16, marginBottom: 16, color: "#1E2A28" },
  input: {
    width: "100%", boxSizing: "border-box", padding: 9, marginBottom: 8,
    border: "1px solid #C9D2CC", borderRadius: 6, fontSize: 13.5,
  },
  error: { color: "#B4553F", fontSize: 12, marginBottom: 10, lineHeight: 1.5 },
  button: {
    width: "100%", padding: 10, background: "#2F6F62", color: "#fff",
    border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13.5,
  },
  hint: { fontSize: 10.5, color: "#8A968F", marginTop: 12, lineHeight: 1.5 },
  topBar: {
    display: "flex", justifyContent: "flex-end", padding: "8px 16px",
    fontSize: 11.5, color: "#5B6663", fontFamily: "sans-serif", background: "#EFF3F1",
  },
  logoutBtn: {
    background: "none", border: "none", color: "#B4553F", cursor: "pointer",
    marginLeft: 4, fontSize: 11.5, padding: 0,
  },
};
