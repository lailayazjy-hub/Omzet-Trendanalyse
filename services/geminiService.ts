import { GoogleGenAI } from "@google/genai";
import { FinancialRecord, AIInsight, Language } from "../types";

const API_KEY = process.env.API_KEY || ''; 

// Initialize GenAI
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateFinancialInsight = async (
  revenueType: string, 
  records: FinancialRecord[], 
  lang: Language
): Promise<AIInsight> => {
  
  // Guard clause if no key is present (demo mode fallback)
  if (!API_KEY) {
    return {
      revenueType,
      insight: lang === Language.NL 
        ? "AI-sleutel ontbreekt. Dit is een gesimuleerd inzicht gebaseerd op de omzettrend."
        : "AI key missing. This is a simulated insight based on the revenue trend."
    };
  }

  // Sort records by date ascending
  const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Prepare a summarization of the last 6 points for context
  const recentData = sorted.slice(-6).map(r => `${r.date.toISOString().split('T')[0]}: ${r.amount}`).join(', ');

  const promptNL = `
    Analyseer deze omzetreeks voor '${revenueType}': [${recentData}].
    Geef een zakelijke, feitelijke samenvatting van de trend (groei/krimp) of anomalie.
    Focus op of de omzet stabiel is, groeit of daalt.
    Maximaal 2 zinnen. Maximaal 15 woorden. Geen introductie.
  `;

  const promptEN = `
    Analyze this revenue series for '${revenueType}': [${recentData}].
    Provide a professional, factual summary of the trend (growth/decline) or anomaly.
    Focus on whether revenue is stable, growing, or declining.
    Max 2 sentences. Max 15 words. No introduction.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: lang === Language.NL ? promptNL : promptEN,
    });

    const text = response.text || (lang === Language.NL ? "Geen analyse beschikbaar." : "No analysis available.");
    return {
      revenueType,
      insight: text.trim()
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    let errorMessage = lang === Language.NL ? "Kan geen AI-analyse genereren." : "Unable to generate AI analysis.";
    
    // Handle Quota Exceeded (429) specifically
    if (error?.status === 429 || error?.code === 429 || JSON.stringify(error).includes('429')) {
      errorMessage = lang === Language.NL 
        ? "AI-limiet bereikt. Probeer het later opnieuw." 
        : "AI quota exceeded. Please try again later.";
    }

    return {
      revenueType,
      insight: errorMessage
    };
  }
};