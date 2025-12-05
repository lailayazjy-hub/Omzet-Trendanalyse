import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  Upload, Download, Calendar, AlertTriangle, FileText, Activity, 
  MessageSquare, ChevronDown, ChevronUp, RefreshCw, Settings, Save, ArrowLeft, Check, X
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subMonths, isWithinInterval, startOfMonth, endOfMonth, parseISO } from 'date-fns';

import { 
  Language, DateRangeOption, FinancialRecord, Anomaly, 
  MonthlyAggregatedData, Comment, AIInsight, LookupRule, Theme
} from './types';
import { LABELS, THEMES } from './constants';
import { 
  formatCurrency, detectAnomalies, generateDemoData, downloadTemplate, 
  formatDate, DEFAULT_LOOKUP_RULES, applyLookupRules, downloadLookupTemplate 
} from './utils';
import { generateFinancialInsight } from './services/geminiService';

// --- Logo Component ---
// Uses a placeholder image of a Great Spotted Woodpecker (Grote Bonte Specht)
const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`relative rounded-full overflow-hidden bg-[#F7F7F7] flex items-center justify-center border border-slate-100 ${className}`}>
    <img
      src="https://images.unsplash.com/photo-1543555523-c7b5b0dd90a7?auto=format&fit=crop&w=400&q=80"
      alt="FinFocus Woodpecker Logo"
      className="w-[85%] h-[85%] object-cover object-center mix-blend-multiply opacity-90"
      style={{ filter: 'contrast(1.05) saturate(0.8)' }} 
    />
  </div>
);

const App: React.FC = () => {
  // --- State ---
  const [language, setLanguage] = useState<Language>(Language.NL);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Customization State
  const [appName, setAppName] = useState<string>("FinFocus AI Studio");
  const [currentThemeId, setCurrentThemeId] = useState<string>('terraCotta');
  
  const currentTheme = useMemo(() => THEMES[currentThemeId] || THEMES.terraCotta, [currentThemeId]);

  const [rawData, setRawData] = useState<FinancialRecord[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  
  // Lookup State
  const [lookupRules, setLookupRules] = useState<LookupRule[]>(DEFAULT_LOOKUP_RULES);
  const [unmatchedItems, setUnmatchedItems] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  const [dateRange, setDateRange] = useState<DateRangeOption>(DateRangeOption.MONTHS_6);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  
  // Multi-Select State
  const [selectedRevenueTypes, setSelectedRevenueTypes] = useState<string[]>([]);
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  const multiSelectRef = useRef<HTMLDivElement>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const [aiInsights, setAiInsights] = useState<Record<string, AIInsight>>({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // --- Theme Application Effect ---
  useLayoutEffect(() => {
    const root = document.documentElement;
    const colors = currentTheme.colors;
    
    // Set CSS Variables for dynamic usage
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-high-risk', colors.highRisk);
    root.style.setProperty('--color-medium-risk', colors.mediumRisk);
    root.style.setProperty('--color-low-risk', colors.lowRisk);
    
    // Optional Accents
    if (colors.accent1) root.style.setProperty('--color-accent1', colors.accent1);
    if (colors.accent2) root.style.setProperty('--color-accent2', colors.accent2);

  }, [currentTheme]);

  // --- Effects ---

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (multiSelectRef.current && !multiSelectRef.current.contains(event.target as Node)) {
        setIsMultiSelectOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Process data
  const filteredData = useMemo(() => {
    if (rawData.length === 0) return [];

    let start: Date;
    let end: Date = new Date();

    switch (dateRange) {
      case DateRangeOption.MONTHS_3: start = subMonths(end, 3); break;
      case DateRangeOption.MONTHS_6: start = subMonths(end, 6); break;
      case DateRangeOption.MONTHS_9: start = subMonths(end, 9); break;
      case DateRangeOption.YEAR_1: start = subMonths(end, 12); break;
      case DateRangeOption.CUSTOM:
        start = customStart ? new Date(customStart) : subMonths(end, 6);
        end = customEnd ? new Date(customEnd) : new Date();
        break;
      default: start = subMonths(end, 6);
    }
    start = startOfMonth(start);
    end = endOfMonth(end);

    return rawData.filter(r => 
      isWithinInterval(r.date, { start, end }) && 
      (selectedRevenueTypes.length === 0 || selectedRevenueTypes.includes(r.revenueType))
    );
  }, [rawData, dateRange, customStart, customEnd, selectedRevenueTypes]);

  // Anomalies
  useEffect(() => {
    if (filteredData.length > 0) {
      const foundAnomalies = detectAnomalies(filteredData);
      setAnomalies(foundAnomalies);
    } else {
      setAnomalies([]);
    }
  }, [filteredData]);

  // AI Analysis
  const runAIAnalysis = useCallback(async () => {
    if (rawData.length === 0) return;
    setIsLoadingAI(true);
    const allTypes = Array.from(new Set(rawData.map(r => r.revenueType))).filter(t => t !== 'Onbekend');
    const typesToAnalyze = selectedRevenueTypes.length > 0 ? selectedRevenueTypes : allTypes;
    const limitedTypes = typesToAnalyze.slice(0, 10);
    
    const newInsights: Record<string, AIInsight> = {};
    await Promise.all(limitedTypes.map(async (type) => {
      const records = rawData.filter(r => r.revenueType === type);
      const insight = await generateFinancialInsight(type, records, language);
      newInsights[type] = insight;
    }));

    setAiInsights(prev => ({ ...prev, ...newInsights }));
    setIsLoadingAI(false);
  }, [rawData, selectedRevenueTypes, language]);

  useEffect(() => {
    if (rawData.length > 0) runAIAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData.length]); 

  // --- Handlers ---
  const processFinancialData = (data: any[][]) => {
    if (!data || data.length < 2) return;
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    let dateIdx = headers.findIndex(h => ['datum', 'date', 'transactiedatum'].some(k => h.includes(k)));
    let amountIdx = headers.findIndex(h => ['bedrag', 'amount', 'saldo'].some(k => h.includes(k)));
    let idIdx = headers.findIndex(h => ['boekstuk', 'id', 'transactie'].some(k => h.includes(k)));
    let descIdx = headers.findIndex(h => ['omschrijving', 'relatie', 'description', 'naam', 'klant'].some(k => h.includes(k)));
    let typeIdx = headers.findIndex(h => ['omzetsoort', 'inkomsten', 'revenue', 'kostensoort', 'category', 'grootboek'].some(k => h.includes(k)));
    
    if (dateIdx === -1 && amountIdx === -1 && data[0].length >= 3) {
        dateIdx = 0; typeIdx = 1; amountIdx = 2;
        if (descIdx === -1) descIdx = 1; 
    }

    if (dateIdx === -1 || amountIdx === -1) {
      alert(language === Language.NL ? "Kon datums of bedragen niet herkennen." : "Could not recognize dates or amounts.");
      return;
    }

    const records: FinancialRecord[] = data.slice(1).map((row, idx) => {
      const rawDate = row[dateIdx];
      const rawDesc = descIdx !== -1 ? row[descIdx] : '';
      const rawType = typeIdx !== -1 ? row[typeIdx] : '';
      const rawAmount = row[amountIdx];
      const rawId = idIdx !== -1 ? row[idIdx] : `row-${idx}`;
      
      let dateObj = new Date(rawDate);
      if (typeof rawDate === 'number') dateObj = new Date(Math.round((rawDate - 25569)*86400*1000));
      else if (typeof rawDate === 'string') {
          if (isNaN(dateObj.getTime())) {
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
      }

      let amount = typeof rawAmount === 'number' ? rawAmount : 0;
      if (typeof rawAmount === 'string') {
        let clean = rawAmount.trim();
        if (clean.includes(',') && !clean.includes('.')) clean = clean.replace(',', '.');
        else if (clean.includes('.') && clean.includes(',')) {
            if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) clean = clean.replace(/\./g, '').replace(',', '.');
            else clean = clean.replace(/,/g, '');
        }
        amount = parseFloat(clean);
      }

      return {
        id: String(rawId),
        date: dateObj,
        revenueType: String(rawType || 'Onbekend'),
        originalCategory: String(rawType || ''),
        description: String(rawDesc),
        amount: isNaN(amount) ? 0 : amount
      };
    }).filter(r => r.date instanceof Date && !isNaN(r.date.getTime()) && r.amount !== 0);

    const { processedRecords, unmatchedItems } = applyLookupRules(records, lookupRules);
    setRawData(processedRecords);
    setUnmatchedItems(unmatchedItems);
  };

  const processLookupFile = (data: any[][]) => {
     if (!data || data.length < 2) return;
     const newRules: LookupRule[] = data.slice(1).map(row => ({
         mainCategory: String(row[0] || ''),
         subCategory: String(row[1] || ''),
         searchTerm: String(row[2] || '')
     })).filter(r => r.mainCategory && r.searchTerm);

     if (newRules.length > 0) {
         setLookupRules(newRules);
         if (rawData.length > 0) {
            const { processedRecords, unmatchedItems } = applyLookupRules(rawData, newRules);
            setRawData(processedRecords);
            setUnmatchedItems(unmatchedItems);
         }
         alert(language === Language.NL ? "Regels succesvol bijgewerkt" : "Rules updated successfully");
     }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, isLookup: boolean = false) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const onLoad = (data: any[][]) => {
        if (isLookup) processLookupFile(data);
        else processFinancialData(data);
    };

    if (file.name.endsWith('.csv')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        Papa.parse(text, { skipEmptyLines: true, complete: (results) => onLoad(results.data as any[][]) });
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        onLoad(json as any[][]);
      };
      reader.readAsBinaryString(file);
    }
    event.target.value = ''; 
  };

  const handleLoadDemo = () => {
    const demo = generateDemoData();
    const { processedRecords, unmatchedItems } = applyLookupRules(demo, lookupRules);
    setRawData(processedRecords);
    setUnmatchedItems(unmatchedItems);
  };

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const addComment = (recordId: string, text: string) => {
    if (!text.trim()) return;
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      recordId,
      author: 'Manager',
      text,
      timestamp: new Date()
    };
    setComments([...comments, newComment]);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Revenue Report - ${format(new Date(), 'yyyy-MM-dd')}`, 14, 15);
    const tableData = anomalies.map(a => [
      format(a.date, 'yyyy-MM-dd'), a.revenueType, formatCurrency(a.amount), a.description, a.severity
    ]);
    autoTable(doc, {
      head: [['Date', 'Revenue Type', 'Amount', 'Description', 'Severity']],
      body: tableData,
      startY: 20
    });
    doc.save('revenue_analysis.pdf');
  };

  const uniqueRevenueTypes = useMemo(() => 
    Array.from(new Set(rawData.map(r => r.revenueType))).sort(), 
  [rawData]);

  const toggleRevenueType = (type: string) => {
    setSelectedRevenueTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const chartData = useMemo(() => {
    const grouped: Record<string, { [key: string]: number }> = {};
    filteredData.forEach(r => {
      const monthKey = format(r.date, 'yyyy-MM');
      if (!grouped[monthKey]) grouped[monthKey] = { time: new Date(monthKey).getTime() };
      if (!grouped[monthKey][r.revenueType]) grouped[monthKey][r.revenueType] = 0;
      grouped[monthKey][r.revenueType] += r.amount;
    });
    return Object.keys(grouped).sort().map(key => ({ name: key, ...grouped[key] }));
  }, [filteredData]);

  // Dynamic Chart Colors from Theme
  const chartColors = useMemo(() => {
    const c = currentTheme.colors;
    return [c.primary, c.lowRisk, c.mediumRisk, c.highRisk, c.text, c.accent1 || '#8884d8', c.accent2 || '#82ca9d'];
  }, [currentTheme]);

  return (
    <div className="min-h-screen pb-10 relative bg-slate-50 transition-colors duration-300">
      
      {/* Watermark Logo - 5% Opacity as requested */}
      <div className="fixed bottom-10 right-10 opacity-[0.05] pointer-events-none z-0">
         <Logo className="w-96 h-96" />
      </div>

      {/* --- Sticky Header --- */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowSettings(false)}>
              <div className="p-1 rounded-full border border-slate-100 bg-slate-50">
                <Logo className="w-8 h-8" />
              </div>
              <h1 
                className="text-xl font-bold transition-colors duration-300"
                style={{ color: 'var(--color-primary)' }}
              >
                {appName}
              </h1>
            </div>

            <div className="flex items-center gap-4">
               <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border ${showSettings ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  style={showSettings ? { backgroundColor: 'var(--color-primary)' } : {}}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">{LABELS.settings[language]}</span>
               </button>

              <button 
                onClick={() => setLanguage(language === Language.NL ? Language.EN : Language.NL)}
                className="px-3 py-1 text-sm font-semibold rounded bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                {language}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 relative z-10">
        
        {/* --- SETTINGS VIEW --- */}
        {showSettings ? (
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                     <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full">
                         <ArrowLeft className="w-6 h-6 text-slate-600" />
                     </button>
                     <h2 className="text-2xl font-bold text-slate-800">{LABELS.settings[language]}</h2>
                </div>
                
                {/* Global Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                   <h3 className="text-lg font-bold text-slate-800 mb-4">{LABELS.appearance[language]}</h3>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-2">{LABELS.appName[language]}</label>
                           <input 
                              type="text" 
                              value={appName} 
                              onChange={(e) => setAppName(e.target.value)}
                              className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-opacity-50"
                              style={{ focusRingColor: 'var(--color-primary)' }}
                           />
                       </div>
                       
                       <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{LABELS.selectTheme[language]}</label>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {Object.values(THEMES).map(theme => (
                                    <button
                                        key={theme.id}
                                        onClick={() => setCurrentThemeId(theme.id)}
                                        className={`w-full h-12 rounded-lg border-2 flex items-center justify-center transition-all ${currentThemeId === theme.id ? 'border-slate-800 scale-105 shadow-md' : 'border-transparent hover:border-slate-300'}`}
                                        style={{ backgroundColor: theme.colors.primary }}
                                        title={theme.name}
                                    >
                                        {currentThemeId === theme.id && <Check className="text-white w-5 h-5 drop-shadow-md" />}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">{currentTheme.name}</p>
                       </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Rules Table */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">{LABELS.lookupRules[language]}</h3>
                            <div className="flex gap-2">
                                <button onClick={() => downloadLookupTemplate(lookupRules)} className="text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium">
                                    {LABELS.downloadLookup[language]}
                                </button>
                                <div className="relative">
                                    <input type="file" accept=".csv, .xlsx" onChange={(e) => handleFileUpload(e, true)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    <button 
                                        className="text-sm px-3 py-1.5 rounded text-white font-medium hover:opacity-90"
                                        style={{ backgroundColor: 'var(--color-primary)' }}
                                    >
                                        {LABELS.uploadLookup[language]}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto max-h-[400px]">
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">Hoofdsoort</th>
                                        <th className="px-4 py-3">Subcategorie</th>
                                        <th className="px-4 py-3">Zoekterm</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lookupRules.map((rule, idx) => (
                                        <tr key={idx} className="bg-white border-b hover:bg-slate-50">
                                            <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text)' }}>{rule.mainCategory}</td>
                                            <td className="px-4 py-2">{rule.subCategory}</td>
                                            <td className="px-4 py-2 font-mono text-xs">{rule.searchTerm}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Unmatched Items */}
                    <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[500px]">
                         <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800">{LABELS.unmatchedItems[language]}</h3>
                            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">{unmatchedItems.length}</span>
                         </div>
                         <div className="flex-1 overflow-y-auto border border-slate-100 rounded-lg p-2 bg-slate-50">
                             {unmatchedItems.length === 0 ? (
                                 <div className="text-center text-slate-400 mt-10 italic">
                                     {language === Language.NL ? "Alles geclassificeerd!" : "All classified!"}
                                 </div>
                             ) : (
                                 <ul className="space-y-2">
                                     {unmatchedItems.map((item, idx) => (
                                         <li key={idx} className="bg-white p-2 border border-slate-200 rounded text-sm text-slate-700 break-all">{item}</li>
                                     ))}
                                 </ul>
                             )}
                         </div>
                    </div>
                </div>
            </div>
        ) : (
        <>
        {/* --- DASHBOARD VIEW --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
            <div className="w-full lg:w-3/4 space-y-6">
              <div className="flex flex-wrap gap-4">
                <div className="relative group">
                  <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => handleFileUpload(e, false)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button 
                    className="flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-all shadow-sm hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <Upload className="w-4 h-4" />
                    {LABELS.upload[language]}
                  </button>
                </div>
                
                <button 
                  onClick={handleLoadDemo}
                  className="flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-all shadow-sm hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-low-risk)' }}
                >
                  <Activity className="w-4 h-4" />
                  {LABELS.demo[language]}
                </button>

                <button 
                  onClick={() => downloadTemplate(lookupRules)}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-900 px-4 py-2 border border-slate-300 rounded-lg transition-all"
                >
                  <FileText className="w-4 h-4" />
                  {LABELS.downloadTemplate[language]}
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{LABELS.analysisPeriod[language]}</label>
                  <div className="relative">
                    <select 
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
                      className="w-full appearance-none bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg p-2.5 pr-8 focus:ring-opacity-50"
                      style={{ borderColor: 'var(--color-primary)' }}
                    >
                      <option value={DateRangeOption.MONTHS_3}>3 {language === Language.NL ? 'Maanden' : 'Months'}</option>
                      <option value={DateRangeOption.MONTHS_6}>6 {language === Language.NL ? 'Maanden' : 'Months'}</option>
                      <option value={DateRangeOption.MONTHS_9}>9 {language === Language.NL ? 'Maanden' : 'Months'}</option>
                      <option value={DateRangeOption.YEAR_1}>1 {language === Language.NL ? 'Jaar' : 'Year'}</option>
                      <option value={DateRangeOption.CUSTOM}>{LABELS.customRange[language]}</option>
                    </select>
                    <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {dateRange === DateRangeOption.CUSTOM && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{LABELS.startDate[language]}</label>
                      <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg p-2.5" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{LABELS.endDate[language]}</label>
                      <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg p-2.5" />
                    </div>
                  </>
                )}

                <div className="relative" ref={multiSelectRef}>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{LABELS.costType[language]}</label>
                  <button 
                    onClick={() => setIsMultiSelectOpen(!isMultiSelectOpen)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg p-2.5 pr-8 text-left flex items-center justify-between focus:ring-opacity-50"
                    style={{ borderColor: 'var(--color-primary)' }}
                  >
                    <span className="truncate">{selectedRevenueTypes.length === 0 ? LABELS.all[language] : `${selectedRevenueTypes.length} geselecteerd`}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                  
                  {isMultiSelectOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                           <div className="p-2 border-b border-slate-100 flex justify-between">
                               <button onClick={() => setSelectedRevenueTypes([])} className="text-xs font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                                   {language === Language.NL ? "Wis selectie" : "Clear selection"}
                               </button>
                           </div>
                           {uniqueRevenueTypes.map((type) => {
                               const isSelected = selectedRevenueTypes.includes(type);
                               return (
                                   <div key={type} className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => toggleRevenueType(type)}>
                                       <div 
                                         className={`w-4 h-4 border rounded mr-3 flex items-center justify-center`}
                                         style={{ 
                                            backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                                            borderColor: isSelected ? 'var(--color-primary)' : '#cbd5e1'
                                         }}
                                       >
                                           {isSelected && <Check className="w-3 h-3 text-white" />}
                                       </div>
                                       <span className="text-sm text-slate-700">{type}</span>
                                   </div>
                               );
                           })}
                      </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full lg:w-auto">
               <button 
                  onClick={exportPDF}
                  disabled={rawData.length === 0}
                  className="w-full lg:w-auto flex justify-center items-center gap-2 text-white px-6 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-text)' }}
                >
                  <Download className="w-4 h-4" />
                  {LABELS.export[language]}
                </button>
            </div>
          </div>
        </div>

        {rawData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
            <Upload className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500">{LABELS.noData[language]}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              {/* AI Insight */}
              {selectedRevenueTypes.length === 1 && (
                <div className="bg-white border rounded-xl p-5 shadow-sm" style={{ borderColor: 'var(--color-primary)' }}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full mt-1 text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                      <RefreshCw className={`w-5 h-5 ${isLoadingAI ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                       <h3 className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-primary)' }}>
                        {LABELS.aiAnalysis[language]}
                      </h3>
                      <p className="text-lg leading-snug font-medium" style={{ color: 'var(--color-text)' }}>
                        {aiInsights[selectedRevenueTypes[0]]?.insight || (isLoadingAI ? LABELS.loading[language] : '')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--color-text)' }}>{LABELS.trendAnalysis[language]}</h2>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => format(new Date(val), 'MMM yy')} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `${val/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`EUR ${value.toLocaleString()}`, 'Amount']}
                      />
                      <Legend />
                      {uniqueRevenueTypes
                        .filter(type => selectedRevenueTypes.length === 0 || selectedRevenueTypes.includes(type))
                        .map((type, index) => (
                          <Line 
                            key={type}
                            type="monotone" 
                            dataKey={type} 
                            stroke={chartColors[index % chartColors.length]} 
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Anomalies */}
            <div className="xl:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full max-h-[800px]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                    <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-medium-risk)' }} />
                    {LABELS.anomalies[language]}
                  </h2>
                  <span className="text-white text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--color-high-risk)' }}>
                    {anomalies.length}
                  </span>
                </div>
                
                <div className="overflow-y-auto flex-1 p-2">
                  {anomalies.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">{LABELS.noAnomalies[language]}</div>
                  ) : (
                    <div className="space-y-3">
                      {anomalies.map((anomaly) => {
                        const isExpanded = expandedRows.has(anomaly.id);
                        const rowComments = comments.filter(c => c.recordId === anomaly.id);
                        const fullRecord = rawData.find(r => r.id === anomaly.id);
                        
                        let severityColor = 'var(--color-low-risk)';
                        if (anomaly.severity === 'MEDIUM') severityColor = 'var(--color-medium-risk)';
                        if (anomaly.severity === 'HIGH') severityColor = 'var(--color-high-risk)';

                        return (
                          <div key={anomaly.id} className="border border-slate-200 rounded-lg overflow-hidden transition-all hover:shadow-md">
                            <div className="p-4 bg-white cursor-pointer flex justify-between items-start" onClick={() => toggleRow(anomaly.id)}>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: severityColor }} />
                                  <span className="text-xs font-bold text-slate-500 uppercase">{anomaly.revenueType}</span>
                                </div>
                                <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatDate(anomaly.date, language)}</h3>
                                {fullRecord?.subCategory && <div className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>{fullRecord.subCategory}</div>}
                                <p className="text-slate-500 text-sm mt-1">{anomaly.description}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{formatCurrency(anomaly.amount)}</div>
                                <div className="text-xs font-medium text-slate-400">Z: {anomaly.zScore.toFixed(2)}</div>
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="bg-slate-50 p-4 border-t border-slate-100">
                                <div className="mb-4 text-xs text-slate-600 p-2 rounded border border-slate-200 bg-white">
                                  <strong>{LABELS.aiInsightLabel[language]}</strong> {aiInsights[anomaly.revenueType]?.insight || LABELS.loading[language]}
                                </div>
                                <div className="space-y-3 mb-4">
                                  {rowComments.map(c => (
                                    <div key={c.id} className="bg-white p-2 rounded border border-slate-200 text-sm shadow-sm">
                                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                                        <span className="font-semibold text-slate-600">{c.author}</span>
                                        <span>{format(c.timestamp, 'dd/MM HH:mm')}</span>
                                      </div>
                                      <p className="text-slate-700">{c.text}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="relative">
                                  <input 
                                    type="text" 
                                    placeholder={LABELS.commentPlaceholder[language]}
                                    className="w-full text-sm border-slate-300 rounded-md pr-10 focus:ring-opacity-50"
                                    style={{ borderColor: 'var(--color-primary)' }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        addComment(anomaly.id, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                      }
                                    }}
                                  />
                                  <MessageSquare className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
};

export default App;