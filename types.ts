export enum Language {
  NL = 'NL',
  EN = 'EN'
}

export enum DateRangeOption {
  MONTHS_3 = '3M',
  MONTHS_6 = '6M',
  MONTHS_9 = '9M',
  YEAR_1 = '1Y',
  CUSTOM = 'CUSTOM'
}

export interface FinancialRecord {
  id: string;
  date: Date;
  revenueType: string;
  subCategory?: string;
  originalCategory?: string;
  description: string;
  amount: number;
}

export interface LookupRule {
  mainCategory: string;
  subCategory: string;
  searchTerm: string;
}

export interface MonthlyAggregatedData {
  month: string; // YYYY-MM
  displayDate: string;
  amount: number;
  revenueType: string;
  prevYearAmount?: number;
}

export interface Anomaly {
  id: string;
  date: Date;
  revenueType: string;
  amount: number;
  zScore: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface Comment {
  id: string;
  recordId: string;
  author: string;
  text: string;
  timestamp: Date;
}

export interface AIInsight {
  revenueType: string;
  insight: string;
}

export interface Translations {
  [key: string]: {
    [Language.NL]: string;
    [Language.EN]: string;
  };
}

export interface ThemeColors {
  highRisk: string;
  mediumRisk: string;
  lowRisk: string;
  primary: string;
  text: string;
  accent1?: string;
  accent2?: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}