import React, { useState, useEffect, useRef } from "react";
import {
  Play, Pause, RotateCcw, Download, ShieldCheck
} from "lucide-react";

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp
} from "firebase/firestore";

/* ================= FIREBASE ================= */

const firebaseConfig = {
  apiKey: "AIzaSyDQzza05lJO_5xR_a2dPKofIJ6Do7cXY6w",
  authDomain: "tradinglab-6b948.firebaseapp.com",
  projectId: "tradinglab-6b948",
  storageBucket: "tradinglab-6b948.firebasestorage.app",
  messagingSenderId: "769994506304",
  appId: "1:769994506304:web:121a856d62dd98a1c65fa5"
};

const APP_ID = "trading-lab-prod";
const MAX_USERS = 50;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= MARKET ================= */

const MODEL = {
  mu: 0.00002,
  sigma: 0.0005,
  noise: 0.0003,
  max: 0.015
};

const STOCKS = [
  { symbol: "TCS", price: 3421 },
  { symbol: "INFY", price: 1450 },
  { symbol: "HDFCBANK", price: 1530 },
  { symbol: "ICICIBANK", price: 960 }
];

const initStocks = () =>
  Object.fromEntries(
    STOCKS.map(s => [
      s.symbol,
      { ...s, currentPrice: s.price, history: [{ t: 0, p: s.price }] }
    ])
  );

const gaussian = (m, s) =>
  Math.sqrt(-2 * Math.log(Math.random())) *
  Math.cos(2 * Math.PI * Math.random()) * s + m;

/* ================= COMPONENT ================= */

export default function ExperimentPlatform() {
  const [authUser, setAuthUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [market, setMarket] = useState(initStocks());
  const [time, setTime] = useState(0);
  const [status, setStatus] = useState("WAITING");
  const [replayT, setReplayT] = useState(null);
  const engine = useRef(null);

  const marketRef = doc(db, "artifacts", APP_ID, "public", "market", "main");
  const usersRef = collection(db, "artifacts", APP_ID, "public", "users");

  /* ===== AUTH ===== */

  useEffect(() => {
    signInAnonymously(auth);
    return onAuthStateChanged(auth, u => u && setAuthUser(u));
  }, []);

  /* ===== USER LIMIT ===== */

  useEffect(() => {
    if (!authUser) return;

    (async () => {
      const snap = await getDocs(usersRef);
      if (snap.size >= MAX_USERS) {
        alert("Session full (50 users max)");
        return;
      }
    })();
  }, [authUser]);

  /* ===== MARKET SYNC ===== */

  useEffect(() => {
    return onSnapshot(marketRef, snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setMarket(d.stocks);
      setTime(d.time);
      setStatus(d.status);
    });
  }, []);

  /* ===== ENGINE ===== */

  useEffect(() => {
    if (status !== "LIVE") return;

    engine.current = setInterval(async () => {
      const next = { ...market };
      Object.values(next).forEach(s => {
        const r = gaussian(MODEL.mu, MODEL.sigma) + gaussian(0, MODEL.noise);
        s.currentPrice *= 1 + Math.max(Math.min(r, MODEL.max), -MODEL.max);
        s.history.push({ t: time + 1, p: s.currentPrice });
      });

      await setDoc(marketRef, {
        stocks: next,
        time: time + 1,
        status: "LIVE",
        updated: serverTimestamp()
      });
    }, 1000);

    return () => clearInterval(engine.current);
  }, [status, market, time]);

  /* ===== LOGIN ===== */

  const login = async e => {
    e.preventDefault();
    const name = e.target.name.value;
    const reg = e.target.reg.value;

    await setDoc(doc(usersRef, authUser.uid), {
      uid: authUser.uid,
      name,
      reg,
      joined: serverTimestamp()
    });

    setUserData({ name });
  };

  /* ===== ADMIN ===== */

  const start = () => setDoc(marketRef, { status: "LIVE" }, { merge: true });
  const pause = () => setDoc(marketRef, { status: "PAUSED" }, { merge: true });

  const reset = async () => {
    if (!window.confirm("RESET ENTIRE SESSION?")) return;
    const batch = writeBatch(db);

    const users = await getDocs(usersRef);
    users.forEach(d => batch.delete(d.ref));

    batch.set(marketRef, {
      stocks: initStocks(),
      time: 0,
      status: "WAITING"
    });

    await batch.commit();
    window.location.reload();
  };

  /* ===== EXPORT ===== */

  const exportCSV = () => {
    let rows = ["time,symbol,price"];
    Object.values(market).forEach(s =>
      s.history.forEach(h =>
        rows.push(`${h.t},${s.symbol},${h.p.toFixed(2)}`)
      )
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "market.csv";
    a.click();
  };

  /* ===== UI ===== */

  if (!authUser) return <div className="p-10">Connecting…</div>;

  if (!userData)
    return (
      <form onSubmit={login} className="p-10">
        <input name="name" placeholder="Name" required />
        <input name="reg" placeholder="Reg No" required />
        <button>Enter</button>
      </form>
    );

  const viewT = replayT ?? time;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl flex items-center gap-2">
        Trading Lab <ShieldCheck className="text-green-500" />
      </h1>

      <div className="flex gap-2">
        <button onClick={start}><Play /></button>
        <button onClick={pause}><Pause /></button>
        <button onClick={reset}><RotateCcw /></button>
        <button onClick={exportCSV}><Download /></button>
      </div>

      <input
        type="range"
        min="0"
        max={time}
        value={viewT}
        onChange={e => setReplayT(+e.target.value)}
      />

      <div className="grid grid-cols-2 gap-4">
        {Object.values(market).map(s => {
          const h = s.history.find(x => x.t === viewT) || s.history.at(-1);
          return (
            <div key={s.symbol} className="border p-3">
              <b>{s.symbol}</b>
              <div>₹{h.p.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
