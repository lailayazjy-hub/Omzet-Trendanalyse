import { FinancialRecord, Anomaly, LookupRule, Language } from './types';
import { format, parse, subMonths, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import * as XLSX from 'xlsx';

// Currency formatting: 1500 -> 1.5k
export const formatCurrency = (amount: number): string => {
  const value = amount / 1000;
  return `EUR ${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
};

// Date formatting
export const formatDate = (date: Date, lang: Language): string => {
  return format(date, 'dd MMM yyyy', { locale: lang === Language.NL ? nl : enUS });
};

// Statistical Anomaly Detection (Z-Score)
export const detectAnomalies = (data: FinancialRecord[]): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  const groupedByType: Record<string, number[]> = {};

  // Group amounts by revenue type to calculate stats
  data.forEach(record => {
    if (!groupedByType[record.revenueType]) {
      groupedByType[record.revenueType] = [];
    }
    groupedByType[record.revenueType].push(record.amount);
  });

  // Calculate Mean and StdDev per type
  const stats: Record<string, { mean: number; stdDev: number }> = {};
  Object.keys(groupedByType).forEach(type => {
    const values = groupedByType[type];
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    stats[type] = { mean, stdDev: Math.sqrt(variance) };
  });

  // Identify anomalies
  data.forEach(record => {
    const { mean, stdDev } = stats[record.revenueType];
    if (stdDev === 0) return;

    const zScore = (record.amount - mean) / stdDev;
    
    // Threshold > 2 Standard Deviations
    if (Math.abs(zScore) > 2) {
      let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (Math.abs(zScore) > 4) severity = 'HIGH';
      else if (Math.abs(zScore) > 3) severity = 'MEDIUM';

      // For Revenue: Positive Spike is Good (Greenish logic in head, but still anomaly), Negative is Bad.
      const descNL = zScore > 0 ? 'Opvallende Omzetpiek' : 'Onverwachte Omzetdaling';
      const descEN = zScore > 0 ? 'Revenue Spike' : 'Revenue Drop';

      anomalies.push({
        id: record.id,
        date: record.date,
        revenueType: record.revenueType,
        amount: record.amount,
        zScore,
        severity,
        description: descNL 
      });
    }
  });

  return anomalies.sort((a, b) => b.date.getTime() - a.date.getTime());
};

// Updated Lookup Rules based on Revenue Types
export const DEFAULT_LOOKUP_RULES: LookupRule[] = [
  // 1. Terugkerende inkomsten
  { mainCategory: 'Terugkerende inkomsten', subCategory: 'Abonnementen', searchTerm: 'abonnement' },
  { mainCategory: 'Terugkerende inkomsten', subCategory: 'Abonnementen', searchTerm: 'subscription' },
  { mainCategory: 'Terugkerende inkomsten', subCategory: 'Servicecontracten', searchTerm: 'servicecontract' },
  { mainCategory: 'Terugkerende inkomsten', subCategory: 'Support/maintenance fees', searchTerm: 'maintenance' },
  { mainCategory: 'Terugkerende inkomsten', subCategory: 'SLA-contracten', searchTerm: 'sla' },
  { mainCategory: 'Terugkerende inkomsten', subCategory: 'Periodieke licenties', searchTerm: 'maandelijks' },

  // 2. Eenmalige inkomsten
  { mainCategory: 'Eenmalige inkomsten', subCategory: 'Projectwerk', searchTerm: 'project' },
  { mainCategory: 'Eenmalige inkomsten', subCategory: 'Installatiekosten', searchTerm: 'installatie' },
  { mainCategory: 'Eenmalige inkomsten', subCategory: 'Implementaties', searchTerm: 'implementatie' },
  { mainCategory: 'Eenmalige inkomsten', subCategory: 'Training', searchTerm: 'training' },
  { mainCategory: 'Eenmalige inkomsten', subCategory: 'Consultancy per opdracht', searchTerm: 'advies' },

  // 3. Licentie-inkomsten
  { mainCategory: 'Licentie-inkomsten', subCategory: 'Softwarelicenties', searchTerm: 'licentie' },
  { mainCategory: 'Licentie-inkomsten', subCategory: 'Softwarelicenties', searchTerm: 'license' },
  { mainCategory: 'Licentie-inkomsten', subCategory: 'Usage-based licenties', searchTerm: 'usage' },
  { mainCategory: 'Licentie-inkomsten', subCategory: 'API-call licenties', searchTerm: 'api call' },

  // 4. Dienstverlening
  { mainCategory: 'Dienstverlening', subCategory: 'Consultancy per uur', searchTerm: 'consultancy uren' },
  { mainCategory: 'Dienstverlening', subCategory: 'Maatwerkontwikkeling', searchTerm: 'maatwerk' },
  { mainCategory: 'Dienstverlening', subCategory: 'Maatwerkontwikkeling', searchTerm: 'development' },
  { mainCategory: 'Dienstverlening', subCategory: 'Support-in-uren', searchTerm: 'strippenkaart' },

  // 5. Transactionele inkomsten
  { mainCategory: 'Transactionele inkomsten', subCategory: 'Per transactie', searchTerm: 'transactie' },
  { mainCategory: 'Transactionele inkomsten', subCategory: 'Marketplace fees', searchTerm: 'marketplace' },

  // 6. Usage-based inkomsten
  { mainCategory: 'Usage-based inkomsten', subCategory: 'Per GB', searchTerm: 'storage' },
  { mainCategory: 'Usage-based inkomsten', subCategory: 'Per minuut', searchTerm: 'belminuten' },

  // 7. Productverkoop
  { mainCategory: 'Productverkoop', subCategory: 'Hardware', searchTerm: 'hardware' },
  { mainCategory: 'Productverkoop', subCategory: 'Hardware', searchTerm: 'laptop' },
  { mainCategory: 'Productverkoop', subCategory: 'Accessoires', searchTerm: 'accessoire' },

  // 8. Financiële inkomsten
  { mainCategory: 'Financiële inkomsten', subCategory: 'Rente', searchTerm: 'rente' },
  
  // 10. Advertentie-inkomsten
  { mainCategory: 'Advertentie-inkomsten', subCategory: 'Display ads', searchTerm: 'ads' },
  { mainCategory: 'Advertentie-inkomsten', subCategory: 'Sponsored content', searchTerm: 'sponsored' },
];

// Logic to apply lookup rules to records
export const applyLookupRules = (records: FinancialRecord[], rules: LookupRule[]) => {
  const processedRecords: FinancialRecord[] = [];
  const unmatchedItems: Set<string> = new Set();

  records.forEach(record => {
    const textToSearch = `${record.description || ''} ${record.originalCategory || ''}`.toLowerCase();
    
    const match = rules.find(rule => textToSearch.includes(rule.searchTerm.toLowerCase()));

    if (match) {
      processedRecords.push({
        ...record,
        revenueType: match.mainCategory,
        subCategory: match.subCategory
      });
    } else {
      processedRecords.push({
        ...record,
        revenueType: 'Onbekend', // Mark as Unknown
        subCategory: 'Niet geclassificeerd'
      });
      // Add the potential search term to unmatched list
      if (record.description) unmatchedItems.add(record.description);
      else if (record.originalCategory) unmatchedItems.add(record.originalCategory);
    }
  });

  return { processedRecords, unmatchedItems: Array.from(unmatchedItems) };
};

// Generate Excel for Lookup Rules (Standalone download)
export const downloadLookupTemplate = (currentRules: LookupRule[]) => {
  const headers = ['Hoofdsoort', 'Subcategorie', 'Zoekterm'];
  const rows = currentRules.map(r => [r.mainCategory, r.subCategory, r.searchTerm]);
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wscols = [{ wch: 30 }, { wch: 30 }, { wch: 30 }];
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, "LookupRules");
  XLSX.writeFile(wb, "omzet_lookup_regels.xlsx");
};


// Dummy Data Generator for Revenue Demo
export const generateDemoData = (): FinancialRecord[] => {
  const records: FinancialRecord[] = [];
  const today = new Date();

  // Define generators for Revenue Types
  const generators = [
    { type: 'Terugkerende inkomsten', desc: 'SaaS Abonnement Enterprise', base: 15000, trend: 1.05 }, // Growing MRR
    { type: 'Terugkerende inkomsten', desc: 'Servicecontract Onderhoud', base: 5000, trend: 1.0 },
    { type: 'Eenmalige inkomsten', desc: 'Implementatie Project X', base: 12000, trend: 1 }, // Spiky
    { type: 'Licentie-inkomsten', desc: 'Softwarelicenties Jaarlijks', base: 25000, trend: 1.02 },
    { type: 'Dienstverlening', desc: 'Consultancy Uren', base: 8000, trend: 1 },
    { type: 'Productverkoop', desc: 'Hardware Levering', base: 4000, trend: 1 },
    { type: 'Transactionele inkomsten', desc: 'Marketplace Fees', base: 2000, trend: 1.1 },
    { type: 'Onbekend', desc: 'Bijschrijving XYZ', base: 500, trend: 1 },
  ];

  for (let i = 24; i >= 0; i--) {
    const monthDate = subMonths(today, i);
    
    generators.forEach((gen, idx) => {
      // Apply trend
      const trendFactor = Math.pow(gen.trend, 24 - i);
      let amount = gen.base * trendFactor + (Math.random() * gen.base * 0.2);
      
      // Inject anomalies
      // Spike in project work
      if (gen.type === 'Eenmalige inkomsten' && i % 4 === 0) amount *= 3;
      // Drop in consultancy in summer
      if (gen.type === 'Dienstverlening' && (monthDate.getMonth() === 6 || monthDate.getMonth() === 7)) amount *= 0.5;

      records.push({
        id: `${i}-${idx}`,
        date: monthDate,
        revenueType: gen.type,
        description: gen.desc,
        originalCategory: 'Verkoop',
        amount: Math.round(amount)
      });
    });
  }
  return records;
};

// Generate Excel Template with Omzet Structure
export const downloadTemplate = (currentRules: LookupRule[]) => {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Template Data ---
  const headers = ['Boekstuknummer', 'Relatie', 'Dagboek', 'Grootboek', 'Omzetsoort', 'Datum', 'Bedrag', 'Omschrijving'];
  const rows = [
    ['2024001', 'Klant A', 'VERK', '8000', 'Terugkerende inkomsten', '2024-01-15', 5000.00, 'Maandelijks SaaS Abonnement'],
    ['2024002', 'Klant B', 'VERK', '8010', 'Dienstverlening', '2024-01-18', 1250.00, 'Consultancy uren januari'],
    ['2024003', 'Klant C', 'BANK', '8020', 'Eenmalige inkomsten', '2024-01-20', 8500.00, 'Implementatie Project'],
    ['2024004', 'Reseller X', 'VERK', '8030', 'Licentie-inkomsten', '2024-01-22', 2500.00, 'Softwarelicenties Q1']
  ];
  
  const wsData = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wscols = headers.map(() => ({ wch: 20 }));
  wsData['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, wsData, "OmzetTemplate");

  // --- Sheet 2: Lookup Rules ---
  const ruleHeaders = ['Hoofdsoort', 'Subcategorie', 'Zoekterm'];
  const ruleRows = currentRules.map(r => [r.mainCategory, r.subCategory, r.searchTerm]);
  
  const wsRules = XLSX.utils.aoa_to_sheet([ruleHeaders, ...ruleRows]);
  const wsRulesCols = [{ wch: 30 }, { wch: 30 }, { wch: 40 }];
  wsRules['!cols'] = wsRulesCols;

  XLSX.utils.book_append_sheet(wb, wsRules, "LookupReferenties");

  // Write file
  XLSX.writeFile(wb, "omzet_trendanalyse_template.xlsx");
};