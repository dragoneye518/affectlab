import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Sparkles, Zap, User, RefreshCw, Share2, Download, Candy, X, Search, Radar, Backpack, LayoutGrid, Gift, CheckCircle2, ChevronRight, Fingerprint, Copy, ArrowUpRight, PlayCircle, Send, AlertTriangle, ShieldCheck, Crown, CalendarClock, Trophy, Flame, RotateCcw, Timer, Wand2, ArrowRightCircle } from 'lucide-react';
import { Template, ViewState, GeneratedResult, Rarity } from './types';
import { TEMPLATES, MOCK_GENERATED_IMAGES, getThematicImage, getTemplateKeywords } from './constants';

// --- Utils ---

const generateHash = (str: string) => {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; 
    }
    return Math.abs(hash);
};

// --- DeepSeek AI Logic ---

// System instruction for the "Cyber Emotion Translator"
const SYSTEM_INSTRUCTION = `
You are a "Cyber Emotion Translator" for a Gen Z pixel art app.
Your goal is to take raw, boring user input and rewrite it into short, punchy, "Internet Vibe" text.
You must also check if the input matches a specific existing template theme.

Existing Templates:
- energy-daily: General luck, energy, horoscopes.
- roast-boss: Work, boss, salary, hating job.
- ex-reply: Ex-boyfriend/girlfriend, breakups.
- pet-voice: Pets, cats, dogs.
- sleep-wallpaper: Insomnia, late night.
- relative-shield: Annoying relatives, questions about marriage/money.
- diet-excuse: Food, diet, milk tea.

Output JSON format:
{
  "options": [
    { "style": "TOXIC", "text": "..." }, // Sharp, sarcastic, funny, aggressive
    { "style": "EMO", "text": "..." },   // Sad, poetic, deep, lonely
    { "style": "GLITCH", "text": "..." } // Abstract, robotic, system error style
  ],
  "recommendedTemplateId": "string" // The ID of a matching template from the list above, or null if no strong match.
}

Rules:
1. Keep text under 40 characters (Chinese preferred if input is Chinese).
2. "TOXIC" should be funny/aggressive.
3. "EMO" should be atmospheric.
4. "GLITCH" should sound like a computer terminal (e.g. "Error 404: Emotion not found").
`;

interface AIPolishResult {
    options: { style: string, text: string }[];
    recommendedTemplateId: string | null;
}

const polishTextWithDeepSeek = async (inputText: string): Promise<AIPolishResult | null> => {
    // Robust Fallback Generator to ensure UX continuity if API fails (CORS/Network)
    const getFallbackResult = (input: string): AIPolishResult => ({
         options: [
            { style: "TOXIC", text: `嘴替模式已加载：${input} 听起来很酷。` },
            { style: "EMO", text: `检测到低频情绪波动... 关于 "${input}"` },
            { style: "GLITCH", text: `SYSTEM_OVERRIDE >> "${input}"` }
         ],
         recommendedTemplateId: null
    });

    try {
        const apiKey = "sk-f7c467046bc74522b55656ce80a3d004";
        
        if (!apiKey) {
            console.warn("API Key missing, using offline mode.");
            return getFallbackResult(inputText);
        }

        // Using standard fetch. Note: In some browser environments, this may be blocked by CORS.
        // If "Failed to fetch" occurs, we catch it below and return the fallback silently.
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: SYSTEM_INSTRUCTION },
                    { role: "user", content: inputText }
                ],
                stream: false,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            // API returned an error (e.g. 401, 429, 500)
            console.warn(`DeepSeek API Non-OK Status: ${response.status}`);
            return getFallbackResult(inputText);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (content) {
            return JSON.parse(content) as AIPolishResult;
        }
        return getFallbackResult(inputText);

    } catch (e) {
        // Network Error (e.g. Failed to fetch / CORS blocking)
        // Log as warning instead of error to keep console clean for the user
        console.warn("AI Polish switched to offline mode (Network/CORS issue).");
        return getFallbackResult(inputText);
    }
};


// --- Helper Components ---

const Confetti = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles: any[] = [];
        const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ffffff'];

        for (let i = 0; i < 100; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                size: Math.random() * 8 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 100
            });
        }

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = false;
            particles.forEach(p => {
                if (p.life > 0) {
                    active = true;
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.5; // Gravity
                    p.life--;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, p.size, p.size);
                }
            });
            if (active) requestAnimationFrame(animate);
        };
        animate();
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[80]" />;
};

const Toast = ({ message, visible }: { message: string, visible: boolean }) => (
    <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur text-white px-6 py-3 rounded-full text-sm font-bold z-[100] transition-opacity duration-300 pointer-events-none flex items-center gap-2 border border-white/20 shadow-xl ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <CheckCircle2 size={16} className="text-neon-green" />
        {message}
    </div>
);

// 3D Holographic Card Component
interface HoloCardProps {
    children?: React.ReactNode;
    rarity: Rarity;
    className?: string;
    onClick?: () => void;
}

const HoloCard = ({ 
    children, 
    rarity, 
    className = "",
    onClick 
}: HoloCardProps) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
    const [shineOpacity, setShineOpacity] = useState(0);
    const [shinePos, setShinePos] = useState({ x: 0, y: 0 });

    const isSSR = rarity === 'SSR';

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!cardRef.current) return;
        
        const card = cardRef.current;
        const rect = card.getBoundingClientRect();
        
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const intensity = isSSR ? 20 : 10;
        const rotateX = ((y - centerY) / centerY) * -intensity;
        const rotateY = ((x - centerX) / centerX) * intensity;
        
        setTransform(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`);
        
        setShineOpacity(isSSR ? 0.6 : 0.3);
        setShinePos({ 
            x: (x / rect.width) * 100, 
            y: (y / rect.height) * 100 
        });
    };

    const handleLeave = () => {
        setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
        setShineOpacity(0);
    };

    return (
        <div 
            ref={cardRef}
            className={`relative transition-transform duration-200 ease-out will-change-transform ${className}`}
            style={{ transform }}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            onTouchMove={handleMove}
            onTouchEnd={handleLeave}
            onClick={onClick}
        >
            {children}
            
            <div 
                className="absolute inset-0 pointer-events-none z-20 mix-blend-overlay rounded-xl"
                style={{
                    background: `radial-gradient(circle at ${shinePos.x}% ${shinePos.y}%, rgba(255,255,255,${shineOpacity}), transparent 60%)`,
                }}
            ></div>
            
            {isSSR && (
                <div 
                    className="absolute inset-0 pointer-events-none z-10 mix-blend-color-dodge opacity-30 rounded-xl"
                    style={{
                         background: 'linear-gradient(115deg, transparent 20%, #ff00ff 40%, #00ffff 60%, transparent 80%)',
                         backgroundSize: '200% 200%',
                         backgroundPosition: `${shinePos.x}% ${shinePos.y}%`
                    }}
                ></div>
            )}
        </div>
    );
};

const DailySignInModal = ({ onClose, onClaim, canClaim }: { onClose: () => void, onClaim: () => void, canClaim: boolean }) => (
    <div className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
        <div className="w-full max-w-sm p-6 text-center relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className={`w-24 h-24 bg-neon-yellow/20 rounded-full blur-xl ${canClaim ? 'animate-pulse' : ''}`}></div>
                <Gift size={64} className={`text-neon-yellow relative z-10 ${canClaim ? 'animate-bounce' : 'grayscale opacity-50'}`} />
            </div>
            
            <h2 className="text-3xl font-black italic text-white mt-12 mb-2">每日补给</h2>
            <p className="text-gray-400 text-sm mb-8">Daily Energy Supply</p>
            
            <div className={`bg-dark-800 border ${canClaim ? 'border-neon-yellow/50' : 'border-white/10'} rounded-xl p-6 mb-8 transform rotate-1 transition-colors`}>
                <div className={`text-4xl font-black flex items-center justify-center gap-2 ${canClaim ? 'text-neon-yellow' : 'text-gray-500'}`}>
                    +10 <Candy size={32} fill="currentColor" />
                </div>
                <p className="text-xs text-gray-500 mt-2 font-mono">NEXT REFRESH: 24:00:00</p>
            </div>

            <button 
                onClick={onClaim}
                disabled={!canClaim}
                className={`btn-neon-glow w-full font-bold py-4 rounded-xl text-lg transition-transform ${
                    canClaim 
                    ? 'bg-white text-black hover:scale-105 hover:bg-neon-yellow' 
                    : 'bg-dark-700 text-gray-500 cursor-not-allowed border border-white/5'
                }`}
            >
                {canClaim ? '收入囊中 (CLAIM)' : '今日已领取 (CLAIMED)'}
            </button>
            
            {!canClaim && (
                <button onClick={onClose} className="mt-4 text-sm text-gray-400 underline">
                    关闭
                </button>
            )}
        </div>
    </div>
);

const ShareOverlay = ({ onClose }: { onClose: () => void }) => (
    <div onClick={onClose} className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col p-8 animate-in fade-in duration-200 cursor-pointer">
        <div className="flex justify-end">
             <ArrowUpRight className="text-white animate-bounce" size={48} />
        </div>
        <div className="mt-4 text-right">
            <h3 className="text-2xl font-bold text-white mb-2">点击右上角</h3>
            <p className="text-gray-300">发送给朋友或分享到朋友圈</p>
            <p className="text-neon-pink text-sm mt-4 font-mono">SHOW OFF YOUR VIBE</p>
            <p className="text-xs text-gray-500 mt-2">好友打开后将看到这张卡片</p>
        </div>
    </div>
);

const AdOverlay = ({ onComplete, type = 'CANDY' }: { onComplete: () => void, type?: 'CANDY' | 'REROLL' }) => {
    const [timeLeft, setTimeLeft] = useState(5); 
    
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in zoom-in duration-300">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-purple-900 flex flex-col items-center justify-center">
                <div className="w-64 h-64 bg-white/10 rounded-xl flex items-center justify-center mb-8 animate-pulse relative overflow-hidden">
                    <span className="text-white/50 font-black text-2xl relative z-10">ADVERTISEMENT</span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent animate-shine"></div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                    {type === 'REROLL' ? '正在连接高维宇宙...' : '能量补充中...'}
                </h2>
                <p className="text-gray-400 text-sm">观看完整视频获取奖励</p>
             </div>

             <div className="absolute top-4 right-4 bg-black/50 backdrop-blur px-4 py-2 rounded-full border border-white/20">
                 {timeLeft > 0 ? (
                     <span className="text-white font-mono font-bold text-sm">广告 {timeLeft}s</span>
                 ) : (
                     <button 
                        onClick={onComplete}
                        className="text-neon-green font-bold text-sm flex items-center gap-1 animate-pulse"
                     >
                        <X size={14} /> 关闭领取
                     </button>
                 )}
             </div>
        </div>
    );
};

// --- Navbar & Nav ---

const Navbar = ({ candyCount, setView, onWatchAd, onOpenDaily, canClaimDaily }: { 
    candyCount: number, 
    setView: (v: ViewState) => void,
    onWatchAd: () => void,
    onOpenDaily: () => void,
    canClaimDaily: boolean
}) => (
  <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-dark-900/90 backdrop-blur-md border-b border-white/5 flex justify-between items-center max-w-md mx-auto touch-none select-none">
    <div className="flex items-center gap-2 active:opacity-70 transition-opacity cursor-pointer" onClick={() => setView('HOME')}>
      <div className="w-8 h-8 bg-gradient-to-tr from-neon-pink to-neon-blue rounded-lg flex items-center justify-center relative overflow-hidden group shadow-[0_0_10px_rgba(255,0,255,0.3)]">
        <span className="font-bold text-white text-lg relative z-10">P</span>
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-white tracking-wider text-sm leading-none">CANDY PIXEL</span>
        <span className="text-[8px] text-neon-blue tracking-widest font-mono scale-90 origin-left">赛博情绪实验室</span>
      </div>
    </div>
    
    <div className="flex items-center gap-3">
        {/* Daily Gift Button */}
        <button 
            onClick={onOpenDaily}
            className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-300 active:scale-95 relative ${canClaimDaily ? 'bg-neon-yellow/10 border-neon-yellow text-neon-yellow shadow-[0_0_10px_rgba(255,255,0,0.3)]' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}
        >
            <Gift size={16} />
            {canClaimDaily && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-black"></span>
                </span>
            )}
        </button>

        <button 
            onClick={onWatchAd}
            className="btn-neon-glow flex items-center gap-1 bg-gradient-to-r from-neon-purple/20 to-neon-pink/20 border border-neon-purple/50 px-2.5 py-1.5 rounded-full active:scale-95 transition-transform"
        >
            <PlayCircle size={14} className="text-neon-pink animate-[pulse_2s_infinite]" />
            <span className="text-[10px] font-bold text-neon-pink">+5</span>
        </button>

        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all duration-300 ${candyCount < 3 ? 'bg-red-500/20 border-red-500 animate-pulse' : 'bg-white/5 border-white/10'}`}>
            <Candy size={14} className={candyCount < 3 ? "text-red-500" : "text-neon-yellow"} fill="currentColor" />
            <span className={`font-mono font-bold text-sm min-w-[20px] text-center ${candyCount < 3 ? "text-red-500" : "text-neon-yellow"}`}>{candyCount}</span>
        </div>
    </div>
  </div>
);

const BottomNav = ({ view, setView, onOpenRadar }: { view: ViewState, setView: (v: ViewState) => void, onOpenRadar: () => void }) => (
  <div className="fixed bottom-0 left-0 right-0 z-50 bg-dark-900 border-t border-white/10 safe-bottom max-w-md mx-auto touch-none select-none">
    <div className="flex justify-around items-center h-16">
      <button 
        onClick={() => setView('HOME')}
        className={`flex flex-col items-center gap-1 transition-colors active:scale-90 duration-200 ${view === 'HOME' ? 'text-neon-blue' : 'text-gray-500'}`}
      >
        <LayoutGrid size={24} fill={view === 'HOME' ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">胶囊</span>
      </button>
      
      <div className="relative -top-5">
        <button 
           onClick={onOpenRadar} 
           className="btn-neon-glow group w-14 h-14 bg-dark-900 rounded-full flex items-center justify-center border-4 border-dark-900 shadow-[0_0_0_1px_rgba(255,255,255,0.1)] active:scale-90 transition-transform overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-neon-pink to-neon-purple opacity-100 group-hover:opacity-90 transition-opacity"></div>
          <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(255,255,255,0.5)_360deg)] animate-[spin_2s_linear_infinite] opacity-50"></div>
          <Radar size={24} className="text-white relative z-10" />
        </button>
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 w-full text-center">雷达</span>
      </div>

      <button 
        onClick={() => setView('MINE')}
        className={`flex flex-col items-center gap-1 transition-colors active:scale-90 duration-200 ${view === 'MINE' ? 'text-neon-pink' : 'text-gray-500'}`}
      >
        <Backpack size={24} fill={view === 'MINE' ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">背包</span>
      </button>
    </div>
  </div>
);

// --- UPDATED: Radar (Category Overlay) UI ---
const CategoryOverlay = ({ 
    isOpen, 
    onClose, 
    onSelectCategory, 
    onSearch,
    currentCategory,
    currentSearch
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    onSelectCategory: (cat: string | null) => void,
    onSearch: (term: string) => void,
    currentCategory: string | null,
    currentSearch: string
}) => {
    const [searchTerm, setSearchTerm] = useState(currentSearch);
    
    // Sync state when reopening
    useEffect(() => {
        if(isOpen) setSearchTerm(currentSearch);
    }, [isOpen, currentSearch]);
    
    if (!isOpen) return null;

    const categories = [
        { id: 'lucky', label: '能量指南', sub: 'LUCKY GUIDE', color: 'border-yellow-500 text-yellow-500 bg-yellow-500/10' },
        { id: 'sharp', label: '高情商嘴替', sub: 'SHARP REPLY', color: 'border-red-500 text-red-500 bg-red-500/10' },
        { id: 'persona', label: '社交人设', sub: 'SOCIAL MASK', color: 'border-neon-green text-neon-green bg-neon-green/10' },
        { id: 'future', label: '2026 未来', sub: 'FUTURE 2026', color: 'border-neon-purple text-neon-purple bg-neon-purple/10' },
    ];

    const tags = ["#搞钱", "#发疯", "#水逆", "#恋爱", "#离职", "#社恐", "#蛇年"];

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(searchTerm);
        onClose();
    };

    const handleClear = () => {
        onSelectCategory(null);
        onSearch("");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl animate-in fade-in duration-200 flex flex-col p-6 touch-none">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

            <div className="flex justify-between items-center mb-8 relative z-10">
                <div className="flex items-center gap-2">
                    <Radar className="text-neon-pink animate-spin-slow" />
                    <span className="font-bold text-lg tracking-widest">RADAR_V2.0</span>
                </div>
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 active:scale-90 transition-transform">
                    <X className="text-white" />
                </button>
            </div>

            <form onSubmit={handleSearch} className="relative mb-8 z-10">
                <input 
                    type="text" 
                    placeholder="探测关键词..." 
                    className="w-full bg-dark-800 border border-white/20 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-neon-pink transition-colors focus:shadow-[0_0_10px_rgba(255,0,255,0.2)] font-mono"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    enterKeyHint="search"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </form>

            <div className="mb-8 z-10">
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Zap size={12} /> 信号频道 (CHANNELS)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {categories.map(cat => (
                        <button 
                            key={cat.id}
                            onClick={() => { onSelectCategory(cat.id); onSearch(""); onClose(); }}
                            className={`
                                relative py-4 px-3 rounded-xl border transition-all duration-300 active:scale-95 group overflow-hidden
                                ${currentCategory === cat.id 
                                    ? `${cat.color} shadow-[0_0_15px_rgba(255,255,255,0.1)] ring-1 ring-white/50` 
                                    : 'border-white/10 bg-dark-800 text-gray-400 hover:border-white/30'
                                }
                            `}
                        >
                            <div className="flex flex-col items-start relative z-10">
                                <span className={`font-black text-sm mb-1 ${currentCategory === cat.id ? 'text-white' : ''}`}>{cat.label}</span>
                                <span className="text-[10px] font-mono opacity-70">{cat.sub}</span>
                            </div>
                            {/* Selection Indicator */}
                            {currentCategory === cat.id && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white animate-pulse"></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="z-10 flex-1">
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Flame size={12} /> 热门频段 (TRENDING)
                </h3>
                <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                        <button 
                            key={tag}
                            onClick={() => { onSearch(tag.replace('#', '')); onSelectCategory(null); onClose(); }}
                            className={`
                                border px-4 py-2 rounded-full text-xs font-medium transition-colors active:scale-95
                                ${searchTerm === tag.replace('#', '') 
                                    ? 'bg-neon-blue/20 border-neon-blue text-neon-blue shadow-[0_0_10px_rgba(0,255,255,0.3)]' 
                                    : 'bg-dark-800 border-white/10 text-gray-300 hover:border-white/40'
                                }
                            `}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            <button 
                onClick={handleClear}
                className="w-full mt-auto py-4 rounded-xl border border-white/10 bg-white/5 text-gray-400 text-sm font-bold hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 z-10"
            >
                <RotateCcw size={16} /> 重置雷达 (RESET SIGNAL)
            </button>
        </div>
    );
};

// --- UPDATED: InputOverlay with REAL AI Polish ---
const InputOverlay = ({ 
    template, 
    initialValue = "", 
    onCancel, 
    onConfirm,
    onSwitchTemplate 
}: { 
    template: Template, 
    initialValue?: string, 
    onCancel: () => void, 
    onConfirm: (text: string) => void,
    onSwitchTemplate?: (templateId: string) => void 
}) => {
    const [input, setInput] = useState(initialValue);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isPolishing, setIsPolishing] = useState(false);
    const [polishOptions, setPolishOptions] = useState<AIPolishResult['options'] | null>(null);
    const [recommendedId, setRecommendedId] = useState<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 300);
    }, []);

    const handleConfirm = () => {
        setIsAnimating(true);
        setTimeout(() => {
            onConfirm(input || "无题");
        }, 800);
    };

    // REAL DeepSeek AI Polish Logic
    const handleAIPolish = async () => {
        if (!input.trim() || isPolishing) return;
        setIsPolishing(true);
        setPolishOptions(null);
        setRecommendedId(null);
        
        const result = await polishTextWithDeepSeek(input);
        
        if (result) {
            setPolishOptions(result.options);
            // Only suggest switch if it's different from current
            if (result.recommendedTemplateId && result.recommendedTemplateId !== template.id && onSwitchTemplate) {
                 // Check if the recommended ID actually exists in our list
                 const exists = TEMPLATES.some(t => t.id === result.recommendedTemplateId);
                 if (exists) {
                    setRecommendedId(result.recommendedTemplateId);
                 }
            }
        }
        setIsPolishing(false);
    };

    const handleSelectOption = (text: string) => {
        setInput(text);
        setPolishOptions(null); // Clear options after selection
    };

    const getRecommendedTemplateName = () => {
        return TEMPLATES.find(t => t.id === recommendedId)?.title || "Unknown";
    };

    return (
        <div className="fixed inset-0 z-[60] bg-dark-900/95 backdrop-blur-xl flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Fingerprint className="text-neon-pink" size={20}/>
                    {template.id === 'custom-signal' ? '信号转译 (SIGNAL DECODE)' : '情绪注入'}
                </h2>
                <button onClick={onCancel} className="p-2 bg-white/10 rounded-full active:bg-white/20 hover:bg-white/20 transition-colors">
                    <X size={20} />
                </button>
            </div>
            
            <div className="flex-1 flex flex-col gap-4 relative overflow-y-auto pb-8">
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <img src={template.imageUrl} className="w-12 h-12 rounded-lg object-cover" />
                    <div>
                        <h3 className="text-sm font-bold text-white">{template.title}</h3>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                            消耗 {template.cost} <Candy size={10} />
                        </p>
                    </div>
                </div>

                {/* Quick Prompts (Only show if no AI options) */}
                {!polishOptions && template.quickPrompts && template.quickPrompts.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 mb-2">
                        {template.quickPrompts.map(prompt => (
                            <button
                                key={prompt}
                                onClick={() => setInput(prompt)}
                                className="text-xs bg-neon-blue/10 text-neon-blue border border-neon-blue/30 px-3 py-1.5 rounded-full active:bg-neon-blue/30 hover:bg-neon-blue/20 transition-colors hover:shadow-[0_0_8px_rgba(0,255,255,0.3)]"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}

                {/* AI Options Display */}
                {polishOptions && (
                    <div className="space-y-2 mt-4 mb-2 animate-in fade-in slide-in-from-bottom-2">
                        <label className="text-xs text-neon-green font-bold flex items-center gap-1">
                            <Sparkles size={10} /> DECODED SIGNALS (Select one):
                        </label>
                        {polishOptions.map((opt, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSelectOption(opt.text)}
                                className="w-full text-left p-3 rounded-xl bg-gradient-to-r from-white/10 to-transparent border border-white/10 hover:border-neon-green hover:bg-white/20 transition-all active:scale-98"
                            >
                                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded mr-2
                                    ${opt.style === 'TOXIC' ? 'bg-red-500 text-white' : ''}
                                    ${opt.style === 'EMO' ? 'bg-blue-500 text-white' : ''}
                                    ${opt.style === 'GLITCH' ? 'bg-purple-500 text-white' : ''}
                                `}>{opt.style}</span>
                                <span className="text-sm text-white">{opt.text}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Recommendation Switch */}
                {recommendedId && onSwitchTemplate && (
                    <div className="p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-between animate-in zoom-in">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-neon-pink font-bold uppercase">Signal Matched</span>
                            <span className="text-sm font-bold text-white">Switch to: {getRecommendedTemplateName()}?</span>
                        </div>
                        <button 
                            onClick={() => onSwitchTemplate(recommendedId)}
                            className="bg-neon-pink text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 active:scale-95"
                        >
                            Switch <ArrowRightCircle size={12} />
                        </button>
                    </div>
                )}

                <div className="relative flex-1 min-h-[120px]">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-gray-500 text-xs font-mono uppercase tracking-wider">
                            Subject Input &gt;_
                        </label>
                        {/* Magic Polish Button */}
                        <button 
                            onClick={handleAIPolish}
                            disabled={!input.trim() || isPolishing}
                            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-all 
                                ${!input.trim() ? 'opacity-50 cursor-not-allowed border-transparent text-gray-500' : 'cursor-pointer border-neon-purple/50 text-neon-purple bg-neon-purple/10 hover:bg-neon-purple/20 active:scale-95'}
                            `}
                        >
                            <Wand2 size={10} className={isPolishing ? "animate-spin" : ""} />
                            {isPolishing ? "DECODING..." : "AI 信号转译"}
                        </button>
                    </div>
                    
                    <textarea
                        ref={inputRef}
                        className="w-full h-full min-h-[150px] bg-black border border-neon-blue/30 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue resize-none text-base focus:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-shadow"
                        placeholder={template.id === 'custom-signal' ? '输入你的任何情绪 (如: 不想上班, 前任找我)...' : template.inputHint}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    ></textarea>
                    <div className="text-right text-xs text-gray-500 mt-2">
                        {input.length}/50
                    </div>
                </div>

                {isAnimating && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center animate-out fade-out slide-out-to-top-10 duration-1000 fill-mode-forwards pointer-events-none">
                        <Candy size={48} className="text-neon-pink mb-2" fill="currentColor" />
                        <span className="text-3xl font-black text-white text-shadow-neon">-{template.cost}</span>
                    </div>
                )}

                <button 
                    onClick={handleConfirm}
                    disabled={isAnimating}
                    className={`btn-neon-glow w-full bg-gradient-to-r from-neon-pink to-neon-purple text-white py-4 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(255,0,255,0.3)] active:scale-95 flex items-center justify-center gap-2 ${isAnimating ? 'scale-95 opacity-50' : ''}`}
                >
                    {isAnimating ? (
                        <>
                            <Zap size={20} className="animate-spin" />
                            <span>TRANSMITTING...</span>
                        </>
                    ) : (
                        <>
                            <Zap size={20} fill="currentColor" />
                            <span>开始生成</span>
                        </>
                    )}
                </button>
                <div className="h-10"></div>
            </div>
        </div>
    );
};

const TemplateCard: React.FC<{ template: Template, onSelect: (t: Template) => void }> = ({ template, onSelect }) => (
  <div 
    onClick={() => onSelect(template)}
    className="relative group overflow-hidden rounded-2xl bg-dark-800 border border-white/10 active:scale-95 transition-transform duration-200 touch-manipulation hover:border-white/30"
  >
    <div className="aspect-[4/5] w-full relative overflow-hidden">
      {/* 
          VISUAL UPDATE: 
          1. Removed 'filter-cyber-glitch' to stop the shaking/color-shifting fatigue.
          2. Removed default 'opacity-80' to make images clear and pop by default.
          3. Added smooth scale transformation on hover instead of opacity flicker.
      */}
      <img 
        src={template.imageUrl} 
        alt={template.title} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
      />
      
      {/* Deepened gradient overlay to ensure text readability on all images */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90" />
      
      <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-black italic tracking-wider shadow-lg
        ${template.tag === 'HOT' ? 'bg-red-500 text-white' : ''}
        ${template.tag === 'NEW' ? 'bg-neon-green text-black' : ''}
        ${template.tag === 'LIMITED' ? 'bg-neon-purple text-white' : ''}
        ${template.tag === 'FUTURE' ? 'bg-blue-500 text-white' : ''}
      `}>
        {template.tag}
      </div>
    </div>

    <div className="absolute bottom-0 left-0 right-0 p-4">
      <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border
              ${template.category === 'lucky' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' : ''}
              ${template.category === 'sharp' ? 'text-red-400 border-red-400/30 bg-red-400/10' : ''}
              ${template.category === 'persona' ? 'text-green-400 border-green-400/30 bg-green-400/10' : ''}
              ${template.category === 'future' ? 'text-blue-400 border-blue-400/30 bg-blue-400/10' : ''}
          `}>{template.category.toUpperCase()}</span>
      </div>
      <h3 className="text-xl font-black italic text-white mb-1 drop-shadow-md">{template.title}</h3>
      <p className="text-xs text-gray-300 mb-3 line-clamp-1">{template.description}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-black/50 backdrop-blur px-2 py-1 rounded text-xs text-neon-yellow font-bold border border-neon-yellow/30">
          <Candy size={12} fill="currentColor" />
          <span>-{template.cost}</span>
        </div>
        <button className="btn-neon-blue-glow bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold hover:bg-neon-blue transition-colors">
          PLAY
        </button>
      </div>
    </div>
  </div>
);

// --- NEW: Custom Entry Card (Bottom of List) ---
const CustomEntryCard = ({ onSelect }: { onSelect: () => void }) => (
    <div 
        onClick={onSelect}
        className="col-span-2 mt-8 mb-4 relative group cursor-pointer active:scale-95 transition-transform"
    >
        {/* Glitchy Border Container */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-pink via-neon-blue to-neon-purple rounded-2xl opacity-75 group-hover:opacity-100 blur animate-tilt transition duration-1000 group-hover:duration-200"></div>
        
        <div className="relative p-6 rounded-2xl bg-black border border-white/10 overflow-hidden flex flex-col items-center text-center">
            {/* Background Noise */}
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] mix-blend-overlay"></div>
            
            <div className="relative z-10">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-3 group-hover:bg-white/20 transition-colors animate-pulse-slow">
                    <Sparkles size={24} className="text-neon-blue" />
                </div>
                
                <h3 className="text-xl font-black italic text-white mb-1 flex items-center justify-center gap-2">
                    <span className="text-neon-pink">&gt;_</span> 
                    发射未定义信号 
                    <span className="text-neon-pink">&lt;_</span>
                </h3>
                <p className="text-xs text-gray-400 font-mono tracking-wider">UNIDENTIFIED SIGNAL // CUSTOM CHANNEL</p>
                
                <div className="mt-4 inline-flex items-center gap-2 text-[10px] font-bold border border-white/20 px-3 py-1.5 rounded-full text-gray-300 group-hover:border-neon-blue group-hover:text-neon-blue transition-colors">
                    <Wand2 size={12} />
                    <span>AI 信号解码接入中...</span>
                </div>
            </div>
            
            {/* Glitch Overlay */}
            <div className="absolute top-0 left-0 w-full h-1 bg-white/20 animate-glitch opacity-0 group-hover:opacity-50"></div>
        </div>
    </div>
);

// --- UPDATED: Realistic Countdown Banner ---
const CountDownBanner = () => {
  const [timeLeft, setTimeLeft] = useState({ d: '00', h: '00', m: '00', s: '00' });
  
  useEffect(() => {
    // REALISM: Set a fixed end date (e.g., 5 days from 'now', mimicking a season end)
    // In a real app, this comes from the backend.
    const now = new Date();
    // Use a fixed target date for consistency during MVP demo: Feb 28, 2026 (assuming simulation year)
    // Or simpler: Just 3 days, 14 hours from "now" to always look urgent on reload.
    const targetDate = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000) + (14 * 60 * 60 * 1000)); 

    const timer = setInterval(() => {
        const current = new Date().getTime();
        const distance = targetDate.getTime() - current;

        if (distance < 0) {
             clearInterval(timer);
             setTimeLeft({ d:'00', h:'00', m:'00', s:'00' });
             return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        setTimeLeft({
            d: days.toString().padStart(2, '0'),
            h: hours.toString().padStart(2, '0'),
            m: minutes.toString().padStart(2, '0'),
            s: seconds.toString().padStart(2, '0')
        });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-4 mb-6 p-1 rounded-xl bg-gradient-to-r from-red-600 via-purple-600 to-blue-600 active:scale-95 transition-transform hover:shadow-[0_0_20px_rgba(255,0,0,0.4)] relative overflow-hidden group">
      <div className="bg-black/90 backdrop-blur-md rounded-[10px] p-4 flex items-center justify-between relative z-10">
          <div className="z-10">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-red-400 text-[10px] font-black tracking-widest uppercase">SEASON 1 FINALE</span>
            </div>
            <h2 className="text-white font-black italic text-lg leading-tight">2026 赛博庙会<br/><span className="text-gray-400 text-xs font-normal not-italic">Cyber Temple Fair Limited Event</span></h2>
          </div>
          <div className="z-10 text-right">
            <span className="block text-[9px] text-gray-500 mb-1 uppercase tracking-wider font-bold">Time Remaining</span>
            <div className="font-mono text-xl font-bold text-white tracking-wider flex items-center gap-1">
                <Timer size={16} className="text-red-500" />
                <span>{timeLeft.d}<span className="text-xs text-gray-500 mx-0.5">d</span>{timeLeft.h}<span className="text-xs text-gray-500 mx-0.5">:</span>{timeLeft.m}</span>
            </div>
          </div>
      </div>
      {/* Animated Shine Effect */}
      <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
    </div>
  );
};

// --- Views ---

const GeneratingView = ({ template, userInput, onFinish }: { template: Template, userInput: string, onFinish: (res: GeneratedResult) => void }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const sysLogs = [
        "INITIALIZING NEURAL LINK...",
        "ENCRYPTING USER INPUT...",
        `CONTEXT: "${userInput.substring(0, 15)}..."`,
        "ACCESSING SOUL_DATA_V2...",
        "CONTENT_SAFETY_CHECK_V2... PASS",
        "DECRYPTING EMOTIONAL PATTERNS...",
        "SYNTHESIZING REALITY...",
        "APPLYING CYBER_FILTERS...",
        "FINALIZING..."
    ];

    let logIndex = 0;
    const logInterval = setInterval(() => {
        if (logIndex < sysLogs.length) {
            setLogs(prev => [...prev.slice(-5), `> ${sysLogs[logIndex]}`]);
            logIndex++;
        }
    }, 400);

    const progressInterval = setInterval(() => {
        setProgress(prev => {
            if (prev >= 100) return 100;
            return prev + Math.random() * 5;
        });
    }, 150);

    const finishTimeout = setTimeout(() => {
        // Pseudo-AI Logic: Deterministic Generation
        const hash = generateHash(userInput + template.id);
        
        // MVP LOGIC: 
        // For Custom Signal, the "User Input" (which might be AI polished) IS the result text.
        // For others, we use the presets as the "Answer" to the user's "Question".
        let finalMainText = "";
        if (template.id === 'custom-signal') {
            finalMainText = userInput;
        } else {
            finalMainText = template.presetTexts[hash % template.presetTexts.length];
        }

        // Rarity Logic & Score Calculation
        const rand = Math.random();
        let rarity: Rarity = 'N';
        let luckScore = 0;

        if (rand > 0.80) {
            rarity = 'SSR';
            luckScore = 95 + Math.floor(Math.random() * 6); // 95-100
        } else if (rand > 0.40) {
            rarity = 'SR';
            luckScore = 80 + Math.floor(Math.random() * 15); // 80-94
        } else if (rand > 0.20) {
            rarity = 'R';
            luckScore = 60 + Math.floor(Math.random() * 20); // 60-79
        } else {
            rarity = 'N';
            luckScore = Math.floor(Math.random() * 60); // 0-59
        }

        // --- NEW: Generate Image based on Rarity AFTER rarity is decided ---
        // Pass the templateId to look up the correct prompt structure in constants
        const raritySpecificImage = getThematicImage(template.id, rarity);

        onFinish({
            id: Date.now().toString(),
            templateId: template.id,
            imageUrl: raritySpecificImage, // Use the new rarity-aware image
            text: finalMainText,
            userInput: userInput,
            timestamp: Date.now(),
            rarity,
            filterSeed: hash % 360,
            luckScore
        });
    }, 4500);

    return () => {
        clearInterval(logInterval);
        clearInterval(progressInterval);
        clearTimeout(finishTimeout);
    };
  }, [template, userInput, onFinish]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 font-mono select-none">
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #00ff00 2px, #00ff00 4px)'}}></div>
      
      <div className="absolute top-8 right-8 flex items-center gap-1 text-neon-green text-[10px] border border-neon-green/30 px-2 py-1 rounded-full animate-pulse">
        <ShieldCheck size={12} />
        <span>安全检测中...</span>
      </div>

      <div className="w-full max-w-xs mb-12 relative">
         <div className="absolute inset-0 bg-neon-green/20 blur-xl animate-pulse"></div>
         {/* Preview uses template default image, not the final rarity one yet (suspense) */}
         <img 
            src={template.imageUrl}
            className="w-full aspect-square object-cover rounded-full opacity-80 grayscale mix-blend-luminosity border-4 border-dark-800 relative z-10 filter-cyber-glitch" 
            alt="processing"
        />
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-transparent via-neon-green/50 to-transparent h-[10%] w-full animate-[bounce_2s_infinite]"></div>
      </div>
      
      <div className="w-full max-w-xs space-y-4">
        <div className="h-2 bg-dark-800 rounded-full overflow-hidden border border-white/10">
            <div 
                className="h-full bg-neon-green shadow-[0_0_10px_#00ff00]"
                style={{ width: `${Math.min(100, progress)}%` }}
            ></div>
        </div>
        
        <div className="h-32 font-mono text-xs text-neon-green/80 overflow-hidden flex flex-col justify-end">
            {logs.map((log, i) => (
                <p key={i} className="animate-in slide-in-from-left duration-300">{log}</p>
            ))}
            <span className="animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
};

const RarityBadge = ({ rarity }: { rarity: Rarity }) => {
    const colors = {
        'SSR': 'bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 text-white border-yellow-200 shadow-[0_0_10px_rgba(255,215,0,0.5)]',
        'SR': 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-purple-300',
        'R': 'bg-blue-500 text-white border-blue-300',
        'N': 'bg-gray-600 text-gray-200 border-gray-400',
    };

    return (
        <span className={`${colors[rarity]} px-2 py-0.5 text-[10px] font-black italic border rounded shadow-sm`}>
            {rarity}
        </span>
    );
};

const ResultView = ({ result, onClose, onShare, onReroll, isSharedView = false }: { 
    result: GeneratedResult, 
    onClose: () => void, 
    onShare: () => void,
    onReroll: () => void,
    isSharedView?: boolean
}) => {
  const isSSR = result.rarity === 'SSR';
  const [showToast, setShowToast] = useState(false);

  // Asset Value: Unique Serial Number logic (Mocked for now based on timestamp)
  const serialNumber = `NO.${result.timestamp.toString().slice(-4)}`;

  // Removed hue-rotate from here to rely on the consistent CSS filter, allowing specific rarity tweaks if needed
  const imageStyle = {
      // filter: isSSR ? 'brightness(1.2) contrast(1.1)' : 'sepia(0.2)' 
  };

  const handleTouchStart = () => {
      setTimeout(() => setShowToast(true), 500);
      setTimeout(() => setShowToast(false), 2500);
  };
  
  const handleShareClick = async () => {
      // 1. Construct Share URL with parameters to ensure the recipient sees the exact same card
      const shareParams = new URLSearchParams();
      shareParams.set('tid', result.templateId);
      shareParams.set('u', result.userInput);
      shareParams.set('r', result.rarity);
      // Pass the luck score too, or re-calc it. Passing is safer for 'proof'.
      shareParams.set('s', result.luckScore.toString());
      
      const shareUrl = `${window.location.origin}${window.location.pathname}?${shareParams.toString()}`;

      if (navigator.share) {
          try {
              await navigator.share({
                  title: `[SSR] ${result.userInput} 的运势评分: ${result.luckScore}`,
                  text: result.text,
                  url: shareUrl
              });
          } catch (err) {
              onShare(); 
          }
      } else {
         try {
             await navigator.clipboard.writeText(shareUrl);
             alert("链接已复制，快去分享给朋友吧！");
         } catch(e) {
             onShare();
         }
      }
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col p-4 animate-in fade-in zoom-in duration-300 overflow-y-auto overflow-x-hidden">
      {isSSR && <Confetti />}
      {showToast && <Toast message="已保存到相册 (模拟)" visible={true} />}

      {isSSR && (
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent animate-pulse"></div>
      )}

      {/* Header Area */}
      <div className="flex justify-between items-center mb-2 z-10">
        {isSharedView ? (
             <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
                 <User size={12} className="text-neon-blue" />
                 <span className="text-xs text-white">来自 <span className="text-neon-blue font-bold">{result.userInput}</span> 的分享</span>
             </div>
        ) : (
            <div className="w-1"></div> // Spacer
        )}
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors active:scale-90">
            <X className="text-white" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4">
        
        <div className="mb-4 animate-[bounce-slight_3s_infinite] select-none text-center relative">
             {/* Luck Score Badge */}
            <div className="absolute -right-12 -top-4 rotate-12 bg-white text-black font-black px-2 py-1 rounded shadow-[0_0_15px_white] z-20 flex flex-col items-center leading-none border-2 border-neon-pink transform scale-110">
                <span className="text-[10px] uppercase">Luck Score</span>
                <span className="text-2xl text-neon-pink">{result.luckScore}</span>
            </div>

            <span className={`text-6xl font-black italic tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]
                ${result.rarity === 'SSR' ? 'text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 via-red-500 to-purple-600' : 
                  result.rarity === 'SR' ? 'text-neon-purple' : 
                  result.rarity === 'R' ? 'text-neon-blue' : 'text-gray-400'}
            `}>
                {result.rarity}
            </span>
            {isSSR && <div className="text-yellow-400 text-xs font-bold tracking-[0.5em] animate-pulse">LEGENDARY</div>}
        </div>

        {/* Updated to HoloCard for interaction */}
        <HoloCard rarity={result.rarity} className={`bg-white p-3 pb-8 rounded shadow-2xl relative group w-[340px] max-w-[92vw] aspect-[9/16] flex-shrink-0 mx-auto select-none ${isSSR ? 'card-holo border-ssr' : ''}`}>
             {/* Content Wrapper to handle Touch Start for save */}
             <div onTouchStart={handleTouchStart} className="h-full flex flex-col">
                <div className="absolute -top-4 -left-2 z-20 max-w-[80%] transform -rotate-2">
                    <div className="bg-yellow-300 text-black px-3 py-1.5 shadow-md border-2 border-black font-serif font-bold text-sm leading-tight break-words">
                        "{result.userInput}"
                    </div>
                </div>

                <div className="flex-1 bg-gray-100 overflow-hidden mb-4 relative border-2 border-black">
                    <img 
                        src={result.imageUrl} 
                        className="w-full h-full object-cover pointer-events-auto cyber-image-container filter-cyber-glitch" 
                        style={imageStyle}
                        alt="result" 
                    />
                    
                    <div className="absolute top-2 right-2 opacity-100 mix-blend-normal z-10">
                        <RarityBadge rarity={result.rarity} />
                    </div>
                    
                    <div className="absolute bottom-2 right-2 opacity-50 z-10">
                        <div className="flex items-center gap-1">
                            <div className="w-8 h-8 bg-black text-white text-[8px] flex items-center justify-center font-bold">
                                CP <span className="text-[6px] ml-1">{serialNumber}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="px-2">
                    <h2
                        className="font-serif text-2xl font-bold text-black leading-tight mb-4 tracking-tight overflow-hidden"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                    >
                        "{result.text}"
                    </h2>
                    <div className="flex justify-between items-end border-t-2 border-black pt-2">
                        <div className="flex flex-col">
                            <span className="font-black text-xs text-black uppercase tracking-widest">Candy Pixel</span>
                            <span className="font-mono text-[8px] text-gray-500">AI EMOTION LAB</span>
                        </div>
                        <span className="font-mono text-[10px] text-gray-500">{new Date(result.timestamp).toLocaleDateString()}</span>
                    </div>
                </div>
             </div>
        </HoloCard>
        
        {!isSharedView && !isSSR && (
            <div className="mt-6 w-full max-w-sm">
                <button 
                    onClick={onReroll}
                    className="w-full btn-neon-glow bg-gradient-to-r from-yellow-600 to-yellow-800 border border-yellow-500/50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg animate-pulse"
                >
                    <Crown size={18} className="text-yellow-300" />
                    <span>看广告 · 逆天改命 (必出 SR/SSR)</span>
                </button>
            </div>
        )}

        <p className="mt-8 text-[10px] text-gray-600 flex items-center justify-center gap-1">
            <AlertTriangle size={10} /> AI 生成内容仅供娱乐，请勿迷信
        </p>
      </div>

      <div className="mt-2 flex gap-4 justify-center pb-8 safe-bottom z-10 w-full max-w-sm mx-auto">
        {isSharedView ? (
             <button onClick={onClose} className="flex-1 btn-neon-glow bg-gradient-to-r from-neon-green to-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,255,0,0.3)] animate-bounce">
                <Flame size={18} fill="currentColor" />
                <span>不服？我也要测 (PK)</span>
            </button>
        ) : (
            <>
                <button onClick={onClose} className="flex-1 bg-dark-800 border border-white/20 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-dark-700 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                    <RefreshCw size={18} />
                    <span>再来一发</span>
                </button>
                <button onClick={handleShareClick} className="btn-neon-glow flex-1 bg-gradient-to-r from-neon-pink to-neon-purple text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-neon-pink/30 active:scale-95 transition-transform">
                    <Share2 size={18} />
                    <span>分享</span>
                </button>
            </>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [view, setView] = useState<ViewState>('HOME');
  const [candyCount, setCandyCount] = useState(20);
  const [history, setHistory] = useState<GeneratedResult[]>([]);
  
  // Selection & Input
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [userInput, setUserInput] = useState("");
  const [isInputting, setIsInputting] = useState(false);
  
  // Results
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [sharedResult, setSharedResult] = useState<GeneratedResult | null>(null);
  
  // Overlays
  const [showSignIn, setShowSignIn] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adType, setAdType] = useState<'CANDY' | 'REROLL'>('CANDY');
  const [showCategory, setShowCategory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Daily Claim State
  const [canClaimDaily, setCanClaimDaily] = useState(false);

  // Init Effects
  useEffect(() => {
    // Load History
    try {
        const saved = localStorage.getItem('cp_history');
        if (saved) setHistory(JSON.parse(saved));
    } catch(e) {}

    // Check Daily Signin Status (Logic Only, No Auto Popup)
    const last = localStorage.getItem('cp_last_signin');
    const today = new Date().toDateString();
    setCanClaimDaily(last !== today);

    // Check Share URL
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('tid');
    if (tid) {
        const t = TEMPLATES.find(temp => temp.id === tid);
        const u = params.get('u');
        const r = params.get('r') as Rarity;
        const s = params.get('s');
        if (t && u && r) {
            setSharedResult({
                id: 'shared',
                templateId: tid,
                imageUrl: getThematicImage(tid, r),
                text: t.presetTexts[0], // Simplified
                userInput: u,
                timestamp: Date.now(),
                rarity: r,
                filterSeed: 0,
                luckScore: s ? parseInt(s) : 80
            });
        }
    }
  }, []);

  // Handlers
  const handleTemplateSelect = (t: Template) => {
      setSelectedTemplate(t);
      setIsInputting(true);
  };
  
  const handleCustomSignalSelect = () => {
      const customTemplate = TEMPLATES.find(t => t.id === 'custom-signal');
      if (customTemplate) {
          handleTemplateSelect(customTemplate);
      }
  };
  
  const handleSwitchTemplate = (targetId: string) => {
      const target = TEMPLATES.find(t => t.id === targetId);
      if (target) {
          setSelectedTemplate(target);
          // Don't close overlay, just update state seamlessly
      }
  };

  const handleInputConfirm = (text: string) => {
      if (!selectedTemplate) return;
      if (candyCount < selectedTemplate.cost) {
          setIsInputting(false);
          setAdType('CANDY');
          setShowAd(true);
          return;
      }
      setUserInput(text);
      setCandyCount(c => c - selectedTemplate.cost);
      setIsInputting(false);
      setView('GENERATING');
  };

  const handleGenerationComplete = (res: GeneratedResult) => {
      setGeneratedResult(res);
      const newHistory = [res, ...history];
      setHistory(newHistory);
      localStorage.setItem('cp_history', JSON.stringify(newHistory));
      setView('RESULT');
  };

  const handleAdComplete = () => {
      setShowAd(false);
      if (adType === 'CANDY') {
          setCandyCount(c => c + 10);
      } else if (adType === 'REROLL') {
          if (selectedTemplate && userInput) {
              setView('GENERATING');
          }
      }
  };
  
  // Handle claiming the daily reward
  const handleClaimDaily = () => {
      if (canClaimDaily) {
          setCandyCount(c => c + 10);
          localStorage.setItem('cp_last_signin', new Date().toDateString());
          setCanClaimDaily(false);
      }
      setShowSignIn(false);
  };

  // --- UPDATED: Filter Logic ---
  // Fixes the bug where clicking "HOT" tags yielded no results because logic wasn't checking the 'tag' field.
  const filteredTemplates = TEMPLATES.filter(t => {
      // Hide the custom signal template from the main grid to keep it special at the bottom
      if (t.id === 'custom-signal') return false; 
      
      const matchCat = categoryFilter ? t.category === categoryFilter : true;
      const matchSearch = searchTerm ? (
          t.title.includes(searchTerm) || 
          t.keywords.some(k => k.includes(searchTerm)) ||
          t.tag === searchTerm // Added specific check for the 'tag' field (HOT, NEW, etc.)
      ) : true;
      return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20">
       <div className="fixed inset-0 pointer-events-none z-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>

       <Navbar 
          candyCount={candyCount} 
          setView={setView} 
          onWatchAd={() => { setAdType('CANDY'); setShowAd(true); }} 
          onOpenDaily={() => setShowSignIn(true)}
          canClaimDaily={canClaimDaily}
       />

       <main className="pt-20 px-4 max-w-md mx-auto relative z-10">
         {view === 'HOME' && (
             <div className="animate-in fade-in duration-500 space-y-6">
                 <CountDownBanner />
                 {/* Filters */}
                 <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button 
                        onClick={() => setShowCategory(true)} 
                        className={`flex-shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center active:scale-95 transition-transform ${categoryFilter ? 'bg-neon-pink text-white border-neon-pink' : 'bg-dark-800 border-white/10 text-neon-pink'}`}
                    >
                        <Radar size={20}/>
                    </button>
                    {(categoryFilter || searchTerm) && (
                        <button onClick={() => {setCategoryFilter(null); setSearchTerm("")}} className="flex-shrink-0 px-4 h-12 rounded-xl bg-white/10 flex items-center gap-2 text-sm font-bold border border-white/20"><X size={14}/> 
                            {categoryFilter?.toUpperCase() || searchTerm}
                        </button>
                    )}
                    {['HOT','NEW','LIMITED'].map(t => (
                        <button 
                            key={t} 
                            onClick={() => {
                                // Logic: If clicking a Tag, we probably want to see ALL HOT items, not just HOT items in 'Lucky' category.
                                // So we clear categoryFilter for better UX.
                                setCategoryFilter(null); 
                                setSearchTerm(t);
                            }} 
                            className={`flex-shrink-0 px-4 h-12 rounded-xl border text-xs font-bold transition-colors ${searchTerm === t ? 'bg-white text-black border-white' : 'bg-dark-800 border-white/10 text-gray-400 hover:text-white'}`}
                        >
                            {t}
                        </button>
                    ))}
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                     {filteredTemplates.map(t => (
                         <TemplateCard key={t.id} template={t} onSelect={handleTemplateSelect} />
                     ))}
                     
                     {/* New Custom Entry Card at the end of the list */}
                     {!categoryFilter && !searchTerm && (
                         <CustomEntryCard onSelect={handleCustomSignalSelect} />
                     )}
                 </div>
                 {filteredTemplates.length === 0 && <div className="text-center py-20 opacity-50 text-sm">No signals detected.</div>}
             </div>
         )}

         {view === 'MINE' && (
             <div className="animate-in fade-in slide-in-from-right duration-500">
                 <h2 className="text-2xl font-black italic mb-6 flex items-center gap-2"><Backpack className="text-neon-pink" /> INVENTORY <span className="ml-auto text-sm font-normal text-gray-500">{history.length}</span></h2>
                 {history.length === 0 ? (
                     <div className="text-center py-20 opacity-50 space-y-4">
                         <Backpack size={48} className="mx-auto opacity-20" />
                         <p>Empty Inventory</p>
                         <button onClick={() => setView('HOME')} className="text-neon-blue underline">Go Explore</button>
                     </div>
                 ) : (
                     <div className="grid grid-cols-2 gap-4">
                         {history.map(h => (
                             <div key={h.id} onClick={() => { setGeneratedResult(h); setView('RESULT'); }} className="aspect-[3/4] relative rounded-xl overflow-hidden border border-white/10 active:scale-95 transition-transform">
                                 <img src={h.imageUrl} className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end p-3">
                                     <h4 className="text-sm font-bold text-white line-clamp-1">{h.text}</h4>
                                     <span className="text-[10px] text-gray-400">{new Date(h.timestamp).toLocaleDateString()}</span>
                                     <div className="absolute top-2 right-2"><RarityBadge rarity={h.rarity} /></div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
             </div>
         )}
       </main>

       <BottomNav view={view} setView={setView} onOpenRadar={() => setShowCategory(true)} />

       {/* Overlays */}
       {showSignIn && <DailySignInModal canClaim={canClaimDaily} onClose={handleClaimDaily} onClaim={handleClaimDaily} />}
       {showAd && <AdOverlay onComplete={handleAdComplete} type={adType} />}
       {showCategory && <CategoryOverlay 
            isOpen={showCategory} 
            onClose={() => setShowCategory(false)} 
            onSelectCategory={setCategoryFilter} 
            onSearch={setSearchTerm} 
            currentCategory={categoryFilter}
            currentSearch={searchTerm}
       />}
       {isInputting && selectedTemplate && <InputOverlay template={selectedTemplate} initialValue="" onCancel={() => setIsInputting(false)} onConfirm={handleInputConfirm} onSwitchTemplate={handleSwitchTemplate} />}
       {view === 'GENERATING' && selectedTemplate && <GeneratingView template={selectedTemplate} userInput={userInput} onFinish={handleGenerationComplete} />}
       {view === 'RESULT' && generatedResult && <ResultView result={generatedResult} onClose={() => setView('HOME')} onShare={() => setShowShare(true)} onReroll={() => { setAdType('REROLL'); setShowAd(true); }} />}
       {sharedResult && <ResultView result={sharedResult} onClose={() => { setSharedResult(null); window.history.replaceState({},'',window.location.pathname); }} onShare={() => setShowShare(true)} onReroll={() => { setSharedResult(null); setView('HOME'); }} isSharedView={true} />}
       {showShare && <ShareOverlay onClose={() => setShowShare(false)} />}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
