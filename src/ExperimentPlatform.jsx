import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDQzza05lJO_5xR_a2dPKofIJ6Do7cXY6w",
  authDomain: "tradinglab-6b948.firebaseapp.com",
  projectId: "tradinglab-6b948",
  storageBucket: "tradinglab-6b948.firebasestorage.app",
  messagingSenderId: "769994506304",
  appId: "1:769994506304:web:121a856d62dd98a1c65fa5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function ExperimentPlatform() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    signInAnonymously(auth);
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (!user) {
    return <div style={{ padding: 40 }}>Signing in…</div>;
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Trading Lab Loaded ✅</h1>
      <p>User ID:</p>
      <code>{user.uid}</code>
    </div>
  );
}
