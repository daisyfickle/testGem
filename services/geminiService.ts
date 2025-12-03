import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize the client
// Note: In a real production app, you might want to handle missing API keys more gracefully in the UI
const ai = new GoogleGenAI({ apiKey });

export const generateAgentResponse = async (
  input: string,
  systemInstruction: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment variables.");
  }

  try {
    const modelId = 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model: modelId,
      contents: input, // The user input or previous agent's output
      config: {
        systemInstruction: systemInstruction, // The persona/role
      },
    });

    return response.text || "No response generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate content");
  }
};