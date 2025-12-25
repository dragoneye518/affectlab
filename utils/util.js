export const generateHash = (str) => {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; 
  }
  return Math.abs(hash);
};

const WALLET_KEY = 'cp_wallet_v1';

export const getWallet = () => {
  return wx.getStorageSync(WALLET_KEY) || null;
};

export const setWallet = (wallet) => {
  wx.setStorageSync(WALLET_KEY, wallet);
};

export const ensureWallet = (defaultBalance = 20) => {
  const wallet = getWallet();
  if (wallet && typeof wallet.balance === 'number' && Array.isArray(wallet.ledger)) return wallet;

  if (wallet && typeof wallet.balance === 'number' && !Array.isArray(wallet.ledger)) {
    const upgraded = { balance: wallet.balance, ledger: [] };
    setWallet(upgraded);
    return upgraded;
  }

  const initWallet = { balance: defaultBalance, ledger: [] };
  setWallet(initWallet);
  return initWallet;
};

export const addLedgerEntry = ({ amount, type, meta }) => {
  const wallet = ensureWallet();
  const next = {
    balance: wallet.balance + amount,
    ledger: [
      {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        ts: Date.now(),
        type,
        amount,
        meta: meta || {}
      },
      ...wallet.ledger
    ]
  };
  setWallet(next);
  return next;
};

export const clearWalletLedger = () => {
  const wallet = ensureWallet();
  const next = { balance: wallet.balance, ledger: [] };
  setWallet(next);
  return next;
};

export const computeWalletSummary = (ledger) => {
  let totalCredit = 0;
  let totalDebit = 0;
  let adCount = 0;
  let dailyCount = 0;
  let generateCount = 0;

  for (const it of ledger || []) {
    if (typeof it.amount === 'number') {
      if (it.amount > 0) totalCredit += it.amount;
      if (it.amount < 0) totalDebit += Math.abs(it.amount);
    }
    if (it.type === 'AD') adCount += 1;
    if (it.type === 'DAILY') dailyCount += 1;
    if (it.type === 'SPEND') generateCount += 1;
  }

  return { totalCredit, totalDebit, adCount, dailyCount, generateCount };
};

export const formatLedgerEntry = (entry) => {
  const ts = entry.ts ? new Date(entry.ts) : new Date();
  const timeStr = ts.toLocaleString();

  if (entry.type === 'DAILY') {
    return { title: '每日补给', sub: timeStr };
  }
  if (entry.type === 'AD') {
    return { title: '广告补给', sub: timeStr };
  }
  if (entry.type === 'SPEND') {
    const name = entry.meta && (entry.meta.templateTitle || entry.meta.templateId) ? (entry.meta.templateTitle || entry.meta.templateId) : '生成';
    return { title: `生成消耗 · ${name}`, sub: timeStr };
  }
  if (entry.type === 'REROLL') {
    return { title: '重抽消耗', sub: timeStr };
  }
  return { title: '记录', sub: timeStr };
};

export const buildLedgerView = ({ ledger, limit = 50, filter }) => {
  const items = (ledger || [])
    .slice()
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .filter(it => {
      if (filter === 'CREDIT') return typeof it.amount === 'number' && it.amount > 0;
      if (filter === 'DEBIT') return typeof it.amount === 'number' && it.amount < 0;
      if (filter === 'AD') return it.type === 'AD';
      if (filter === 'DAILY') return it.type === 'DAILY';
      if (filter === 'SPEND') return it.type === 'SPEND';
      return true;
    })
    .slice(0, limit)
    .map(it => {
      const formatted = formatLedgerEntry(it);
      return {
        id: it.id,
        ts: it.ts,
        type: it.type,
        amount: it.amount,
        title: formatted.title,
        sub: formatted.sub
      };
    });

  return items;
};
