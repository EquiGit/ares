import { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Search, 
  Code, 
  Copy, 
  Check, 
  RotateCcw, 
  Play, 
  FileText, 
  Plus, 
  Trash2, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  TrendingUp, 
  Coins, 
  Users, 
  Percent, 
  Smartphone, 
  AlertCircle, 
  ArrowUpRight,
  ExternalLink,
  Sliders,
  Send,
  Info,
  Layers,
  Sparkles,
  RefreshCw,
  Clock,
  Terminal,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Stats } from './types.js';

// Predefined mock SMS payloads for the simulator
const PRESETS = [
  {
    name: 'EazzyPay Merchant Payment',
    type: 'eazzypay',
    description: 'Standard Equity Buy Goods / Till payment alert',
    text: 'EazzyPay: Payment of KES 3,450.00 to Buy Goods Acc 600123 from BENJAMIN KIPROP Ref: EQBK92JS0X on 2026-07-14 11:15:00. Balance KES 173,700.00.'
  },
  {
    name: 'Mobile Bank Transfer (EQBK)',
    type: 'mobile_transfer',
    description: 'Inter-account or direct mobile wallet transfer receipt',
    text: 'EQBK: Mobile Transfer of KES 15,000.00 from SHARON AMANI (254705123456) to Acc. 1223344556 on 2026-07-14 11:25:30. Ref: TRN88YHD6R. Balance: KES 188,700.00.'
  },
  {
    name: 'Equitel P2P Transfer',
    type: 'equitel',
    description: 'Peer-to-peer receipt on Equitel mobile line',
    text: 'Equitel: You have received KES 850.00 from 254764987654 - NICHOLAS ODHIAMBO. Ref: EQT52HJS9P on 2026-07-14 11:32:10. Balance: KES 189,550.00.'
  },
  {
    name: 'Malformed/Non-payment Alert',
    type: 'invalid',
    description: 'System alert SMS (tests failed parsing states)',
    text: 'EQBK: Alert! Your Equity Mobile banking passcode was successfully changed. If this was not you, contact customer service.'
  }
];

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'eazzypay' | 'mobile_transfer' | 'equitel' | 'failed'>('all');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [muteSound, setMuteSound] = useState(() => {
    const saved = localStorage.getItem('equity_dashboard_mute');
    return saved === 'true';
  });
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [customMsgInput, setCustomMsgInput] = useState(PRESETS[0].text);
  const [apiResponse, setApiResponse] = useState<{ status: string; message: string; transaction?: any } | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [systemTime, setSystemTime] = useState('');
  const [streamMode, setStreamMode] = useState<'stream' | 'payers'>('stream');

  // Avatar and Initial generators for high-fidelity branding
  const getInitials = (name: string) => {
    if (!name || name === 'Unknown Customer') return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    if (!name || name === 'Unknown Customer') return 'bg-slate-500 text-white border-slate-600';
    const colors = [
      'bg-blue-600 text-blue-50 border-blue-400',
      'bg-emerald-600 text-emerald-50 border-emerald-400',
      'bg-amber-600 text-amber-50 border-amber-400',
      'bg-violet-600 text-violet-50 border-violet-400',
      'bg-rose-600 text-rose-50 border-rose-400',
      'bg-teal-600 text-teal-50 border-teal-400',
      'bg-indigo-600 text-indigo-50 border-indigo-400',
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  // Group transactions dynamically by unique payer (name + phone)
  const payers = (() => {
    const map = new Map<string, {
      senderName: string;
      senderPhone: string;
      totalPaid: number;
      paymentCount: number;
      lastPayment: string;
      account: string;
      type: 'eazzypay' | 'mobile_transfer' | 'equitel' | 'generic';
    }>();

    transactions.forEach(tx => {
      if (tx.status === 'failed') return; // skip unparsed errors
      const phone = tx.senderPhone || '';
      const key = `${tx.senderName.trim().toUpperCase()}_${phone}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalPaid += tx.amount;
        existing.paymentCount += 1;
        if (new Date(tx.timestamp) > new Date(existing.lastPayment)) {
          existing.lastPayment = tx.timestamp;
          existing.account = tx.account;
        }
      } else {
        map.set(key, {
          senderName: tx.senderName,
          senderPhone: phone || 'No Phone Registered',
          totalPaid: tx.amount,
          paymentCount: 1,
          lastPayment: tx.timestamp,
          account: tx.account,
          type: tx.type,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid);
  })();

  const filteredPayers = payers.filter(payer => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      payer.senderName.toLowerCase().includes(query) ||
      payer.senderPhone.toLowerCase().includes(query) ||
      payer.totalPaid.toString().includes(query)
    );
  });

  // Sound and Connection Refs
  const muteSoundRef = useRef(muteSound);
  useEffect(() => {
    muteSoundRef.current = muteSound;
    localStorage.setItem('equity_dashboard_mute', String(muteSound));
  }, [muteSound]);

  // Dynamic timestamp update for real-time look
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + now.toLocaleTimeString());
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Audio synthesizer for pristine payment chime
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number, type: 'sine' | 'triangle' = 'sine') => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = audioCtx.currentTime;
      // High-quality positive double chime
      playTone(523.25, now, 0.12, 'triangle'); // C5
      playTone(659.25, now + 0.08, 0.12, 'sine'); // E5
      playTone(783.99, now + 0.16, 0.25, 'sine'); // G5
    } catch (e) {
      console.warn('Synthesizer blocked on interaction restriction:', e);
    }
  };

  // Fetch initial transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch('/api/transactions');
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (err) {
        console.error('Error loading initial transactions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  // Set up real-time SSE stream
  useEffect(() => {
    let eventSource: EventSource | null = null;

    function connectSSE() {
      setConnectionStatus('connecting');
      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => {
        setConnectionStatus('connected');
      };

      eventSource.onerror = () => {
        setConnectionStatus('disconnected');
        eventSource?.close();
        // Reconnect schedule
        setTimeout(connectSSE, 5000);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'transaction') {
            setTransactions(prev => {
              // Idempotent protection against duplications
              if (prev.some(t => t.id === payload.data.id || t.reference === payload.data.reference)) {
                return prev;
              }
              if (!muteSoundRef.current) {
                playChime();
              }
              return [payload.data, ...prev];
            });
          } else if (payload.type === 'clear') {
            setTransactions([]);
          }
        } catch (err) {
          console.error('Failed to parse incoming event:', err);
        }
      };
    }

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Compute Statistics
  const getStats = (): Stats => {
    const validTxs = transactions.filter(t => t.status === 'completed');
    const totalAmount = validTxs.reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = validTxs.length;
    const averageAmount = transactionCount > 0 ? totalAmount / transactionCount : 0;

    // Filters for today (using simple localized date matching)
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTxs = validTxs.filter(t => t.timestamp.startsWith(todayStr));
    const todayAmount = todayTxs.reduce((sum, t) => sum + t.amount, 0);
    const todayCount = todayTxs.length;

    return {
      totalAmount,
      transactionCount,
      averageAmount,
      todayAmount,
      todayCount
    };
  };

  const stats = getStats();

  // Clear all transactions handler
  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear all transactions? This action is permanent.')) return;
    try {
      const res = await fetch('/api/transactions/clear', { method: 'POST' });
      if (res.ok) {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Failed to clear transaction records:', err);
    }
  };

  // Trigger Mock Webhook simulation
  const triggerWebhook = async (messageText: string) => {
    setIsSending(true);
    setApiResponse(null);
    try {
      const response = await fetch('/api/webhooks/equity-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: messageText,
      });
      const data = await response.json();
      setApiResponse(data);
    } catch (err: any) {
      setApiResponse({ status: 'error', message: err?.message || 'Network request failed' });
    } finally {
      setIsSending(false);
    }
  };

  // Helper copy to clipboard
  const copyToClipboard = (text: string, type: 'ref' | 'endpoint') => {
    navigator.clipboard.writeText(text);
    if (type === 'ref') {
      setCopiedRef(text);
      setTimeout(() => setCopiedRef(null), 2000);
    } else {
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2500);
    }
  };

  // Filtering transactions
  const filteredTransactions = transactions.filter(tx => {
    // 1. Tab filter
    if (activeTab === 'failed' && tx.status !== 'failed') return false;
    if (activeTab === 'eazzypay' && tx.type !== 'eazzypay') return false;
    if (activeTab === 'mobile_transfer' && tx.type !== 'mobile_transfer') return false;
    if (activeTab === 'equitel' && tx.type !== 'equitel') return false;
    if (activeTab !== 'all' && activeTab !== 'failed' && tx.status === 'failed') return false;

    // 2. Search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.reference.toLowerCase().includes(query) ||
      tx.senderName.toLowerCase().includes(query) ||
      (tx.senderPhone && tx.senderPhone.includes(query)) ||
      tx.amount.toString().includes(query) ||
      tx.account.toLowerCase().includes(query) ||
      tx.rawMessage.toLowerCase().includes(query)
    );
  });

  // Calculate dynamic absolute webhook URL
  const webhookUrl = `${window.location.origin}/api/webhooks/equity-payment`;

  return (
    <div id="dashboard_root" className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
      
      {/* SIDEBAR NAVIGATION - Rich Deep Charcoal Swiss Aesthetic */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        
        {/* Sidebar Brand Header */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-800/60">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-blue-900/40 font-display text-lg tracking-tighter">
            ARES
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-white tracking-tight font-display leading-tight">ARES Gateway</span>
            <span className="text-[9px] text-slate-500 font-medium leading-normal">Ayuoyi's Realtime EquiPay</span>
          </div>
        </div>

        {/* Navigation / Control Panel Links */}
        <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
          
          <div className="space-y-1.5">
            <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Monitor Views</span>
            
            <button
              id="view_live_monitor_btn"
              className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-all shadow-sm"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Monitor stream</span>
            </button>

            <div className="px-3 py-2.5 flex items-center gap-3 text-sm font-medium text-slate-400 opacity-60 cursor-not-allowed">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Transaction History</span>
            </div>

            <div className="px-3 py-2.5 flex items-center gap-3 text-sm font-medium text-slate-400 opacity-60 cursor-not-allowed">
              <Users className="w-4 h-4 text-slate-500" />
              <span>Customer Ledger</span>
            </div>
          </div>

          {/* Quick Settings within Sidebar */}
          <div className="space-y-3 pt-4 border-t border-slate-800/55">
            <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Terminal Settings</span>
            
            {/* Audio Alert state button */}
            <button
              id="sidebar_sound_btn"
              onClick={() => {
                setMuteSound(!muteSound);
                if (muteSound) setTimeout(playChime, 100);
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/40 text-xs flex items-center justify-between text-slate-300 transition-all hover:bg-slate-950"
            >
              <div className="flex items-center gap-2">
                {muteSound ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>Sound Notification</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                muteSound ? 'bg-rose-950/40 text-rose-400' : 'bg-emerald-950/40 text-emerald-400'
              }`}>
                {muteSound ? 'Silent' : 'Chime ON'}
              </span>
            </button>

            {/* Clear Database button */}
            <button
              id="sidebar_clear_btn"
              onClick={handleClear}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-800/60 hover:border-rose-900 hover:bg-rose-950/20 text-xs flex items-center gap-2 text-slate-400 hover:text-rose-400 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Transaction DB</span>
            </button>
          </div>

          {/* Connection Status Log widget */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase block tracking-wider">Gateway status</span>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'
              }`} />
              <span className="text-xs font-mono text-slate-300 capitalize">{connectionStatus}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Listening for remote HTTP POST webhooks on local interface port.
            </p>
          </div>

        </div>

        {/* Sidebar Footer User Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs">
              AF
            </div>
            <div className="text-xs overflow-hidden">
              <p className="text-white font-semibold truncate" title="Ayuoyi Frank Odhiambo">Ayuoyi F. Odhiambo</p>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">ARES Owner</p>
            </div>
          </div>
        </div>

      </aside>

      {/* MAIN CONTENT CANVAS */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOP HEADER BAR - Clean Light Style */}
        <header id="top_app_header" className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
              <span className="text-blue-600 font-black">ARES</span>
              <span className="text-slate-300 font-normal">|</span>
              <span className="text-slate-600 text-xs sm:text-sm font-normal">Ayuoyi's Realtime EquiPay System</span>
            </h1>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200/50 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs font-mono text-slate-500" title="Receive endpoint URL">
                Webhook: operational.local.v3
              </span>
            </div>
            <div className="hidden md:block w-px h-8 bg-slate-200" />
            <span className="text-xs text-slate-400 font-mono font-medium">
              {systemTime || 'July 14, 2026 · 11:35:00'}
            </span>
          </div>
        </header>

        {/* PRIMARY CONTAINER SCROLL BODY */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50">
          
          {/* STATS ROW - Beautiful White Shadow Box Widgets */}
          <section id="stats_dashboard" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Stat Box 1: Total Inflow */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-2 right-2 p-1 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Total Inflow (24h)
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2 font-display">
                KES {stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium mt-2">
                <span>Active stream matched</span>
              </div>
            </div>

            {/* Stat Box 2: Today Earnings */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-2 right-2 p-1 bg-amber-50 text-amber-600 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Today's Earnings
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2 font-display text-amber-600">
                KES {stats.todayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-2">
                <span>{stats.todayCount} distinct receipts</span>
              </div>
            </div>

            {/* Stat Box 3: Active Customers / Count */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-2 right-2 p-1 bg-blue-50 text-blue-600 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Total Payments
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2 font-display">
                {stats.transactionCount}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-2">
                <span>Matched IPN transactions</span>
              </div>
            </div>

            {/* Stat Box 4: Mean Ticket Size */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-2 right-2 p-1 bg-slate-100 text-slate-600 rounded-lg">
                <Percent className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Average Value
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2 font-display">
                KES {stats.averageAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-2 font-mono text-[10px]">
                <span>Mean revenue ticket</span>
              </div>
            </div>

          </section>

          {/* TWO PANEL INTERACTION GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT AREA: Transaction Stream Feed (7 columns) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Stream Feed Wrapper */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                
                {/* Header controls & stats */}
                <div className="p-5 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="font-bold text-slate-800 text-sm tracking-tight font-display uppercase">
                        {streamMode === 'stream' ? 'Live Equity Inflow Stream' : 'Payer Accounts Ledger'}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {streamMode === 'stream' 
                        ? 'Real-time parsed SMS instant payments matching' 
                        : 'Aggregated list of unique depositors sorted by highest cash contribution'}
                    </p>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto">
                    {/* Mode Toggle Button */}
                    <div className="bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 flex items-center shrink-0">
                      <button
                        onClick={() => setStreamMode('stream')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          streamMode === 'stream' 
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Payments Stream
                      </button>
                      <button
                        onClick={() => setStreamMode('payers')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                          streamMode === 'payers' 
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        Who Paid Me
                      </button>
                    </div>

                    {/* Search Field */}
                    <div className="relative flex-1 sm:w-48">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        id="tx_search_input_refined"
                        type="text"
                        placeholder={streamMode === 'stream' ? "Search ref, sender, phone..." : "Search payer name, phone..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Categories Filters & Segmented Controller */}
                {streamMode === 'stream' && (
                  <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-wrap gap-1.5 items-center">
                    {(['all', 'eazzypay', 'mobile_transfer', 'equitel', 'failed'] as const).map((tab) => {
                      const isActive = activeTab === tab;
                      const label = tab === 'all' 
                        ? 'All' 
                        : tab === 'mobile_transfer' 
                        ? 'EQ Mobile' 
                        : tab === 'eazzypay' 
                        ? 'EazzyPay' 
                        : tab === 'equitel'
                        ? 'Equitel'
                        : 'Errors';

                      const count = transactions.filter(t => {
                        if (tab === 'all') return true;
                        if (tab === 'failed') return t.status === 'failed';
                        return t.type === tab && t.status !== 'failed';
                      }).length;

                      return (
                        <button
                          key={tab}
                          id={`filter_tab_polish_${tab}`}
                          onClick={() => setActiveTab(tab)}
                          className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-blue-600 text-white font-semibold shadow-sm' 
                              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                          }`}
                        >
                          {label} <span className={`text-[10px] ml-1 px-1.5 py-0.2 rounded-full ${
                            isActive ? 'bg-blue-700 text-white font-bold' : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Feed Table/Items */}
                <div className="divide-y divide-slate-100 min-h-[400px]">
                  <AnimatePresence initial={false}>
                    {isLoading ? (
                      <div className="p-12 text-center space-y-2">
                        <Activity className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                        <p className="text-xs font-medium text-slate-500">Retrieving Equity Database...</p>
                      </div>
                    ) : streamMode === 'payers' ? (
                      filteredPayers.length === 0 ? (
                        <div className="p-16 text-center space-y-3">
                          <Users className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-xs font-semibold text-slate-600">No depositors detected yet</p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {searchQuery ? 'Adjust your search queries.' : 'Forward incoming SMS alerts to start populating your payer registry.'}
                          </p>
                        </div>
                      ) : (
                        filteredPayers.map((payer, idx) => {
                          const initials = getInitials(payer.senderName);
                          const avatarColor = getAvatarColor(payer.senderName);
                          return (
                            <motion.div
                              key={payer.senderName + payer.senderPhone}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-5 hover:bg-slate-50/75 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="flex items-center gap-3.5">
                                <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-bold shadow-sm shrink-0 ${avatarColor}`}>
                                  {initials}
                                </div>
                                <div className="space-y-0.5">
                                  <h4 className="text-sm font-bold text-slate-800">
                                    {payer.senderName}
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                                    <span className="font-mono bg-slate-100 px-1 rounded text-slate-600 font-bold">{payer.senderPhone}</span>
                                    <span>•</span>
                                    <span className="text-[11px]">
                                      Acc: <span className="font-mono font-bold text-slate-600">{payer.account}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-left sm:text-right flex sm:flex-col justify-between items-center sm:items-end border-t sm:border-0 pt-2 sm:pt-0 border-slate-100">
                                <p className="text-base font-bold text-slate-900 font-display">
                                  + KES {payer.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {payer.paymentCount} {payer.paymentCount === 1 ? 'payment' : 'payments'}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-100 rounded font-sans capitalize">
                                    {payer.type === 'eazzypay' ? 'EazzyPay' : payer.type === 'mobile_transfer' ? 'EQ Mobile' : payer.type === 'equitel' ? 'Equitel' : 'Equity'}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      )
                    ) : filteredTransactions.length === 0 ? (
                      <div className="p-16 text-center space-y-3">
                        <Info className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-600">No matching payments stream</p>
                        <p className="text-[11px] text-slate-400">
                          {searchQuery ? 'Adjust your search queries.' : 'Use the webhook tester to dispatch live messages.'}
                        </p>
                      </div>
                    ) : (
                      filteredTransactions.map((tx, idx) => {
                        const isNew = idx === 0 && Date.now() - new Date(tx.timestamp).getTime() < 12000;
                        const isExpanded = selectedTxId === tx.id;

                        // Beautiful stylized badges matching "Professional Polish"
                        let statusBadge = (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[11px] font-bold border border-emerald-200/50 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            VERIFIED
                          </span>
                        );
                        let typeLabel = 'Equity';
                        let typeColor = 'bg-slate-100 text-slate-600 border-slate-200';

                        if (tx.status === 'failed') {
                          statusBadge = (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[11px] font-bold border border-rose-200/50 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-rose-500" />
                              PARSE ERR
                            </span>
                          );
                          typeLabel = 'Alert';
                          typeColor = 'bg-rose-50 text-rose-500 border-rose-100';
                        } else if (tx.type === 'eazzypay') {
                          typeLabel = 'EazzyPay';
                          typeColor = 'bg-amber-50 text-amber-700 border-amber-200/50';
                        } else if (tx.type === 'mobile_transfer') {
                          typeLabel = 'EQ Mobile';
                          typeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
                        } else if (tx.type === 'equitel') {
                          typeLabel = 'Equitel';
                          typeColor = 'bg-blue-50 text-blue-700 border-blue-200/50';
                        }

                        const initials = getInitials(tx.senderName);
                        const avatarColor = getAvatarColor(tx.senderName);

                        return (
                          <motion.div
                            key={tx.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`p-5 transition-colors hover:bg-slate-50/70 relative ${
                              isNew ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            {/* Flashing new payment side indicator */}
                            {isNew && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                            )}

                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                              
                              <div className="flex items-start gap-3 flex-1 w-full">
                                <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-bold shadow-sm shrink-0 ${
                                  tx.status === 'failed' ? 'bg-rose-50 text-rose-500 border-rose-200 font-sans' : avatarColor
                                }`}>
                                  {tx.status === 'failed' ? 'ERR' : initials}
                                </div>

                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-slate-800 text-sm truncate max-w-xs">
                                      {tx.senderName}
                                    </span>
                                    {tx.senderPhone && (
                                      <span className="text-xs text-slate-400 font-mono">
                                        ({tx.senderPhone})
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                                    <span className="flex items-center gap-1.5">
                                      Receipt:
                                      <button
                                        onClick={() => copyToClipboard(tx.reference, 'ref')}
                                        className="font-mono text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-all py-0.5 px-2 rounded-md flex items-center gap-1 font-bold border border-slate-200/60 cursor-pointer"
                                        title="Copy Receipt Reference"
                                      >
                                        {tx.reference}
                                        {copiedRef === tx.reference ? (
                                          <Check className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-2.5 h-2.5 text-slate-400" />
                                        )}
                                      </button>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Acc: <span className="font-mono bg-slate-100 text-slate-600 px-1 rounded">{tx.account}</span>
                                    </span>
                                    <span>•</span>
                                    <span className="font-mono text-slate-400 text-[11px]">
                                      {new Date(tx.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Amount & Verify Status Badge */}
                              <div className="flex sm:flex-col items-baseline sm:items-end gap-2 shrink-0 w-full sm:w-auto justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                                {tx.status === 'failed' ? (
                                  <span className="text-rose-500 font-bold text-sm">Unparsed</span>
                                ) : (
                                  <span className="text-slate-950 font-bold text-base sm:text-lg font-display">
                                    + KES {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                                {statusBadge}
                              </div>

                            </div>

                            {/* Actions drawer & badges */}
                            <div className="mt-4 flex items-center justify-between gap-4">
                              <div className="flex gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${typeColor}`}>
                                  {typeLabel}
                                </span>
                                {tx.balance !== undefined && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 font-mono">
                                    Bal: KES {tx.balance.toLocaleString()}
                                  </span>
                                )}
                              </div>

                              <button
                                id={`tx_msg_toggle_${tx.id}`}
                                onClick={() => setSelectedTxId(isExpanded ? null : tx.id)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                {isExpanded ? 'Hide SMS Payload' : 'Inspect SMS Raw'}
                              </button>
                            </div>

                            {/* SMS Body Expanded Drawer */}
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 p-3.5 bg-slate-900 text-slate-300 rounded-lg border border-slate-800 overflow-hidden font-mono text-xs space-y-2"
                              >
                                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest font-sans font-bold border-b border-slate-800 pb-1.5">
                                  <span>Raw SMS Stream Body</span>
                                  <button
                                    onClick={() => copyToClipboard(tx.rawMessage, 'ref')}
                                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" /> Copy Text
                                  </button>
                                </div>
                                <p className="text-amber-400 leading-relaxed break-words">{tx.rawMessage}</p>
                              </motion.div>
                            )}

                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>

                {/* Table Footer Listener status */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                  <div className="animate-pulse w-2 h-2 rounded-full bg-blue-600"></div>
                  <span className="text-[11px] text-slate-500 font-bold tracking-wider font-mono">
                    {streamMode === 'stream' ? 'LISTENING FOR INCOMING WEBHOOK IPNs...' : 'PAYER DATABASE SYNCHRONIZED'}
                  </span>
                </div>

              </div>

            </div>

            {/* RIGHT AREA: Webhook Simulator & Integration Panel (5 columns) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Webhook Test Simulation Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4.5 h-4.5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800 font-display uppercase tracking-tight">
                    IPN Webhook Simulator Sandbox
                  </h3>
                </div>
                
                <p className="text-xs text-slate-500 leading-relaxed">
                  Post sample Equity Bank SMS structures directly to the live server webhook endpoint to simulate dynamic database parsing and stream updates.
                </p>

                {/* Preset messages selection row */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Choose preset message templates:
                  </span>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        id={`polish_preset_btn_${idx}`}
                        onClick={() => setCustomMsgInput(preset.text)}
                        className="text-left p-2.5 bg-slate-50 border border-slate-200 hover:bg-blue-50/40 hover:border-blue-300 rounded-lg transition-all flex flex-col gap-1 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">
                            {preset.name}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-200/60 text-slate-600 font-bold capitalize">
                            {preset.type}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* SMS body payload text container */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Custom SMS Message Payload:
                  </label>
                  <textarea
                    id="polish_sms_textarea"
                    value={customMsgInput}
                    onChange={(e) => setCustomMsgInput(e.target.value)}
                    placeholder="Enter raw transaction SMS here..."
                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all leading-relaxed"
                  />
                </div>

                {/* Webhook submit button */}
                <button
                  id="polish_post_webhook_btn"
                  onClick={() => triggerWebhook(customMsgInput)}
                  disabled={isSending || !customMsgInput.trim()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-semibold rounded-lg text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <Activity className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Event...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Post SMS to Webhook Receiver</span>
                    </>
                  )}
                </button>

                {/* API Response debugger log display */}
                {apiResponse && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900 text-slate-300 font-mono text-xs">
                    <div className="bg-slate-800 px-3 py-1.5 flex items-center justify-between border-b border-slate-950">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase font-sans">
                        HTTP REST Response Log
                      </span>
                      <span className={`font-semibold ${
                        apiResponse.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {apiResponse.status === 'success' ? '201 Created' : '409 Conflict'}
                      </span>
                    </div>
                    <pre className="p-3 text-[10px] overflow-x-auto max-h-36 leading-relaxed whitespace-pre-wrap select-all">
                      {JSON.stringify(apiResponse, null, 2)}
                    </pre>
                  </div>
                )}

              </div>

              {/* API Integration Guide Details Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Code className="w-4.5 h-4.5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800 font-display uppercase tracking-tight">
                    Webhook Gateway Setup
                  </h3>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Feed live messages directly from actual physical mobile gateways. Configure any SMS forwarder application to forward alerts to this URL.
                </p>

                {/* Target Webhook endpoint display */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                    Public Webhook URL (POST)
                  </span>
                  
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[9px] bg-blue-100 text-blue-700 font-mono py-0.5 px-1.5 rounded font-bold">
                      POST
                    </span>
                    <code className="text-xs font-mono text-slate-700 truncate select-all flex-1">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(webhookUrl, 'endpoint')}
                      className="text-slate-400 hover:text-blue-600 transition-colors p-1 cursor-pointer"
                      title="Copy webhook URL"
                    >
                      {copiedEndpoint ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Curl Code Example */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                    cURL IPN Forwarder Script
                  </span>
                  <div className="relative group">
                    <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300 overflow-x-auto whitespace-pre leading-relaxed">
{`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: text/plain" \\
  -d "EazzyPay: Payment of KES 1,500.00 from ALBERT KIPLAGAT Ref: EQB28FSA8U on 2026-07-14 Acc 600123"`}
                    </pre>
                  </div>
                </div>

                {/* Setup guidelines box */}
                <div className="p-4 bg-blue-50/55 border border-blue-100 rounded-lg flex items-start gap-2 text-slate-600">
                  <HelpCircle className="w-4.5 h-4.5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-semibold text-slate-800 block">Integration Tip:</span>
                    <p className="leading-relaxed text-[11px] text-slate-500">
                      When installing SMS forwarding utilities on Android devices containing the Equity till SIM card, configure trigger matching rules for text originating from sender IDs <strong className="text-slate-800">"EQBK"</strong>, <strong className="text-slate-800">"EazzyPay"</strong> or <strong className="text-slate-800">"Equitel"</strong> to maintain full parsing reliability.
                    </p>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}
