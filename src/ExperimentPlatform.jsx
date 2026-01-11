import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Activity, Settings, Play, Pause, Lock, User, Trophy, Briefcase,
  Layout, Globe, Smartphone, Tv, Youtube, Download, Trash2,
  LogOut, History, CheckCircle, AlertCircle, MessageCircle,
  Share2, ThumbsUp, StopCircle, WifiOff, X
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
  addDoc,
  getDocs,
  writeBatch
} from "firebase/firestore";

/* ================= FIREBASE CONFIG ================= */

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDQzza05lJO_5xR_a2dPKofIJ6Do7cXY6w",
  authDomain: "tradinglab-6b948.firebaseapp.com",
  projectId: "tradinglab-6b948",
  storageBucket: "tradinglab-6b948.firebasestorage.app",
  messagingSenderId: "769994506304",
  appId: "1:769994506304:web:121a856d62dd98a1c65fa5",
  measurementId: "G-8WH9VNWJN6"
};

const APP_ID = "behavioral-lab-session";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= UTILITIES ================= */

const generateGaussian = (mean, std) => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std + mean;
};

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/* ================= MARKET CONFIG ================= */

const MODEL = {
  mu: 0.00002,
  sigma: 0.0005,
  noise: 0.0003,
  decay: 0.15,
  max: 0.015,
  loss: 1.25,
  gain: 0.85
};

const INITIAL_CASH = 1_000_000;

const STOCKS = [
  { symbol: "TCS", name: "TCS", price: 3421 },
  { symbol: "INFY", name: "Infosys", price: 1450 },
  { symbol: "HDFCBANK", name: "HDFC Bank", price: 1530 },
  { symbol: "ICICIBANK", name: "ICICI Bank", price: 960 }
];

const initStocks = () =>
  Object.fromEntries(
    STOCKS.map(s => [
      s.symbol,
      { ...s, currentPrice: s.price, history: [{ price: s.price }] }
    ])
  );

/* ================= COMPONENT ================= */

export default function ExperimentPlatform() {
  const [authUser, setAuthUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [stocks, setStocks] = useState(initStocks());
  const [cash, setCash] = useState(INITIAL_CASH);
  const [portfolio, setPortfolio] = useState({});
  const [news, setNews] = useState([]);
  const [time, setTime] = useState(0);
  const [sessionStatus, setSessionStatus] = useState("WAITING");
  const engine = useRef({ stocks: initStocks(), news: [], time: 0 });

  /* ===== AUTH ===== */

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsub = onAuthStateChanged(auth, user => {
      if (user) setAuthUser(user);
    });
    return () => unsub();
  }, []);

  /* ===== MARKET SYNC ===== */

  useEffect(() => {
    if (!authUser) return;

    const ref = doc(db, "artifacts", APP_ID, "public", "data", "market_state", "main");
    return onSnapshot(ref, snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setStocks(d.stocks || initStocks());
      setNews(d.newsList || []);
      setTime(d.time || 0);
      setSessionStatus(d.sessionStatus || "WAITING");
      engine.current = {
        stocks: d.stocks || initStocks(),
        news: d.newsList || [],
        time: d.time || 0
      };
    });
  }, [authUser]);

  /* ===== ENGINE LOOP (ADMIN OR SINGLE HOST) ===== */

  useEffect(() => {
    if (sessionStatus !== "LIVE") return;

    const id = setInterval(() => {
      const T = engine.current.time + 1;
      const next = { ...engine.current.stocks };

      Object.values(next).forEach(s => {
        const r =
          generateGaussian(MODEL.mu, MODEL.sigma) +
          generateGaussian(0, MODEL.noise);
        s.currentPrice *= 1 + clamp(r, -MODEL.max, MODEL.max);
        s.history = [...s.history.slice(-60), { price: s.currentPrice }];
      });

      setDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "market_state", "main"),
        { stocks: next, time: T, sessionStatus: "LIVE" },
        { merge: true }
      );
    }, 1000);

    return () => clearInterval(id);
  }, [sessionStatus]);

  /* ===== LOGIN ===== */

  const login = async ({ name, regNo }) => {
    setUserData({ name, regNo });
    await setDoc(
      doc(db, "artifacts", APP_ID, "public", "data", "users", authUser.uid),
      { uid: authUser.uid, name, regNo, cash: INITIAL_CASH, portfolio: {} },
      { merge: true }
    );
  };

  /* ===== UI ===== */

  if (!authUser) {
    return <div className="p-10 text-lg">Connecting to Trading Lab…</div>;
  }

  if (!userData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <form
          onSubmit={e => {
            e.preventDefault();
            login({
              name: e.target.name.value,
              regNo: e.target.reg.value
            });
          }}
          className="bg-white p-6 shadow rounded"
        >
          <input name="name" placeholder="Name" required className="border p-2 mb-2 w-full" />
          <input name="reg" placeholder="Reg No" required className="border p-2 mb-2 w-full" />
          <button className="bg-black text-white w-full p-2">Enter</button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        Trading Lab <CheckCircle className="text-green-500" />
      </h1>
      <p className="text-sm text-gray-500">User: {userData.name}</p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {Object.values(stocks).map(s => (
          <div key={s.symbol} className="border p-4 rounded">
            <h3 className="font-bold">{s.symbol}</h3>
            <p>₹{s.currentPrice.toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          onClick={() => setSessionStatus("LIVE")}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Start Market
        </button>
      </div>
    </div>
  );
}
