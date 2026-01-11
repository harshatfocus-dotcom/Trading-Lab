import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity, Settings, Play, Pause, TrendingUp, TrendingDown,
  Lock, ChevronDown, ChevronUp, User, Trophy, Briefcase,
  Layout, Search, Globe, Smartphone, Tv, Youtube, Users,
  Download, Trash2, LogOut, FileText, History, CheckCircle, AlertCircle,
  MessageCircle, Share2, MoreHorizontal, Bell, ThumbsUp, StopCircle, RefreshCw,
  Wifi, WifiOff, X
} from 'lucide-react';

/* =========================
   FIREBASE (SAFE FOR VERCEL)
   ========================= */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';

/* 🔴 REPLACE WITH YOUR REAL FIREBASE VALUES */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================
   SAFE CONSTANTS
   ========================= */

const APP_ID = "behavioral-lab-session";

/* =========================
   MATH UTILITIES
   ========================= */

const generateGaussian = (mean, stdDev) => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdDev + mean;
};

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

/* =========================
   MODEL CONFIG
   ========================= */

const MODEL_CONFIG = {
  mu: 0.00002,
  sigma: 0.0005,
  noiseSigma: 0.0003,
  decayLambda: 0.15,
  maxChange: 0.015,
  lossAversion: 1.25,
  gainDampener: 0.85,
  reversionFactor: 0.05
};

/* =========================
   DATA
   ========================= */

const INDUSTRIES = ['ENERGY', 'IT', 'BANKING', 'FMCG', 'TELECOM', 'AUTO'];

const INITIAL_STOCKS = [
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', price: 860, industry: 'TELECOM' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1530, industry: 'BANKING' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', price: 2500, industry: 'FMCG' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 960, industry: 'BANKING' },
  { symbol: 'INFY', name: 'Infosys', price: 1450, industry: 'IT' },
  { symbol: 'ITC', name: 'ITC Limited', price: 440, industry: 'FMCG' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', price: 1780, industry: 'BANKING' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2340, industry: 'ENERGY' },
  { symbol: 'SBIN', name: 'State Bank of India', price: 570, industry: 'BANKING' },
  { symbol: 'TCS', name: 'Tata Consultancy Svcs', price: 3421, industry: 'IT' }
];

const INITIAL_CASH = 1_000_000;

const getInitialStockState = () => {
  const state = {};
  INITIAL_STOCKS.forEach(s => {
    state[s.symbol] = {
      ...s,
      currentPrice: s.price,
      history: Array(60).fill({ price: s.price })
    };
  });
  return state;
};

/* =========================
   MAIN COMPONENT
   ========================= */

export default function ExperimentPlatform() {
  const [authUser, setAuthUser] = useState(null);
  const [userData, setUserData] = useState(null);

  const [stocks, setStocks] = useState(getInitialStockState());
  const [cash, setCash] = useState(INITIAL_CASH);
  const [portfolio, setPortfolio] = useState({});
  const [sessionStatus, setSessionStatus] = useState('WAITING');

  /* ========= AUTH ========= */
  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();

    const unsub = onAuthStateChanged(auth, user => {
      setAuthUser(user);
    });

    return () => unsub();
  }, []);

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Connecting to Trading Lab…
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button
          onClick={() =>
            setUserData({
              name: "Participant",
              regNo: authUser.uid.slice(0, 6)
            })
          }
          className="px-6 py-3 bg-black text-white rounded"
        >
          Enter Trading Lab
        </button>
      </div>
    );
  }

  /* =========================
     FULL DASHBOARD UI
     ========================= */

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1F2937] p-6">
      <h1 className="text-2xl font-bold mb-2">
        Trading Lab Loaded ✅
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        User ID: {authUser.uid}
      </p>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border rounded p-4">
          <h3 className="font-semibold mb-2">Cash</h3>
          <p className="font-mono text-lg">₹{cash.toFixed(2)}</p>
        </div>

        <div className="bg-white border rounded p-4">
          <h3 className="font-semibold mb-2">Stocks</h3>
          <p className="font-mono text-lg">
            {Object.keys(stocks).length}
          </p>
        </div>

        <div className="bg-white border rounded p-4">
          <h3 className="font-semibold mb-2">Session</h3>
          <p className="font-mono text-lg">{sessionStatus}</p>
        </div>
      </div>
    </div>
  );
}
