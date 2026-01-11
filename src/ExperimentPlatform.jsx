import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Activity, Settings, Play, Pause, TrendingUp, TrendingDown, 
  Lock, ChevronDown, ChevronUp, User, Trophy, Briefcase, 
  Layout, Search, Globe, Smartphone, Tv, Youtube, Users,
  Download, Trash2, LogOut, FileText, History, CheckCircle, AlertCircle,
  MessageCircle, Share2, MoreHorizontal, Bell, ThumbsUp, StopCircle, RefreshCw,
  Wifi, WifiOff, X
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  deleteDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';

// --- MATH UTILITIES ---
const generateGaussian = (mean, stdDev) => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); 
  while(v === 0) v = Math.random();
  const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  return z * stdDev + mean;
};

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

// --- CONFIGURATION ---
// FIX: Use system __app_id to satisfy security rules
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'behavioral-lab-session';

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

const SOURCE_OPTICS_MAP = {
  'NEWSPAPER': 'Front Page',
  'TV': 'Front Page',
  'APP': 'Page 3',
  'SOCIAL': 'Page 7',
  'VIDEO': 'Page 7',
  'CHAT': 'Side Column'
};

const OPTICS_WEIGHTS = { 'Front Page': 1.5, 'Page 3': 1.1, 'Page 7': 0.6, 'Side Column': 0.4, 'Bottom Strip': 0.2 };
const VISUAL_WEIGHTS = { 'Bold + Highlight': 1.3, 'Bold Only': 1.15, 'Normal': 1.0, 'Muted': 0.8 };

const NEWS_SOURCES = [
  { id: 'NP_ET', label: 'Economic Times', icon: Globe, type: 'NEWSPAPER' },
  { id: 'NP_MINT', label: 'Mint', icon: Globe, type: 'NEWSPAPER' },
  { id: 'TV_CNBC', label: 'CNBC-TV18', icon: Tv, type: 'TV' },
  { id: 'APP_GROWW', label: 'Groww', icon: Smartphone, type: 'APP' },
  { id: 'APP_MC', label: 'Moneycontrol', icon: Smartphone, type: 'APP' },
  { id: 'SM_TWITTER', label: 'X (Twitter)', icon: Smartphone, type: 'SOCIAL' },
  { id: 'YT_FIN', label: 'YouTube', icon: Youtube, type: 'VIDEO' },
  { id: 'P2P_FF', label: 'WhatsApp', icon: MessageCircle, type: 'CHAT' },
];

const INDUSTRIES = ['ENERGY', 'IT', 'BANKING', 'FMCG', 'TELECOM', 'AUTO'];

const INITIAL_STOCKS = [
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', price: 860.00, industry: 'TELECOM' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1530.00, industry: 'BANKING' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', price: 2500.00, industry: 'FMCG' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 960.00, industry: 'BANKING' },
  { symbol: 'INFY', name: 'Infosys', price: 1450.00, industry: 'IT' },
  { symbol: 'ITC', name: 'ITC Limited', price: 440.00, industry: 'FMCG' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', price: 1780.00, industry: 'BANKING' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2340.00, industry: 'ENERGY' },
  { symbol: 'SBIN', name: 'State Bank of India', price: 570.00, industry: 'BANKING' },
  { symbol: 'TCS', name: 'Tata Consultancy Svcs', price: 3421.00, industry: 'IT' },
];

const INITIAL_CASH = 1000000;

const getInitialStockState = () => {
  const initialState = {};
  INITIAL_STOCKS.forEach(s => {
    initialState[s.symbol] = { 
      ...s, 
      currentPrice: s.price, 
      history: Array(60).fill({ price: s.price }) 
    };
  });
  return initialState;
};

// --- FIREBASE INIT ---
const firebaseConfig = {
  apiKey: "AIzaSyDQzza05lJO_5xR_a2dPKofIJ6Do7cXY6w",
  authDomain: "tradinglab-6b948.firebaseapp.com",
  projectId: "tradinglab-6b948",
  storageBucket: "tradinglab-6b948.firebasestorage.app",
  messagingSenderId: "769994506304",
  appId: "1:769994506304:web:121a856d62dd98a1c65fa5",
  measurementId: "G-8WH9VNWJN6"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- COMPONENTS ---

const NotificationToast = ({ notification, onClose }) => {
  if (!notification) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 ${notification.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'}`}>
      {notification.type === 'success' ? <CheckCircle size={18} className="text-green-400"/> : <AlertCircle size={18}/>}
      <div>
        <h4 className="text-sm font-semibold">{notification.title}</h4>
        <p className="text-xs opacity-90">{notification.message}</p>
      </div>
    </div>
  );
};

const PortfolioModal = ({ user, stocks, onClose }) => {
  if (!user || !user.portfolio) return null;
  
  // Calculate this user's stats based on CURRENT live prices
  let liveEquity = user.cash || 0;
  const portfolioItems = Object.entries(user.portfolio).map(([sym, data]) => {
    const currentPrice = stocks[sym]?.currentPrice || 0;
    const value = data.qty * currentPrice;
    liveEquity += value;
    const pl = value - (data.avgPrice * data.qty);
    const plPct = ((currentPrice - data.avgPrice) / data.avgPrice) * 100;
    
    return { sym, ...data, currentPrice, value, pl, plPct };
  });

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2"><User size={18}/> {user.name}</h3>
            <p className="text-xs text-gray-400">{user.regNo}</p>
          </div>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="flex justify-between mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
             <div>
                <span className="text-[10px] uppercase text-gray-500 font-bold">Total Equity</span>
                <p className="text-2xl font-mono text-gray-900">₹{liveEquity.toFixed(2)}</p>
             </div>
             <div className="text-right">
                <span className="text-[10px] uppercase text-gray-500 font-bold">Cash Balance</span>
                <p className="text-xl font-mono text-gray-700">₹{(user.cash || 0).toFixed(2)}</p>
             </div>
          </div>

          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 bg-gray-50 border-b">
              <tr>
                <th className="text-left py-2 px-3">Stock</th>
                <th className="text-right py-2 px-3">Qty</th>
                <th className="text-right py-2 px-3">Avg Cost</th>
                <th className="text-right py-2 px-3">Cur. Price</th>
                <th className="text-right py-2 px-3">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {portfolioItems.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-8 text-gray-400 italic">No active holdings.</td></tr>
              ) : (
                portfolioItems.map((item) => (
                  <tr key={item.sym}>
                    <td className="py-2 px-3 font-medium">{item.sym}</td>
                    <td className="py-2 px-3 text-right font-mono">{item.qty}</td>
                    <td className="py-2 px-3 text-right font-mono">₹{item.avgPrice.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-mono">₹{item.currentPrice.toFixed(2)}</td>
                    <td className={`py-2 px-3 text-right font-mono font-medium ${item.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.pl > 0 ? '+' : ''}{item.plPct.toFixed(2)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const formatTimeAge = (ageInSeconds) => {
  if (ageInSeconds < 60) return `${ageInSeconds}s ago`;
  const mins = Math.floor(ageInSeconds / 60);
  const secs = ageInSeconds % 60;
  return `${mins}m ${secs}s ago`;
};

const NewsCard = ({ news, currentTime }) => {
  const [expanded, setExpanded] = useState(false);
  const age = Math.max(0, currentTime - news.time);
  const sourceDef = NEWS_SOURCES.find(s => s.id === news.source) || NEWS_SOURCES[0];
  const type = sourceDef.type; 
  const timeString = formatTimeAge(age);

  if (type === 'NEWSPAPER') {
    return (
      <div className="mb-4 bg-[#FDFBF7] border-b border-gray-300 pb-3 pt-2 px-2" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2 mb-1 border-b border-gray-200 pb-1">
          <Globe size={10} className="text-gray-500"/>
          <span className="text-[9px] font-serif uppercase tracking-widest text-gray-500">{sourceDef.label} • {timeString}</span>
        </div>
        <h3 className={`font-serif text-[#1F2937] leading-tight text-lg font-bold`}>{news.headline}</h3>
        {expanded && news.description && <p className="mt-2 text-xs font-serif text-gray-600 leading-relaxed">{news.description}</p>}
      </div>
    );
  }
  if (type === 'APP') {
    return (
      <div className="mb-4 bg-white rounded-xl shadow-sm border border-gray-100 p-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded-md flex items-center justify-center ${sourceDef.id.includes('GROWW') ? 'bg-emerald-500' : 'bg-blue-600'}`}><Smartphone size={8} className="text-white"/></div>
            <span className="text-[10px] font-semibold text-gray-600">{sourceDef.label}</span>
          </div>
          <span className="text-[9px] text-gray-400">{timeString}</span>
        </div>
        <h3 className="text-sm font-medium text-gray-900">{news.headline}</h3>
        {expanded && <p className="mt-1 text-xs text-gray-500">{news.description}</p>}
      </div>
    );
  }
  if (type === 'SOCIAL') {
    return (
      <div className="mb-4 bg-white border border-gray-200 rounded p-3 hover:bg-gray-50 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0"></div>
          <div>
            <div className="flex items-center gap-1"><span className="text-xs font-bold text-gray-900">Market Insider</span><span className="text-[10px] text-gray-500">@mkt_insider • {timeString}</span></div>
            <p className="text-xs text-gray-800 mt-0.5">{news.headline}</p>
            {expanded && news.description && <p className="text-xs text-gray-600 mt-1">{news.description}</p>}
            <div className="flex gap-4 mt-2 text-gray-400"><MessageCircle size={12}/><Share2 size={12}/><ThumbsUp size={12}/></div>
          </div>
        </div>
      </div>
    );
  }
  if (type === 'CHAT') {
    return (
      <div className="mb-4 flex flex-col items-start" onClick={() => setExpanded(!expanded)}>
         <span className="text-[9px] text-gray-400 mb-1 ml-1">{sourceDef.label}</span>
         <div className="bg-[#DCF8C6] p-2.5 rounded-lg rounded-tl-none shadow-sm max-w-[90%] border border-green-100">
            <p className="text-xs text-gray-800">{news.headline}</p>
            {expanded && <p className="text-[10px] text-gray-600 mt-1 pt-1 border-t border-green-200/50">{news.description}</p>}
            <span className="text-[8px] text-gray-500 block text-right mt-1">{timeString}</span>
         </div>
      </div>
    );
  }
  if (type === 'VIDEO') {
    return (
      <div className="mb-4 bg-white border border-gray-200 rounded-sm overflow-hidden" onClick={() => setExpanded(!expanded)}>
         <div className="h-24 bg-gray-800 flex items-center justify-center relative"><div className="absolute inset-0 bg-black/40"></div><Play size={24} className="text-white relative z-10 opacity-80"/><span className="absolute bottom-1 right-1 bg-black text-white text-[9px] px-1 rounded">2:45</span></div>
         <div className="p-2"><h3 className="text-xs font-semibold text-gray-900 line-clamp-2">{news.headline}</h3><div className="flex items-center gap-1 mt-1"><span className="text-[9px] text-gray-500">Finance Daily</span><span className="text-[9px] text-gray-500">• {timeString}</span></div></div>
      </div>
    );
  }
  return (
    <div className="mb-3 p-3 bg-white border-l-4 border-red-600 shadow-sm" onClick={() => setExpanded(!expanded)}>
      <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-red-600 uppercase">LIVE BROADCAST</span><span className="text-[9px] text-gray-400">{timeString}</span></div>
      <h3 className="text-sm font-bold text-gray-900">{news.headline}</h3>
    </div>
  );
};

const MinimalChart = ({ data, color = "#2563EB" }) => {
  if (!data || data.length < 2) return <div className="h-full flex items-center justify-center text-xs text-gray-400">WAITING FOR DATA...</div>;
  const width = 600, height = 200, padding = 5;
  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices) * 0.999;
  const maxPrice = Math.max(...prices) * 1.001;
  const range = maxPrice - minPrice || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
    const y = height - ((d.price - minPrice) / range) * (height - 2 * padding) - padding;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      <defs><linearGradient id={`gradient-${color}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.1"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinejoin="round" strokeLinecap="round"/>
      <polygon points={`${points.split(' ')[0].split(',')[0]},${height} ${points} ${points.split(' ').pop().split(',')[0]},${height}`} fill={`url(#gradient-${color})`} />
      <circle cx={points.split(' ').pop().split(',')[0]} cy={points.split(' ').pop().split(',')[1]} r="3" fill={color} />
    </svg>
  );
};

// --- LOGIN & SUMMARY SCREENS ---
const LoginScreen = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const handleSubmit = (e) => { e.preventDefault(); if (name && regNo) onLogin({ name, regNo }); };
  return (
    <div className="fixed inset-0 bg-[#FAFAFA] z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5E7EB] shadow-sm max-w-md w-full p-8 rounded-sm">
        <div className="mb-6 text-center"><div className="w-10 h-10 bg-[#1F2937] text-white rounded-sm flex items-center justify-center mx-auto mb-3"><Activity size={24} /></div><h1 className="text-xl font-semibold text-[#1F2937]">Research Access</h1><p className="text-xs text-[#6B7280] mt-1">Behavioral Finance Laboratory</p></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs font-medium text-[#374151] mb-1">Full Name</label><input required className="w-full border border-[#D1D5DB] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Aditi Sharma"/></div>
          <div><label className="block text-xs font-medium text-[#374151] mb-1">Registration Number</label><input required className="w-full border border-[#D1D5DB] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={regNo} onChange={e => setRegNo(e.target.value)} placeholder="e.g. 21BBA045"/></div>
          <button type="submit" className="w-full bg-[#1F2937] hover:bg-black text-white py-2.5 rounded-sm text-sm font-medium transition-colors">Enter Simulation</button>
        </form>
      </div>
    </div>
  );
};

const SessionSummary = ({ finalEquity, totalReturn, onClose }) => (
  <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md p-8 rounded-lg shadow-2xl animate-in zoom-in-95">
      <div className="text-center mb-6"><Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" /><h2 className="text-2xl font-bold text-gray-900">Session Complete</h2><p className="text-gray-500">Trading session has ended.</p></div>
      <div className="space-y-4 mb-8">
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded"><span className="text-gray-600">Final Equity</span><span className="text-xl font-mono font-bold">₹{finalEquity.toFixed(2)}</span></div>
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded"><span className="text-gray-600">Total Return</span><span className={`text-xl font-mono font-bold ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%</span></div>
      </div>
      <button onClick={onClose} className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700">Return to Login</button>
    </div>
  </div>
);

// --- MAIN PLATFORM ---
export default function ExperimentPlatform() {
  const [authUser, setAuthUser] = useState(null); 
  const [userData, setUserData] = useState(null); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Connection / Status State
  const [sessionStatus, setSessionStatus] = useState('WAITING');
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isConnected, setIsConnected] = useState(true);
  
  // Market State
  const [time, setTime] = useState(0);
  const [stocks, setStocks] = useState(getInitialStockState());
  const [newsList, setNewsList] = useState([]);
  const [marketLag, setMarketLag] = useState(0);
  
  // User Local State
  const [cash, setCash] = useState(INITIAL_CASH);
  const [portfolio, setPortfolio] = useState({});
  const [activeTab, setActiveTab] = useState('MARKET');
  const [selectedSymbol, setSelectedSymbol] = useState('TCS');
  const [orderQty, setOrderQty] = useState(10);
  
  // Community Data
  const [leaderboard, setLeaderboard] = useState([]); // Raw user data
  const [myTransactions, setMyTransactions] = useState([]); 
  const [viewingUser, setViewingUser] = useState(null); // For Portfolio Modal
  
  // Admin State
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminHeadline, setAdminHeadline] = useState("");
  const [adminDescription, setAdminDescription] = useState("");
  const [adminSentiment, setAdminSentiment] = useState(0);
  const [adminVisual, setAdminVisual] = useState("Normal");
  const [adminTarget, setAdminTarget] = useState("ALL");
  const [adminSource, setAdminSource] = useState("NP_ET");
  const [manualPriceSymbol, setManualPriceSymbol] = useState(INITIAL_STOCKS[0].symbol);
  const [manualPriceValue, setManualPriceValue] = useState("");
  const [isXLSXLoaded, setIsXLSXLoaded] = useState(false); // SheetJS State

  const engineRef = useRef({ stocks: getInitialStockState(), newsList: [], time: 0, marketLag: 0 });

  // Sorted Stock List
  const sortedStockList = useMemo(() => Object.values(stocks).sort((a, b) => a.symbol.localeCompare(b.symbol)), [stocks]);

  // Derived Leaderboard with LIVE Profit Calculation
  const liveLeaderboard = useMemo(() => {
    return leaderboard.map(user => {
      // If user has a portfolio, calculate live equity using CURRENT stocks
      let liveEquity = user.cash || INITIAL_CASH;
      if (user.portfolio) {
        Object.entries(user.portfolio).forEach(([sym, data]) => {
          const currentPrice = stocks[sym]?.currentPrice || 0;
          liveEquity += (data.qty * currentPrice);
        });
      }
      const liveReturn = ((liveEquity - INITIAL_CASH) / INITIAL_CASH) * 100;
      return { ...user, liveEquity, liveReturn };
    }).sort((a, b) => b.liveReturn - a.liveReturn);
  }, [leaderboard, stocks]);

  const showNotification = (title, message, type = 'success') => {
    setNotification({ title, message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // 1. INITIALIZATION & AUTH
  useEffect(() => {
    // Load SheetJS dynamically for Excel export
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setIsXLSXLoaded(true);
    document.body.appendChild(script);

    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubAuth = onAuthStateChanged(auth, (user) => setAuthUser(user));
    return () => {
      unsubAuth();
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  // 2. DATA SYNC
  useEffect(() => {
    if (!authUser) return;

    // A. Market State
    const marketRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'market_state', 'main');
    const unsubMarket = onSnapshot(marketRef, (docSnap) => {
      setLastUpdate(Date.now());
      setIsConnected(true);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const incomingStocks = data.stocks || getInitialStockState();
        
        // Use functional update to ensure React sees new ref
        setStocks(prev => incomingStocks);
        
        setNewsList(data.newsList || []);
        setTime(data.time || 0);
        setMarketLag(data.marketLag || 0); 
        
        const remoteStatus = data.sessionStatus || 'WAITING';
        setSessionStatus(remoteStatus);
        
        if (remoteStatus === 'ENDED' && sessionStatus !== 'ENDED') setSessionFinished(true);

        engineRef.current = { 
          stocks: incomingStocks, 
          newsList: data.newsList || [], 
          time: data.time || 0,
          marketLag: data.marketLag || 0 
        };
        
        if (data.resetSignal && data.resetSignal !== localStorage.getItem('lastReset')) {
           localStorage.setItem('lastReset', data.resetSignal);
           handleLocalReset();
        }
      }
    });

    // B. Leaderboard (Raw Users Data)
    const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      const users = snapshot.docs.map(d => d.data());
      setLeaderboard(users);
    });

    // C. Transactions
    const logsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
       const allLogs = snapshot.docs.map(d => d.data());
       const myLogs = allLogs.filter(log => log.userId === authUser.uid).sort((a, b) => b.timestamp - a.timestamp);
       setMyTransactions(myLogs);
    });

    return () => { unsubMarket(); unsubUsers(); unsubLogs(); };
  }, [authUser]);

  // Connection Watchdog
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastUpdate > 5000 && sessionStatus === 'LIVE') setIsConnected(false);
    }, 2000);
    return () => clearInterval(interval);
  }, [lastUpdate, sessionStatus]);

  // 3. ADMIN ENGINE LOOP
  useEffect(() => {
    let interval;
    if (isAdmin && sessionStatus === 'LIVE') {
      interval = setInterval(() => {
        const currentState = engineRef.current;
        const T = currentState.time + 1;
        let newStockState = { ...currentState.stocks };
        if (Object.keys(newStockState).length === 0) newStockState = getInitialStockState();

        Object.keys(newStockState).forEach(symbol => {
          const stock = newStockState[symbol];
          const R_base = generateGaussian(MODEL_CONFIG.mu, MODEL_CONFIG.sigma);
          let R_news_raw = 0;
          let correctionTerm = 0; 

          currentState.newsList.forEach(news => {
             const isTarget = news.target === 'ALL' || news.target === stock.symbol || news.target === stock.industry;
             if (isTarget) {
                const age = T - news.time;
                const lag = currentState.marketLag || 0; 
                if (age < lag) return;
                const effectiveAge = age - lag; 
                const decay = Math.exp(-MODEL_CONFIG.decayLambda * effectiveAge);
                const sourceType = NEWS_SOURCES.find(s => s.id === news.source)?.type || 'NEWSPAPER';
                const implicitOptics = SOURCE_OPTICS_MAP[sourceType] || 'Page 3';
                const opticsWeight = OPTICS_WEIGHTS[implicitOptics];
                const impact = news.sentiment * opticsWeight * VISUAL_WEIGHTS[news.visual] * decay;
                R_news_raw += impact;
                if (effectiveAge > 30 && effectiveAge < 90) correctionTerm -= (impact * MODEL_CONFIG.reversionFactor); 
             }
          });

          const R_noise = generateGaussian(0, MODEL_CONFIG.noiseSigma);
          let R_news_final = R_news_raw;
          if (R_news_raw < 0) R_news_final *= MODEL_CONFIG.lossAversion;
          else if (R_news_raw > 0) R_news_final *= MODEL_CONFIG.gainDampener;

          let R_total = R_base + R_news_final + R_noise + correctionTerm;
          R_total = clamp(R_total, -MODEL_CONFIG.maxChange, MODEL_CONFIG.maxChange);
          const P_next = stock.currentPrice * (1 + R_total);
          stock.currentPrice = P_next;
          // Ensure history is not growing indefinitely, causing Firestore limits
          const prevHistory = stock.history || [];
          const newHistory = [...prevHistory.slice(-59), { time: T, price: P_next }];
          stock.history = newHistory;
        });

        const marketRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'market_state', 'main');
        setDoc(marketRef, {
          stocks: newStockState,
          newsList: currentState.newsList,
          time: T,
          sessionStatus: 'LIVE'
        }, { merge: true });

      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isAdmin, sessionStatus]);

  // 4. USER ACTIONS
  const handleLogin = async ({ name, regNo }) => {
    if (!authUser) return;
    setUserData({ name, regNo });
    const userRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', authUser.uid);
    // Initial Save
    await setDoc(userRef, {
      uid: authUser.uid,
      name,
      regNo,
      cash: INITIAL_CASH,
      portfolio: {},
      lastActive: Date.now()
    }, { merge: true });
  };

  const handleLocalReset = () => {
    setCash(INITIAL_CASH);
    setPortfolio({});
    setSessionFinished(false);
  };

  const handleTrade = async (type) => {
    if (!authUser || !userData) return;
    if (sessionStatus !== 'LIVE') {
        showNotification("Market Closed", "Trading is not currently active.", "error");
        return;
    }

    const price = stocks[selectedSymbol].currentPrice;
    const cost = price * orderQty;
    const qty = parseInt(orderQty);
    
    let newCash = cash;
    let newPortfolio = { ...portfolio };

    if (type === 'BUY') {
      if (cash < cost) {
         showNotification("Insufficient Funds", "You do not have enough cash.", "error");
         return;
      }
      newCash -= cost;
      const current = newPortfolio[selectedSymbol] || { qty: 0, avgPrice: 0, totalCost: 0 };
      const newTotalCost = current.totalCost + cost;
      const newQty = current.qty + qty;
      newPortfolio[selectedSymbol] = { qty: newQty, totalCost: newTotalCost, avgPrice: newTotalCost / newQty };
    } else {
      const current = newPortfolio[selectedSymbol];
      if (!current || current.qty < qty) {
         showNotification("Invalid Trade", "Not enough shares to sell.", "error");
         return;
      }
      newCash += cost;
      const newQty = current.qty - qty;
      if (newQty === 0) delete newPortfolio[selectedSymbol];
      else {
        const costRemoved = current.avgPrice * qty;
        newPortfolio[selectedSymbol] = { ...current, qty: newQty, totalCost: current.totalCost - costRemoved };
      }
    }

    setCash(newCash);
    setPortfolio(newPortfolio);
    showNotification("Order Executed", `${type} ${qty} ${selectedSymbol} @ ₹${price.toFixed(2)}`);

    // IMPORTANT: Save Portfolio to Firestore for Dynamic Leaderboard
    const userRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', authUser.uid);
    setDoc(userRef, { cash: newCash, portfolio: newPortfolio, lastActive: Date.now() }, { merge: true });

    // Capture precise news context at time of trade
    const lastNews = newsList.length > 0 ? newsList[0] : null;
    const logRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs');
    
    addDoc(logRef, {
       userId: authUser.uid,
       userName: userData.name,
       userReg: userData.regNo,
       type,
       symbol: selectedSymbol,
       quantity: qty,
       price: price,
       totalValue: cost,
       timestamp: Date.now(),
       marketTime: time,
       
       // Comprehensive News Context Logging
       lastNewsHeadline: lastNews ? lastNews.headline : "No News",
       lastNewsDescription: lastNews ? lastNews.description : "",
       lastNewsSource: lastNews ? lastNews.sourceLabel : "N/A",
       lastNewsSentiment: lastNews ? lastNews.sentiment : 0,
       lastNewsVisual: lastNews ? lastNews.visual : "Normal",
       lastNewsTime: lastNews ? lastNews.time : -1,
       currentMarketLag: marketLag,
       reactionDelay: lastNews ? (time - lastNews.time) : -1
    });
  };

  // 5. ADMIN ACTIONS
  const verifyAdmin = () => { if (adminCode === '1712') { setIsAdmin(true); setShowAdminPanel(true); setShowAdminAuth(false); } };
  const updateSessionStatus = async (newStatus) => {
    if (!isAdmin) return;
    const updatePayload = { sessionStatus: newStatus };
    if (newStatus === 'LIVE' && Object.keys(stocks).length === 0) updatePayload.stocks = getInitialStockState();
    else if (newStatus === 'LIVE') updatePayload.stocks = stocks;
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'market_state', 'main'), updatePayload, { merge: true });
    setSessionStatus(newStatus);
  };
  const updateLagSetting = async (val) => { setMarketLag(val); await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'market_state', 'main'), { marketLag: val }, { merge: true }); };
  const handleManualPriceSet = async () => {
    if (!manualPriceValue || isNaN(manualPriceValue)) return;
    const newPrice = parseFloat(manualPriceValue);
    const newStocks = { ...stocks };
    if (newStocks[manualPriceSymbol]) {
       newStocks[manualPriceSymbol] = { ...newStocks[manualPriceSymbol], currentPrice: newPrice, history: [...newStocks[manualPriceSymbol].history, { time: time, price: newPrice }] };
       setStocks(newStocks);
       await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'market_state', 'main'), { stocks: newStocks }, { merge: true });
       setManualPriceValue("");
       showNotification("Price Updated", `${manualPriceSymbol} set to ₹${newPrice}`);
    }
  };
  const adminInjectNews = async () => {
    if (!adminHeadline) return;
    const sourceObj = NEWS_SOURCES.find(s => s.id === adminSource);
    const newNews = { id: Date.now(), headline: adminHeadline, description: adminDescription, sentiment: adminSentiment, visual: adminVisual, target: adminTarget, time: time, source: adminSource, sourceLabel: sourceObj ? sourceObj.label : 'Market Wire' };
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'market_state', 'main'), { newsList: [newNews, ...newsList] }, { merge: true });
    setAdminHeadline(""); setAdminDescription("");
  };
  const adminHardReset = async () => {
    if (!confirm("WARNING: This will delete ALL user data, logs, and reset the market. Are you sure?")) return;
    setSessionStatus('WAITING');
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'market_state', 'main'), { stocks: getInitialStockState(), newsList: [], time: 0, sessionStatus: 'WAITING', resetSignal: Date.now() });
    try {
        const batch = writeBatch(db);
        (await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'))).forEach(doc => batch.delete(doc.ref));
        (await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs'))).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        alert("Market Reset Complete.");
    } catch(e) { console.error("Reset error", e); }
  };
  
  const adminExportData = async () => {
    if (!isXLSXLoaded || !window.XLSX) {
        alert("Excel Library not loaded yet. Please wait a moment.");
        return;
    }
    
    // 1. Prepare Sheet 1: Market Config & Initial State
    const marketConfigData = [
        ["Parameter", "Value"],
        ["Drift (Mu)", MODEL_CONFIG.mu],
        ["Volatility (Sigma)", MODEL_CONFIG.sigma],
        ["Decay Lambda", MODEL_CONFIG.decayLambda],
        ["Loss Aversion", MODEL_CONFIG.lossAversion],
        ["Initial Cash", INITIAL_CASH],
        [],
        ["Stock Symbol", "Initial Price", "Industry"],
        ...INITIAL_STOCKS.map(s => [s.symbol, s.price, s.industry])
    ];

    // 2. Prepare Sheet 2: Trade Logs
    const logsSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs'));
    const logsData = [
        [
            "Timestamp", "Market Time", "User Name", "Reg No", "User ID", 
            "Action Type", "Symbol", "Quantity", "Price", "Total Value", 
            "Lag Setting", "Reaction Time (s)", 
            "News Headline", "News Description", "News Source", "News Sentiment", "News Visual"
        ]
    ];

    logsSnap.forEach(doc => {
        const d = doc.data();
        logsData.push([
            new Date(d.timestamp).toISOString(),
            d.marketTime,
            d.userName,
            d.userReg,
            d.userId,
            d.type,
            d.symbol,
            d.quantity,
            d.price,
            d.totalValue,
            d.currentMarketLag || 0,
            d.reactionDelay || "N/A",
            d.lastNewsHeadline,
            d.lastNewsDescription,
            d.lastNewsSource,
            d.lastNewsSentiment,
            d.lastNewsVisual
        ]);
    });

    // 3. Create Workbook
    const wb = window.XLSX.utils.book_new();
    const ws1 = window.XLSX.utils.aoa_to_sheet(marketConfigData);
    const ws2 = window.XLSX.utils.aoa_to_sheet(logsData);

    window.XLSX.utils.book_append_sheet(wb, ws1, "Market Config");
    window.XLSX.utils.book_append_sheet(wb, ws2, "Trade Logs");

    // 4. Download
    window.XLSX.writeFile(wb, `Experiment_Data_${Date.now()}.xlsx`);
  };

  if (!userData) return <LoginScreen onLogin={handleLogin} />;

  const selectedStockData = stocks[selectedSymbol] || INITIAL_STOCKS[0];
  const currentPrice = selectedStockData.currentPrice || 0;
  const portfolioVal = Object.entries(portfolio).reduce((acc, [sym, data]) => acc + (data.qty * stocks[sym].currentPrice), 0);
  const totalEquity = cash + portfolioVal;
  const totalReturn = ((totalEquity - INITIAL_CASH) / INITIAL_CASH) * 100;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1F2937] font-sans flex flex-col relative">
      <NotificationToast notification={notification} />
      {viewingUser && <PortfolioModal user={viewingUser} stocks={stocks} onClose={() => setViewingUser(null)} />}
      {sessionFinished && <SessionSummary finalEquity={totalEquity} totalReturn={totalReturn} onClose={() => { setUserData(null); setSessionFinished(false); }} />}

      <header className="bg-white border-b border-[#E5E7EB] h-14 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2"><div className="w-8 h-8 bg-[#1F2937] rounded-sm flex items-center justify-center text-white"><Activity size={18} /></div><div><span className="text-[14px] font-semibold tracking-tight text-[#1F2937] block leading-tight">TRADING<span className="text-gray-400">LAB</span></span><span className="text-[10px] text-gray-400 font-mono">{userData.regNo}</span></div></div>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right"><span className="text-[10px] text-[#6B7280] block leading-none mb-1">MARKET TIME</span><span className="text-[13px] font-mono text-[#374151]">{Math.floor(time / 60)}:{String(time % 60).padStart(2, '0')}</span></div>
           <div className="h-6 w-px bg-gray-200"></div>
           <div className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold ${sessionStatus === 'LIVE' ? 'bg-green-50 text-green-600' : sessionStatus === 'PAUSED' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>{sessionStatus === 'LIVE' ? <span className="animate-pulse flex items-center gap-1">● MARKET OPEN {isConnected ? '' : <WifiOff size={10}/>}</span> : sessionStatus === 'PAUSED' ? <span>● PAUSED</span> : <span>● MARKET CLOSED</span>}</div>
           {isAdmin && (
             <div className="flex gap-2">
                {sessionStatus === 'LIVE' ? <button onClick={() => updateSessionStatus('PAUSED')} className="bg-amber-100 text-amber-700 px-3 py-1 rounded text-xs font-bold hover:bg-amber-200 flex items-center gap-1"><Pause size={12}/> PAUSE</button> : <button onClick={() => updateSessionStatus('LIVE')} className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold hover:bg-green-200 flex items-center gap-1"><Play size={12}/> START</button>}
                <button onClick={() => updateSessionStatus('ENDED')} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs font-bold hover:bg-gray-300 flex items-center gap-1"><StopCircle size={12}/> END</button>
             </div>
           )}
           <button onClick={() => setSessionFinished(true)} title="End Session" className="text-gray-400 hover:text-red-600"><LogOut size={18} /></button>
           <button onClick={() => setShowAdminAuth(true)} className="focus:outline-none relative"><Settings size={18} className={`transition-colors ${showAdminPanel ? 'text-blue-600' : 'text-gray-400 hover:text-gray-800'}`} /></button>
        </div>
      </header>

      {showAdminAuth && !showAdminPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm" onClick={() => setShowAdminAuth(false)}>
           <div className="bg-white p-6 rounded shadow-lg border border-gray-200 w-64" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Lock size={14}/> Security Check</h3>
              <input type="password" autoFocus className="w-full border p-2 text-sm rounded mb-2" placeholder="Enter Admin Code" value={adminCode} onChange={e => setAdminCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && verifyAdmin()}/>
              <button onClick={verifyAdmin} className="w-full bg-blue-600 text-white text-xs py-2 rounded">Verify</button>
           </div>
        </div>
      )}

      {showAdminPanel && (
        <div className="bg-slate-900 text-slate-300 p-6 border-b border-slate-700 animate-in slide-in-from-top-2">
          <div className="max-w-6xl mx-auto">
             <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Master Control</span>
               <div className="flex gap-4">
                 <button onClick={adminExportData} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"><Download size={12}/> Export Master Data (.xlsx)</button>
                 <button onClick={adminHardReset} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 size={12}/> Hard Reset</button>
                 <button onClick={() => setShowAdminPanel(false)} className="text-xs text-slate-500 hover:text-white">Close</button>
               </div>
             </div>
             <div className="grid grid-cols-12 gap-6 items-start">
                <div className="col-span-6 space-y-3">
                   <h3 className="text-xs font-bold text-gray-500 uppercase">Inject Stimulus</h3>
                   <div className="grid grid-cols-2 gap-2">
                      <select className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs" value={adminSource} onChange={e => setAdminSource(e.target.value)}>{NEWS_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                      <select className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs" value={adminTarget} onChange={e => setAdminTarget(e.target.value)}><option value="ALL">MARKET WIDE</option><optgroup label="Industries">{INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}</optgroup><optgroup label="Stocks">{INITIAL_STOCKS.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}</optgroup></select>
                   </div>
                   <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500" placeholder="Headline..." value={adminHeadline} onChange={e => setAdminHeadline(e.target.value)}/>
                   <input className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500" placeholder="Description (Optional)..." value={adminDescription} onChange={e => setAdminDescription(e.target.value)}/>
                   <div className="grid grid-cols-2 gap-2">
                      <div><label className="block text-[9px] text-slate-500 mb-1">SENTIMENT ({adminSentiment})</label><input type="range" min="-1" max="1" step="0.5" value={adminSentiment} onChange={e => setAdminSentiment(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                      <div><label className="block text-[9px] text-slate-500 mb-1">VISUAL</label><select className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1 text-[10px]" value={adminVisual} onChange={e => setAdminVisual(e.target.value)}>{Object.keys(VISUAL_WEIGHTS).map(k => <option key={k} value={k}>{k}</option>)}</select></div>
                   </div>
                   <button onClick={adminInjectNews} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded transition-colors">INJECT</button>
                </div>
                <div className="col-span-6 space-y-4 border-l border-slate-800 pl-6">
                   <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Reaction Lag Timer</h3>
                      <div className="flex gap-2">{[0, 30, 60].map(val => (<button key={val} onClick={() => updateLagSetting(val)} className={`px-3 py-1.5 rounded text-xs border ${marketLag === val ? 'bg-blue-900 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-gray-400 hover:bg-slate-700'}`}>{val === 0 ? 'Immediate' : val === 30 ? 'Moderate (30s)' : 'Delayed (60s)'}</button>))}</div>
                   </div>
                   <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Price Override</h3>
                      <div className="flex gap-2">
                         <select className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white" value={manualPriceSymbol} onChange={e => setManualPriceSymbol(e.target.value)}>{sortedStockList.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}</select>
                         <input type="number" className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs w-24 text-white" placeholder="Price..." value={manualPriceValue} onChange={e => setManualPriceValue(e.target.value)}/>
                         <button onClick={handleManualPriceSet} className="bg-red-900 hover:bg-red-800 text-red-100 border border-red-800 px-3 py-1 rounded text-xs">Set</button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      <div className="flex-grow flex overflow-hidden">
        <div className="w-[35%] border-r border-[#E5E7EB] bg-white flex flex-col">
          <div className="p-4 border-b border-[#E5E7EB] flex justify-between items-center bg-[#FAFAFA]"><h2 className="text-sm font-semibold text-[#1F2937] flex items-center gap-2"><Globe size={14} className="text-gray-500"/> Market Intelligence</h2>{sessionStatus === 'LIVE' && <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span><span className="text-[10px] font-medium text-red-600">LIVE</span></div>}</div>
          <div className="flex-grow overflow-y-auto p-4 custom-scrollbar bg-white">{newsList.length === 0 ? <div className="text-center mt-20 opacity-50"><p className="text-xs">Waiting for market signals...</p></div> : newsList.map(news => <NewsCard key={news.id} news={news} currentTime={time} />)}</div>
        </div>

        <div className="w-[65%] flex flex-col bg-[#F9FAFB]">
           <div className="flex border-b border-[#E5E7EB] bg-white px-4 pt-2">{['MARKET', 'PORTFOLIO', 'TRANSACTIONS', 'LEADERBOARD'].map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab ? 'border-[#1F2937] text-[#1F2937]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{tab === 'MARKET' ? <Layout size={14}/> : tab === 'PORTFOLIO' ? <Briefcase size={14}/> : tab === 'TRANSACTIONS' ? <History size={14}/> : <Trophy size={14}/>} {tab === 'MARKET' ? 'Market Watch' : tab === 'PORTFOLIO' ? 'Portfolio' : tab === 'TRANSACTIONS' ? 'History' : 'Leaderboard'}</button>))}</div>
           <div className="flex-grow p-6 overflow-y-auto">
              {activeTab === 'MARKET' && (
                <div className="h-full flex flex-col gap-4">
                  <div className="bg-white border border-[#E5E7EB] rounded-sm overflow-hidden flex-grow max-h-[40%] flex flex-col"><div className="overflow-y-auto"><table className="w-full text-left text-xs"><thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 border-b border-gray-200"><tr><th className="px-4 py-2">Symbol</th><th className="px-4 py-2 text-right">Price</th><th className="px-4 py-2 text-right">Change</th></tr></thead><tbody className="divide-y divide-gray-100">{sortedStockList.map(stock => { const prev = stock.history[stock.history.length - 2]?.price || stock.currentPrice; const change = stock.currentPrice - prev; const pct = (change / prev) * 100; return (<tr key={stock.symbol} onClick={() => setSelectedSymbol(stock.symbol)} className={`cursor-pointer hover:bg-blue-50 transition-colors ${selectedSymbol === stock.symbol ? 'bg-blue-50/60' : ''}`}><td className="px-4 py-2 font-medium text-gray-700">{stock.symbol}<span className="ml-2 text-[9px] text-gray-400 font-normal px-1 border rounded">{stock.industry}</span></td><td className="px-4 py-2 text-right font-mono">{stock.currentPrice.toFixed(2)}</td><td className={`px-4 py-2 text-right font-mono ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{change >= 0 ? '+' : ''}{pct.toFixed(2)}%</td></tr>)})}</tbody></table></div></div>
                  <div className="h-[60%] flex gap-4">
                     <div className="flex-grow bg-white border border-[#E5E7EB] rounded-sm p-4 flex flex-col"><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-3"><h3 className="text-lg font-bold text-gray-800">{selectedStockData.name}</h3><select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="bg-gray-100 border border-gray-200 rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">{sortedStockList.map(s => (<option key={s.symbol} value={s.symbol}>{s.symbol}</option>))}</select></div><div className="flex items-center gap-2"><span className="text-2xl font-light font-mono">₹{currentPrice.toFixed(2)}</span><span className={`text-sm font-medium ${(currentPrice - (selectedStockData.history[selectedStockData.history.length-2]?.price || currentPrice)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{((currentPrice - (selectedStockData.history[selectedStockData.history.length-2]?.price || currentPrice)) / (selectedStockData.history[selectedStockData.history.length-2]?.price || 1) * 100).toFixed(2)}%</span></div></div><div className="flex-grow"><MinimalChart data={selectedStockData.history} color="#2563EB" /></div></div>
                     <div className="w-64 bg-white border border-[#E5E7EB] rounded-sm p-4 flex flex-col justify-center"><div className="mb-4"><label className="text-[10px] text-gray-500 font-bold uppercase tracking-wide block mb-1">Quantity</label><input type="number" value={orderQty} onChange={e => setOrderQty(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm font-mono"/></div><div className="mb-4"><label className="text-[10px] text-gray-500 font-bold uppercase tracking-wide block mb-1">Total Value</label><div className="w-full bg-gray-100 rounded p-2 text-sm font-mono text-gray-600">₹{(orderQty * currentPrice).toFixed(2)}</div></div><div className="space-y-2"><button onClick={() => handleTrade('BUY')} disabled={sessionStatus !== 'LIVE' || cash < orderQty * currentPrice} className="w-full bg-[#1F2937] text-white py-2 rounded text-xs font-bold hover:bg-black disabled:opacity-50">BUY</button><button onClick={() => handleTrade('SELL')} disabled={sessionStatus !== 'LIVE' || !portfolio[selectedSymbol]?.qty || portfolio[selectedSymbol].qty < orderQty} className="w-full border border-gray-300 text-gray-700 py-2 rounded text-xs font-bold hover:bg-gray-50 disabled:opacity-50">SELL</button></div><div className="mt-4 pt-4 border-t border-gray-100"><p className="text-[10px] text-gray-500">Avail Cash</p><p className="font-mono text-sm font-medium">₹{cash.toFixed(2)}</p></div></div>
                  </div>
                </div>
              )}

              {activeTab === 'PORTFOLIO' && (
                 <div className="bg-white border border-[#E5E7EB] rounded-sm p-0 overflow-hidden flex flex-col h-full">
                    <div className="flex-grow overflow-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 border-b border-gray-200 text-gray-500"><tr><th className="px-6 py-3 font-medium">Stock</th><th className="px-6 py-3 font-medium text-right">Qty</th><th className="px-6 py-3 font-medium text-right">Avg. Cost</th><th className="px-6 py-3 font-medium text-right">Current</th><th className="px-6 py-3 font-medium text-right">P&L</th></tr></thead><tbody className="divide-y divide-gray-100">{Object.keys(portfolio).length === 0 ? (<tr><td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">No holdings yet.</td></tr>) : Object.entries(portfolio).map(([sym, data]) => { const curr = stocks[sym].currentPrice; const pl = (curr - data.avgPrice) * data.qty; const plPct = ((curr - data.avgPrice) / data.avgPrice) * 100; return (<tr key={sym}><td className="px-6 py-3 font-medium text-gray-700">{sym}</td><td className="px-6 py-3 text-right font-mono">{data.qty}</td><td className="px-6 py-3 text-right font-mono text-gray-500">₹{data.avgPrice.toFixed(2)}</td><td className="px-6 py-3 text-right font-mono">₹{curr.toFixed(2)}</td><td className={`px-6 py-3 text-right font-mono font-medium ${pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pl >= 0 ? '+' : ''}₹{pl.toFixed(2)} ({plPct.toFixed(1)}%)</td></tr>)})}</tbody></table></div>
                    <div className="bg-gray-50 border-t border-gray-200 p-4"><div className="flex justify-end gap-8 text-sm"><div className="text-right"><span className="block text-xs text-gray-500 uppercase tracking-wide">Available Cash</span><span className="font-mono font-medium text-gray-900">₹{cash.toFixed(2)}</span></div><div className="text-right"><span className="block text-xs text-gray-500 uppercase tracking-wide">Invested Value</span><span className="font-mono font-medium text-gray-900">₹{portfolioVal.toFixed(2)}</span></div><div className="text-right"><span className="block text-xs text-gray-500 uppercase tracking-wide">Total Equity</span><span className="font-mono font-bold text-gray-900 text-lg">₹{totalEquity.toFixed(2)}</span></div></div></div>
                 </div>
              )}

              {activeTab === 'TRANSACTIONS' && (
                 <div className="bg-white border border-[#E5E7EB] rounded-sm p-0 overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-gray-50 border-b border-gray-200 text-gray-500"><tr><th className="px-6 py-3 font-medium">Time</th><th className="px-6 py-3 font-medium">Type</th><th className="px-6 py-3 font-medium">Symbol</th><th className="px-6 py-3 font-medium text-right">Qty</th><th className="px-6 py-3 font-medium text-right">Price</th><th className="px-6 py-3 font-medium text-right">Value</th></tr></thead><tbody className="divide-y divide-gray-100">{myTransactions.length === 0 ? (<tr><td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">No transactions yet.</td></tr>) : myTransactions.map((log, i) => (<tr key={i}><td className="px-6 py-3 text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</td><td className={`px-6 py-3 font-bold ${log.type === 'BUY' ? 'text-blue-600' : 'text-orange-600'}`}>{log.type}</td><td className="px-6 py-3 font-medium text-gray-700">{log.symbol}</td><td className="px-6 py-3 text-right font-mono">{log.quantity}</td><td className="px-6 py-3 text-right font-mono">₹{log.price.toFixed(2)}</td><td className="px-6 py-3 text-right font-mono">₹{log.totalValue.toFixed(2)}</td></tr>))}</tbody></table></div>
              )}

              {activeTab === 'LEADERBOARD' && (
                 <div className="max-w-3xl mx-auto">
                    <div className="bg-white border border-[#E5E7EB] rounded-sm overflow-hidden">
                       <div className="bg-gray-900 text-white p-6 flex justify-between items-center"><div><h2 className="text-xl font-light">Performance Ranking</h2><p className="text-xs text-gray-400 mt-1">Live from {leaderboard.length} active participants</p></div><Trophy size={32} className="opacity-50"/></div>
                       <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                          {liveLeaderboard.length === 0 ? <div className="p-8 text-center text-gray-400">Waiting for participants to join...</div> :
                           liveLeaderboard.map((u, idx) => (
                             <div key={u.uid} onClick={() => setViewingUser(u)} className={`flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${u.uid === authUser.uid ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white'}`}>
                                <div className="flex items-center gap-4"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{idx + 1}</div><div><p className={`text-sm font-medium ${u.uid === authUser.uid ? 'text-blue-700' : 'text-gray-700'}`}>{u.name} {u.uid === authUser.uid && '(You)'}</p><p className="text-[10px] text-gray-400">{u.regNo}</p></div></div>
                                <div className={`font-mono font-medium ${u.liveReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>{u.liveReturn > 0 ? '+' : ''}{u.liveReturn ? u.liveReturn.toFixed(2) : '0.00'}%</div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
