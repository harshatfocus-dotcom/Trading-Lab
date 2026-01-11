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

const MODEL = { mu: 0.00002, sigma: 0.0005, noise: 0.0003, max: 0.015 };

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
    if (!window.confirm("Reset entire session?")) return;
    const batch = writeBatch(db);
    const users = await getDocs(usersRef);
    users.forEach(d => batch.delete(d.ref));
    batch.set(marketRef, { stocks: initStocks(), time: 0, status: "WAITING" });
    await batch.commit();
    window.location.reload();
  };

  const exportCSV = () => {
    let rows = ["time,symbol,price"];
    Object.values(market).forEach(s =>
      s.history.forEach(h => rows.push(`${h.t},${s.symbol},${h.p.toFixed(2)}`))
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "market.csv";
    a.click();
  };

  /* ===== UI ===== */

  if (!authUser)
    return <div className="h-screen bg-black text-white flex items-center justify-center">Connecting…</div>;

  if (!userData)
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <form onSubmit={login} className="bg-zinc-900 p-6 rounded-xl space-y-3 w-72">
          <h2 className="text-white font-bold text-lg">Enter Trading Lab</h2>
          <input name="name" placeholder="Name" required className="w-full p-2 rounded bg-zinc-800 text-white" />
          <input name="reg" placeholder="Reg No" required className="w-full p-2 rounded bg-zinc-800 text-white" />
          <button className="w-full bg-green-600 hover:bg-green-500 p-2 rounded text-white">
            Enter
          </button>
        </form>
      </div>
    );

  const viewT = replayT ?? time;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Trading Lab <ShieldCheck className="text-green-500" />
        </h1>
        <div className="flex gap-2">
          <button onClick={start} className="bg-green-600 px-3 py-2 rounded"><Play /></button>
          <button onClick={pause} className="bg-yellow-600 px-3 py-2 rounded"><Pause /></button>
          <button onClick={reset} className="bg-red-600 px-3 py-2 rounded"><RotateCcw /></button>
          <button onClick={exportCSV} className="bg-zinc-700 px-3 py-2 rounded"><Download /></button>
        </div>
      </header>

      <div className="mb-6">
        <input
          type="range"
          min="0"
          max={time}
          value={viewT}
          onChange={e => setReplayT(+e.target.value)}
          className="w-full accent-green-500"
        />
        <div className="text-sm text-zinc-400 mt-1">Replay time: {viewT}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.values(market).map(s => {
          const h = s.history.find(x => x.t === viewT) || s.history.at(-1);
          return (
            <div
              key={s.symbol}
              className="bg-zinc-900 rounded-xl p-4 shadow-lg hover:shadow-green-500/20 transition"
            >
              <div className="text-zinc-400 text-sm">{s.symbol}</div>
              <div className="text-2xl font-bold mt-1">₹{h.p.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
