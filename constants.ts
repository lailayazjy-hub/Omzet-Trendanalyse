import { Language, Translations, Theme } from "./types";

export const LABELS: Translations = {
  title: {
    [Language.NL]: "Omzet Trendanalyse",
    [Language.EN]: "Revenue Trend Analysis"
  },
  upload: {
    [Language.NL]: "Upload Data",
    [Language.EN]: "Upload Data"
  },
  demo: {
    [Language.NL]: "Laad Demo",
    [Language.EN]: "Load Demo"
  },
  downloadTemplate: {
    [Language.NL]: "Download Sjabloon",
    [Language.EN]: "Download Template"
  },
  analysisPeriod: {
    [Language.NL]: "Analyseperiode",
    [Language.EN]: "Analysis Period"
  },
  customRange: {
    [Language.NL]: "Aangepast Bereik",
    [Language.EN]: "Custom Range"
  },
  startDate: {
    [Language.NL]: "Startdatum",
    [Language.EN]: "Start Date"
  },
  endDate: {
    [Language.NL]: "Einddatum",
    [Language.EN]: "End Date"
  },
  costType: { 
    [Language.NL]: "Omzetsoort",
    [Language.EN]: "Revenue Type"
  },
  anomalies: {
    [Language.NL]: "Gedetecteerde Afwijkingen",
    [Language.EN]: "Detected Anomalies"
  },
  severity: {
    [Language.NL]: "Ernst",
    [Language.EN]: "Severity"
  },
  deviation: {
    [Language.NL]: "Afwijking",
    [Language.EN]: "Deviation"
  },
  aiAnalysis: {
    [Language.NL]: "AI Omzet Analyse",
    [Language.EN]: "AI Revenue Analysis"
  },
  export: {
    [Language.NL]: "Rapport Exporteren",
    [Language.EN]: "Export Report"
  },
  commentPlaceholder: {
    [Language.NL]: "Voeg een opmerking toe...",
    [Language.EN]: "Add a comment..."
  },
  noData: {
    [Language.NL]: "Geen data beschikbaar. Upload een omzetbestand of gebruik demo data.",
    [Language.EN]: "No data available. Upload a revenue file or use demo data."
  },
  trendAnalysis: {
    [Language.NL]: "Omzet Trendanalyse",
    [Language.EN]: "Revenue Trend Analysis"
  },
  all: {
    [Language.NL]: "Alle Omzet",
    [Language.EN]: "All Revenue"
  },
  loading: {
    [Language.NL]: "Laden...",
    [Language.EN]: "Loading..."
  },
  noAnomalies: {
    [Language.NL]: "Geen afwijkingen gedetecteerd in deze periode.",
    [Language.EN]: "No anomalies detected in this period."
  },
  aiInsightLabel: {
    [Language.NL]: "AI Inzicht:",
    [Language.EN]: "AI Insight:"
  },
  settings: {
    [Language.NL]: "Instellingen & Lookup",
    [Language.EN]: "Settings & Lookup"
  },
  lookupRules: {
    [Language.NL]: "Omzet Regels",
    [Language.EN]: "Revenue Rules"
  },
  unmatchedItems: {
    [Language.NL]: "Niet Gematchte Inkomsten",
    [Language.EN]: "Unmatched Revenue"
  },
  downloadLookup: {
    [Language.NL]: "Download Regels",
    [Language.EN]: "Download Rules"
  },
  uploadLookup: {
    [Language.NL]: "Upload Regels",
    [Language.EN]: "Upload Rules"
  },
  backToDashboard: {
    [Language.NL]: "Terug naar Dashboard",
    [Language.EN]: "Back to Dashboard"
  },
  unknown: {
    [Language.NL]: "Onbekend",
    [Language.EN]: "Unknown"
  },
  appName: {
    [Language.NL]: "Applicatie Naam",
    [Language.EN]: "Application Name"
  },
  selectTheme: {
    [Language.NL]: "Selecteer Thema",
    [Language.EN]: "Select Theme"
  },
  appearance: {
    [Language.NL]: "Uiterlijk",
    [Language.EN]: "Appearance"
  }
};

export const THEMES: Record<string, Theme> = {
  terraCotta: {
    id: 'terraCotta',
    name: "Terra Cotta Landscape",
    colors: {
      highRisk: "#D66D6B",
      mediumRisk: "#F3B0A9",
      lowRisk: "#BDD7C6",
      primary: "#52939D",
      text: "#242F4D",
    }
  },
  forestGreen: {
    id: 'forestGreen',
    name: "Forest Green",
    colors: {
      highRisk: "#9A6C5A",
      mediumRisk: "#E4F46A",
      lowRisk: "#2E7B57",
      primary: "#2E7B57",
      text: "#14242E",
    }
  },
  autumnLeaves: {
    id: 'autumnLeaves',
    name: "Autumn Leaves",
    colors: {
      highRisk: "#2E2421",
      mediumRisk: "#B49269",
      lowRisk: "#B1782F",
      primary: "#B1782F",
      text: "#8B8F92",
    }
  },
  citrusGarden: {
    id: 'citrusGarden',
    name: "Citrus Garden",
    colors: {
      highRisk: "#F8B24A",
      mediumRisk: "#FDD268",
      lowRisk: "#8FAB56",
      primary: "#4D7B41",
      text: "#242F4D",
      accent1: "#B5E2EA",
      accent2: "#82A179"
    }
  },
  rusticCafe: {
    id: 'rusticCafe',
    name: "Rustic Café",
    colors: {
      highRisk: "#A65A4E",
      mediumRisk: "#E89A63",
      lowRisk: "#D5B48A",
      primary: "#5BB1B3",
      text: "#1A1D32",
      accent1: "#8BC7C5",
      accent2: "#011B4D"
    }
  },
  bloodOrange: {
    id: 'bloodOrange',
    name: "Blood Orange Velvet",
    colors: {
      highRisk: "#B43836",
      mediumRisk: "#F6891F",
      lowRisk: "#E4C18B",
      primary: "#1A2F5E",
      text: "#202530",
      accent1: "#C5C6C9"
    }
  },
  canyonHeat: {
    id: 'canyonHeat',
    name: "Canyon Heat",
    colors: {
      highRisk: "#7A0010",
      mediumRisk: "#B1126F",
      lowRisk: "#EF3D22",
      primary: "#FF7A15",
      text: "#3B1F12",
      accent1: "#FFD11A"
    }
  }
};