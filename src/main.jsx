import React from "react";
import ReactDOM from "react-dom/client";
import "./firebaseStorage.js"; // window.storage를 Firestore 버전으로 교체
import AuthGate from "./Auth.jsx";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>
);
