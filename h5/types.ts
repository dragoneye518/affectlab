
export interface Template {
  id: string;
  title: string;
  subtitle: string;
  tag: 'HOT' | 'NEW' | 'LIMITED' | 'FUTURE';
  imageUrl: string;
  cost: number;
  description: string;
  // Updated category logic: 
  // 'lucky' replaces 'fortune' (Compliance: Entertainment)
  // 'sharp' replaces 'toxic' (Compliance: High EQ/Humor)
  category: 'lucky' | 'sharp' | 'persona' | 'future'; 
  inputHint: string; 
  // 快捷标签：用户点击直接填入，优化移动端体验
  quickPrompts: string[];
  presetTexts: string[];
  keywords: string[];
}

export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

export interface GeneratedResult {
  id: string;
  templateId: string;
  imageUrl: string;
  text: string; 
  userInput: string; 
  timestamp: number;
  rarity: Rarity;
  // Visual seed for CSS filters to differentiate images
  filterSeed: number; 
  // NEW: Numerical score for ranking/comparing (0-100)
  luckScore: number;
}

export type ViewState = 'HOME' | 'INPUT' | 'GENERATING' | 'RESULT' | 'MINE';
