
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction } from "../types";

export const extractTransactions = async (files: { base64: string, type: string }[]): Promise<Transaction[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are a professional financial data extraction specialist. 
    You will be provided with one or more files (images or PDFs) representing pages of a bank statement.
    
    CRITICAL TASK:
    1. Analyze ALL provided parts as a single continuous financial document.
    2. Extract EVERY single transaction into a unified chronological list.
    3. Reconcile transactions: If a table is split across two pages/images, ensure the rows are merged correctly without duplication.
    
    EXTRACTION RULES:
    - Date Format: YYYY-MM-DD. (Assume year 2024 if only month/day provided).
    - Amount: MUST be a number. Positive for deposits/credits. Negative for withdrawals/debits.
    - Category: Intelligent auto-detection (e.g., "Dining", "Groceries", "Utilities", "Salary", "Shopping").
    - Description: Keep the original merchant or transaction text.
    - Notes: Extract any secondary info like location or specific reference IDs.
    
    SKIP:
    - Summary tables (Opening/Closing balance).
    - Page headers/footers.
    - Marketing text or interest rate disclosures.
  `;

  const parts = files.map(file => ({
    inlineData: {
      data: file.base64,
      mimeType: file.type
    }
  }));

  const prompt = `I have uploaded ${files.length} document parts. Please extract the complete transaction history from across all these pages.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { 
          role: 'user', 
          parts: [...parts, { text: prompt }] 
        }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  notes: { type: Type.STRING }
                },
                required: ["date", "description", "amount", "category"]
              }
            }
          }
        }
      }
    });

    const resultText = response.text?.trim() || '{"transactions": []}';
    const parsed = JSON.parse(resultText);
    
    return (parsed.transactions || []).map((t: any, index: number) => ({
      ...t,
      id: `${Date.now()}-${index}`
    }));
  } catch (error) {
    console.error("Gemini Multi-File Extraction Error:", error);
    throw error;
  }
};
