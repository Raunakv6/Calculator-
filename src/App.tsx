/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, Delete, RotateCcw, Equal, Percent, Divide, X, Minus, Plus, ChevronRight, ChevronLeft, Wallet, ShieldCheck, Instagram, ArrowUpRight, Lock, CheckCircle2, Moon, Sun } from 'lucide-react';

type Operator = '+' | '-' | '*' | '/' | '^' | null;

// Audio context for click sound (reused for performance)
let audioCtx: AudioContext | null = null;

const playClickSound = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.05);
  } catch (e) {
    // Ignore audio errors
  }
};

const Button = React.memo(({ 
  children, 
  onClick, 
  className = "", 
  variant = "default",
  small = false,
  darkMode = true,
  active = false
}: { 
  children: React.ReactNode; 
  onClick: () => void; 
  className?: string;
  variant?: "default" | "operator" | "action" | "accent" | "scientific";
  small?: boolean;
  darkMode?: boolean;
  active?: boolean;
}) => {
  const variants = {
    default: darkMode 
      ? "bg-white/10 hover:bg-white/15 text-white shadow-sm border border-white/10 backdrop-blur-md"
      : "bg-white/80 hover:bg-white text-zinc-800 shadow-sm border border-white/20 backdrop-blur-md",
    operator: darkMode
      ? "bg-white/20 hover:bg-white/25 text-white font-semibold border border-white/10 backdrop-blur-md"
      : "bg-zinc-100/80 hover:bg-zinc-200/80 text-zinc-900 font-semibold border border-zinc-200/20 backdrop-blur-md",
    action: darkMode
      ? "bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/5 backdrop-blur-md"
      : "bg-zinc-50/80 hover:bg-zinc-100/80 text-zinc-500 border border-zinc-100/20 backdrop-blur-md",
    accent: "bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg shadow-black/20",
    scientific: darkMode
      ? "bg-white/5 hover:bg-white/10 text-zinc-400 text-sm font-medium border border-white/5 backdrop-blur-md"
      : "bg-zinc-100/20 hover:bg-zinc-200/40 text-zinc-600 text-sm font-medium border border-white/10 backdrop-blur-md"
  };

  const activeStyles = active 
    ? (darkMode 
        ? "ring-2 ring-white/40 bg-white/30 shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
        : "ring-2 ring-zinc-400 bg-zinc-200 shadow-[0_0_15px_rgba(0,0,0,0.1)]") 
    : "";

  return (
    <motion.button
      whileHover={{ scale: 1.01, y: -0.5 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      onClick={() => {
        playClickSound();
        onClick();
      }}
      className={`${small ? 'h-12' : 'h-16'} w-full rounded-2xl flex items-center justify-center ${small ? 'text-sm' : 'text-xl'} transition-all duration-150 ${variants[variant]} ${activeStyles} ${className}`}
    >
      {children}
    </motion.button>
  );
});

export default function App() {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [history, setHistory] = useState<{ eq: string; res: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isScientific, setIsScientific] = useState(false);
  const [isRadians, setIsRadians] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memory, setMemory] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [lastCalcTime, setLastCalcTime] = useState<number>(0);
  const [spamCount, setSpamCount] = useState<number>(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [isResult, setIsResult] = useState(false);

  const MAX_BALANCE = 1.00;
  const SPAM_THRESHOLD = 800; // ms between calculations

  const handleNumber = useCallback((num: string) => {
    setError(null);
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  }, [display, waitingForOperand]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const checkSpamAndIncrementBalance = useCallback(() => {
    const now = Date.now();
    const timeDiff = now - lastCalcTime;
    
    setLastCalcTime(now);

    if (timeDiff < SPAM_THRESHOLD) {
      const newSpamCount = spamCount + 1;
      setSpamCount(newSpamCount);
      
      if (newSpamCount >= 3) {
        setWarning("Slow down! Spamming detected.");
        setTimeout(() => setWarning(null), 3000);
        return;
      }
    } else {
      setSpamCount(0);
    }

    if (balance < MAX_BALANCE) {
      setBalance(prev => Math.min(MAX_BALANCE, prev + 0.01));
    } else if (balance >= MAX_BALANCE && !warning) {
      setWarning("Maximum earnings reached ($1.00)");
      setTimeout(() => setWarning(null), 3000);
    }
  }, [lastCalcTime, spamCount, balance, warning]);

  const calculate = (first: number, second: number, op: Operator): number => {
    switch (op) {
      case '+': return first + second;
      case '-': return first - second;
      case '*': return first * second;
      case '/': 
        if (second === 0) {
          setError("Cannot divide by zero");
          return NaN;
        }
        return first / second;
      case '^': return Math.pow(first, second);
      default: return second;
    }
  };

  const handleMemory = (action: 'MC' | 'MR' | 'M+' | 'M-') => {
    const val = parseFloat(display);
    switch (action) {
      case 'MC':
        setMemory(0);
        break;
      case 'MR':
        setDisplay(String(memory));
        setWaitingForOperand(true);
        break;
      case 'M+':
        setMemory(prev => prev + val);
        setWaitingForOperand(true);
        break;
      case 'M-':
        setMemory(prev => prev - val);
        setWaitingForOperand(true);
        break;
    }
  };

  const handleOperator = useCallback((nextOperator: Operator) => {
    setError(null);
    const inputValue = parseFloat(display);

    if (prevValue === null) {
      setPrevValue(inputValue);
    } else if (operator) {
      const currentValue = prevValue || 0;
      const result = calculate(currentValue, inputValue, operator);
      
      if (isNaN(result) || !isFinite(result)) {
        setDisplay('Error');
        setPrevValue(null);
        setOperator(null);
        setWaitingForOperand(true);
        setEquation('');
        return;
      }

      setPrevValue(result);
      setDisplay(String(result));
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
    const opSymbol = nextOperator === '*' ? '×' : nextOperator === '/' ? '÷' : nextOperator === '^' ? '^' : nextOperator;
    setEquation(`${display} ${opSymbol}`);
  }, [display, prevValue, operator]);

  const handleEqual = useCallback(() => {
    setError(null);
    const inputValue = parseFloat(display);
    if (operator && prevValue !== null) {
      const result = calculate(prevValue, inputValue, operator);
      if (isNaN(result) || !isFinite(result)) {
        setDisplay('Error');
        setPrevValue(null);
        setOperator(null);
        setWaitingForOperand(true);
        setEquation('');
        return;
      }
      const opSymbol = operator === '*' ? '×' : operator === '/' ? '÷' : operator === '^' ? '^' : operator;
      const eqString = `${prevValue} ${opSymbol} ${inputValue} =`;
      setHistory(prev => [{ eq: eqString, res: String(result) }, ...prev].slice(0, 10));
      setDisplay(String(result));
      setIsResult(true);
      setTimeout(() => setIsResult(false), 300);
      setPrevValue(null);
      setOperator(null);
      setWaitingForOperand(true);
      setEquation('');
      checkSpamAndIncrementBalance();
    }
  }, [display, operator, prevValue, checkSpamAndIncrementBalance]);

  const factorial = (n: number): number => {
    if (n < 0) return NaN;
    if (n === 0) return 1;
    if (n > 170) return Infinity; // Max factorial for 64-bit float
    let res = 1;
    for (let i = 2; i <= Math.floor(n); i++) res *= i;
    return res;
  };

  const handleScientificFunc = (func: string) => {
    setError(null);
    const val = parseFloat(display);
    let result = 0;
    let eq = '';

    switch (func) {
      case 'sqrt':
        result = Math.sqrt(val);
        eq = `√(${val})`;
        break;
      case 'sin':
        result = isRadians ? Math.sin(val) : Math.sin(val * Math.PI / 180);
        eq = `sin(${val}${isRadians ? '' : '°'})`;
        break;
      case 'cos':
        result = isRadians ? Math.cos(val) : Math.cos(val * Math.PI / 180);
        eq = `cos(${val}${isRadians ? '' : '°'})`;
        break;
      case 'tan':
        result = isRadians ? Math.tan(val) : Math.tan(val * Math.PI / 180);
        eq = `tan(${val}${isRadians ? '' : '°'})`;
        break;
      case 'asin':
        result = isRadians ? Math.asin(val) : Math.asin(val) * 180 / Math.PI;
        eq = `asin(${val})`;
        break;
      case 'acos':
        result = isRadians ? Math.acos(val) : Math.acos(val) * 180 / Math.PI;
        eq = `acos(${val})`;
        break;
      case 'atan':
        result = isRadians ? Math.atan(val) : Math.atan(val) * 180 / Math.PI;
        eq = `atan(${val})`;
        break;
      case 'sinh':
        result = Math.sinh(val);
        eq = `sinh(${val})`;
        break;
      case 'cosh':
        result = Math.cosh(val);
        eq = `cosh(${val})`;
        break;
      case 'tanh':
        result = Math.tanh(val);
        eq = `tanh(${val})`;
        break;
      case 'log':
        result = Math.log10(val);
        eq = `log(${val})`;
        break;
      case 'ln':
        result = Math.log(val);
        eq = `ln(${val})`;
        break;
      case 'pow2':
        result = Math.pow(val, 2);
        eq = `${val}²`;
        break;
      case 'fact':
        result = factorial(val);
        eq = `${val}!`;
        break;
      case 'pi':
        setDisplay(String(Math.PI));
        return;
      case 'e':
        setDisplay(String(Math.E));
        return;
      default:
        return;
    }

    if (isNaN(result) || !isFinite(result)) {
      setError("Invalid input for function");
      setDisplay('Error');
    } else {
      setHistory(prev => [{ eq: eq + ' =', res: String(result) }, ...prev].slice(0, 10));
      setDisplay(String(result));
    }
    setWaitingForOperand(true);
    checkSpamAndIncrementBalance();
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const handlePercent = () => {
    const value = parseFloat(display);
    setDisplay(String(value / 100));
  };

  const handleToggleSign = () => {
    setDisplay(String(parseFloat(display) * -1));
  };

  const handleDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleDelete = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleNumber(e.key);
      if (e.key === '.') handleDecimal();
      if (e.key === '=') handleEqual();
      if (e.key === 'Enter') handleEqual();
      if (e.key === 'Backspace') handleDelete();
      if (e.key === 'Escape') handleClear();
      if (e.key === '+') handleOperator('+');
      if (e.key === '-') handleOperator('-');
      if (e.key === '*') handleOperator('*');
      if (e.key === '/') handleOperator('/');
      if (e.key === '%') handlePercent();
      if (e.key === '^') handleOperator('^');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNumber, handleOperator, handleEqual, handleDelete, handleDecimal]);

  return (
    <div className="min-h-screen bg-calculator-main flex items-center justify-center p-4 font-sans relative">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid-subtle z-0" />
      <div className="bg-glow-spot glow-top-left" />
      <div className="bg-glow-spot glow-bottom-right" />
      <div className="vignette-overlay" />

      {/* Glassmorphism Accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[80px] pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-[80px] pointer-events-none z-0" />

      <motion.div 
        layout
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className={`${darkMode ? 'bg-zinc-900/90' : 'bg-white/95'} backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-black/40 overflow-hidden border ${darkMode ? 'border-white/5' : 'border-white/10'} flex flex-col h-[800px] ${isScientific ? 'max-w-2xl w-full' : 'max-w-md w-full'} relative z-10`}
      >
        {/* Branding */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {["Built", "by", "Raunak", "Shrestha"].map((word, i) => (
            <span 
              key={i}
              className="text-[10px] font-bold uppercase tracking-[0.2em] animate-rgb opacity-80"
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* Header */}
        <div className={`p-6 flex justify-between items-center ${darkMode ? 'bg-white/5' : 'bg-white/40'} backdrop-blur-xl sticky top-0 z-10 border-b ${darkMode ? 'border-white/5' : 'border-white/10'}`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-white' : 'bg-zinc-900'}`} />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Precision Calc</span>
            </div>
            <button 
              onClick={() => setIsScientific(!isScientific)}
              className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-900 transition-colors ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-50'} px-2 py-1 rounded-full`}
            >
              {isScientific ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
              {isScientific ? 'Basic' : 'Scientific'}
            </button>
            {isScientific && (
              <button 
                onClick={() => setIsRadians(!isRadians)}
                className={`text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-900 transition-colors ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-50'} px-2 py-1 rounded-full`}
              >
                {isRadians ? 'Rad' : 'Deg'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-white/10 text-yellow-400' : 'hover:bg-zinc-100 text-zinc-500'}`}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <motion.div 
              key={balance}
              initial={{ scale: 1.1, color: '#10b981' }}
              animate={{ scale: 1, color: '#71717a' }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              className={`flex items-center gap-1 px-3 py-1 ${darkMode ? 'bg-white/5 border-white/5' : 'bg-zinc-50 border-zinc-100'} rounded-full border cursor-pointer hover:bg-white/10 transition-colors`}
              onClick={() => setShowWithdrawModal(true)}
            >
              <span className="text-xs font-mono font-bold text-zinc-600">{formatCurrency(balance)}</span>
            </motion.div>
            {balance >= MAX_BALANCE && (
              <button 
                onClick={() => setShowWithdrawModal(true)}
                className="text-[10px] font-bold uppercase tracking-wider text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-full transition-colors shadow-sm"
              >
                Withdraw
              </button>
            )}
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500"
            >
              <History size={20} />
            </button>
          </div>
        </div>

        {/* Display Area */}
        <div className={`flex-1 px-8 py-4 flex flex-col justify-end items-end relative overflow-hidden ${darkMode ? 'bg-black/20' : 'bg-white/20'} backdrop-blur-sm`}>
          <AnimatePresence>
            {showWithdrawModal && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`absolute inset-0 ${darkMode ? 'bg-zinc-900/95' : 'bg-white/95'} backdrop-blur-2xl z-40 flex flex-col overflow-y-auto`}
              >
                {/* Withdrawal Header */}
                <div className="p-6 bg-zinc-900 text-white flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                      <Wallet size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-widest opacity-60">Payout Center</h3>
                      <p className="text-xs font-medium text-emerald-400">Secure Withdrawal</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowWithdrawModal(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                </div>

                {/* Withdrawal Content */}
                <div className="flex-1 p-8 space-y-8">
                  {/* Balance Card */}
                  <div className="relative overflow-hidden bg-zinc-50 rounded-[2rem] p-8 border border-zinc-100 shadow-sm">
                    <div className="relative z-10">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Available Balance</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-light tracking-tighter text-zinc-900">{formatCurrency(balance)}</span>
                      </div>
                      <div className="mt-6 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(balance / MAX_BALANCE) * 100}%` }}
                            className="h-full bg-emerald-500"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400">{Math.round((balance / MAX_BALANCE) * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center shrink-0">
                        <ShieldCheck size={18} className="text-zinc-900" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 mb-1">Verification Required</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">To ensure secure payouts, we require manual verification of your earnings.</p>
                      </div>
                    </div>

                    <div className="bg-zinc-900 rounded-3xl p-6 text-white space-y-4 shadow-xl shadow-zinc-900/20">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        </div>
                        <span className="text-sm font-bold">Withdrawal Steps</span>
                      </div>
                      
                      <ol className="space-y-4">
                        <li className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                          <p className="text-xs opacity-80">Capture a clear <span className="text-white font-bold underline decoration-emerald-400 underline-offset-4">screenshot</span> of this payout page showing your balance.</p>
                        </li>
                        <li className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                          <p className="text-xs opacity-80">Direct message our verification team on Instagram with your screenshot.</p>
                        </li>
                      </ol>

                      <a 
                        href="https://www.instagram.com/raunakshrestha45/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between bg-white/10 hover:bg-white/20 p-4 rounded-2xl transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <Instagram size={20} className="text-pink-400" />
                          <div>
                            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Instagram Support</p>
                            <p className="text-sm font-bold">@raunakshrestha45</p>
                          </div>
                        </div>
                        <ArrowUpRight size={20} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </div>
                  </div>

                  {/* Status Footer */}
                  <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest pt-4">
                    <Lock size={12} />
                    <span>End-to-End Encrypted Verification</span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="p-8 bg-white border-t border-zinc-50">
                  <button 
                    disabled={balance < MAX_BALANCE}
                    onClick={() => setShowWithdrawModal(false)}
                    className={`w-full py-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                      balance >= MAX_BALANCE 
                        ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/20' 
                        : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    {balance >= MAX_BALANCE ? (
                      <>
                        <CheckCircle2 size={20} />
                        Ready to Withdraw
                      </>
                    ) : (
                      <>
                        <Lock size={18} />
                        Minimum {formatCurrency(MAX_BALANCE)} Required
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`absolute top-0 right-0 ${darkMode ? 'bg-red-900/20 text-red-400 border-red-900/30' : 'bg-red-50 text-red-600 border-red-100'} px-3 py-1 rounded-lg text-[10px] font-bold border shadow-sm z-30`}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {warning && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-4 left-1/2 -translate-x-1/2 ${darkMode ? 'bg-red-900/20 text-red-400 border-red-900/30' : 'bg-red-50 text-red-600 border-red-100'} px-4 py-2 rounded-xl text-xs font-bold border shadow-sm z-30`}
              >
                {warning}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {showHistory ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`absolute inset-0 ${darkMode ? 'bg-zinc-900/90' : 'bg-white/90'} backdrop-blur-2xl z-20 p-6 overflow-y-auto`}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">History</h3>
                  <button onClick={() => setHistory([])} className={`text-xs ${darkMode ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'} flex items-center gap-1`}>
                    <RotateCcw size={12} /> Clear
                  </button>
                </div>
                <div className="space-y-4">
                  {history.length === 0 ? (
                    <p className="text-zinc-300 text-sm italic">No history yet</p>
                  ) : (
                    history.map((item, i) => (
                      <div key={i} className={`text-right border-b ${darkMode ? 'border-white/5' : 'border-zinc-50'} pb-2`}>
                        <p className="text-xs text-zinc-400 mb-1">{item.eq}</p>
                        <p className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-zinc-800'}`}>{item.res}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="w-full text-right">
            <div className="flex justify-between items-center mb-1">
              {memory !== 0 && (
                <motion.span 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded"
                >
                  M
                </motion.span>
              )}
              <motion.p 
                key={equation}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-zinc-400 text-lg h-8 font-medium ml-auto"
              >
                {equation}
              </motion.p>
            </div>
              <motion.h1 
                key={display}
                initial={{ y: 5, opacity: 0, scale: 0.98 }}
                animate={{ 
                  y: 0, 
                  opacity: 1, 
                  scale: isResult ? [1, 1.05, 1] : 1,
                  filter: isResult ? "brightness(1.5)" : "brightness(1)"
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={`text-6xl font-light tracking-tighter ${darkMode ? 'text-white' : 'text-zinc-900'} break-all drop-shadow-sm ${isResult ? 'rainbow-text' : ''}`}
              >
              {display}
            </motion.h1>
          </div>
        </div>

        {/* Memory Bar */}
        <div className={`px-6 py-2 flex gap-2 ${darkMode ? 'bg-white/5' : 'bg-white/20'} border-y ${darkMode ? 'border-white/5' : 'border-white/5'} backdrop-blur-sm`}>
          <button onClick={() => handleMemory('MC')} className={`flex-1 text-[10px] font-bold ${darkMode ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'} transition-colors py-1`}>MC</button>
          <button onClick={() => handleMemory('MR')} className={`flex-1 text-[10px] font-bold ${darkMode ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'} transition-colors py-1`}>MR</button>
          <button onClick={() => handleMemory('M+')} className={`flex-1 text-[10px] font-bold ${darkMode ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'} transition-colors py-1`}>M+</button>
          <button onClick={() => handleMemory('M-')} className={`flex-1 text-[10px] font-bold ${darkMode ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'} transition-colors py-1`}>M-</button>
        </div>

        {/* Keypad Container */}
        <motion.div layout className={`flex p-6 ${darkMode ? 'bg-black/20' : 'bg-white/40'} backdrop-blur-md gap-4`}>
          {/* Scientific Keypad */}
          <AnimatePresence mode="popLayout">
            {isScientific && (
              <motion.div 
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="grid grid-cols-3 gap-2 w-[45%]"
              >
                <Button onClick={() => handleScientificFunc('sin')} variant="scientific" darkMode={darkMode} small>sin</Button>
                <Button onClick={() => handleScientificFunc('cos')} variant="scientific" darkMode={darkMode} small>cos</Button>
                <Button onClick={() => handleScientificFunc('tan')} variant="scientific" darkMode={darkMode} small>tan</Button>
                
                <Button onClick={() => handleScientificFunc('asin')} variant="scientific" darkMode={darkMode} small>asin</Button>
                <Button onClick={() => handleScientificFunc('acos')} variant="scientific" darkMode={darkMode} small>acos</Button>
                <Button onClick={() => handleScientificFunc('atan')} variant="scientific" darkMode={darkMode} small>atan</Button>

                <Button onClick={() => handleScientificFunc('sinh')} variant="scientific" darkMode={darkMode} small>sinh</Button>
                <Button onClick={() => handleScientificFunc('cosh')} variant="scientific" darkMode={darkMode} small>cosh</Button>
                <Button onClick={() => handleScientificFunc('tanh')} variant="scientific" darkMode={darkMode} small>tanh</Button>

                <Button onClick={() => handleScientificFunc('sqrt')} variant="scientific" darkMode={darkMode} small>√</Button>
                <Button onClick={() => handleScientificFunc('log')} variant="scientific" darkMode={darkMode} small>log</Button>
                <Button onClick={() => handleScientificFunc('ln')} variant="scientific" darkMode={darkMode} small>ln</Button>

                <Button onClick={() => handleOperator('^')} variant="scientific" darkMode={darkMode} small>xʸ</Button>
                <Button onClick={() => handleScientificFunc('pow2')} variant="scientific" darkMode={darkMode} small>x²</Button>
                <Button onClick={() => handleScientificFunc('fact')} variant="scientific" darkMode={darkMode} small>n!</Button>

                <Button onClick={() => handleScientificFunc('pi')} variant="scientific" darkMode={darkMode} small>π</Button>
                <Button onClick={() => handleScientificFunc('e')} variant="scientific" darkMode={darkMode} small>e</Button>
                <div /> {/* Spacer */}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Basic Keypad */}
          <div className={`grid grid-cols-4 gap-3 flex-1`}>
            {/* Row 1 */}
            <Button onClick={handleClear} variant="action" darkMode={darkMode}>AC</Button>
            <Button onClick={handleToggleSign} variant="action" darkMode={darkMode}>+/-</Button>
            <Button onClick={handlePercent} variant="action" darkMode={darkMode}><Percent size={20} /></Button>
            <Button onClick={() => handleOperator('/')} variant="operator" darkMode={darkMode} active={operator === '/'}><Divide size={24} /></Button>

            {/* Row 2 */}
            <Button onClick={() => handleNumber('7')} darkMode={darkMode}>7</Button>
            <Button onClick={() => handleNumber('8')} darkMode={darkMode}>8</Button>
            <Button onClick={() => handleNumber('9')} darkMode={darkMode}>9</Button>
            <Button onClick={() => handleOperator('*')} variant="operator" darkMode={darkMode} active={operator === '*'}><X size={24} /></Button>

            {/* Row 3 */}
            <Button onClick={() => handleNumber('4')} darkMode={darkMode}>4</Button>
            <Button onClick={() => handleNumber('5')} darkMode={darkMode}>5</Button>
            <Button onClick={() => handleNumber('6')} darkMode={darkMode}>6</Button>
            <Button onClick={() => handleOperator('-')} variant="operator" darkMode={darkMode} active={operator === '-'}><Minus size={24} /></Button>

            {/* Row 4 */}
            <Button onClick={() => handleNumber('1')} darkMode={darkMode}>1</Button>
            <Button onClick={() => handleNumber('2')} darkMode={darkMode}>2</Button>
            <Button onClick={() => handleNumber('3')} darkMode={darkMode}>3</Button>
            <Button onClick={() => handleOperator('+')} variant="operator" darkMode={darkMode} active={operator === '+'}><Plus size={24} /></Button>

            {/* Row 5 */}
            <Button onClick={() => handleNumber('0')} className="col-span-1" darkMode={darkMode}>0</Button>
            <Button onClick={handleDecimal} darkMode={darkMode}>.</Button>
            <Button onClick={handleDelete} variant="action" darkMode={darkMode}><Delete size={20} /></Button>
            <Button onClick={handleEqual} variant="accent" darkMode={darkMode}><Equal size={24} /></Button>
          </div>
        </motion.div>

        {/* Footer Accent */}
        <div className="h-2 bg-zinc-900 w-32 mx-auto mb-4 rounded-full opacity-10" />
      </motion.div>
    </div>
  );
}
