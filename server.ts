/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARN: GEMINI_API_KEY environment variable is not set. AI services will be unavailable.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// 1. API: AI Detailed Explanation for AWS Answers
app.post("/api/explain", async (req, res) => {
  try {
    const { question, options, correctAnswers, selectedAnswers, language } = req.body;
    
    if (!question || !options || !correctAnswers) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (question, options, correctAnswers)" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ 
        error: "Servicio de solución IA no configurado. Por favor, asegúrate de configurar GEMINI_API_KEY en Secrets." 
      });
    }

    const optionsText = options.map((opt: any) => `- ${opt.key}: ${opt.text}`).join("\n");
    const correctStr = correctAnswers.join(", ");
    const selectedStr = selectedAnswers && selectedAnswers.length > 0 ? selectedAnswers.join(", ") : "Ninguna seleccionada";
    
    // Enforce Spanish for technical feedback, as requested by the user
    const languagePrompt = "español (toda la explicación, análisis de descarte y el tip del examen deben estar redactados obligatoriamente en español)";

    const promptMessage = `Eres un experto certificado en AWS (AWS Certified Solutions Architect - Professional) y preparas alumnos para el examen AWS SAA-C03.
Analiza la siguiente pregunta y proporciona una explicación detallada de las opciones en el idioma indicado: **${languagePrompt}**.

**Pregunta:**
${question}

**Opciones disponibles:**
${optionsText}

**Respuestas correctas:** ${correctStr}
**Respuestas elegidas por el usuario:** ${selectedStr}

Proporciona una respuesta elegante formateada en Markdown con las siguientes secciones:
1. **Resumen de la solución recomendada (Best Practice)**: Explica sucintamente por qué el escenario de AWS requiere las respuestas correctas.
2. **Análisis de por qué es la opción correcta (enfatizando servicios Cloud)**: Para cada respuesta correcta (${correctStr}), detalla por qué cumple con los requerimientos técnicos y reduce la sobrecarga administrativa o costes según corresponda. Emplea analogías o justificaciones claras basadas en las guías oficiales de AWS.
3. **Análisis de por qué las otras opciones son incorrectas (Descarte)**: Explica por qué cada una de las opciones incorrectas falla (por ejemplo, mayor complejidad administrativa, incompatibilidad de servicios, uso de túneles VPN innecesarios, etc.).
4. **AWS Cheat-Sheet / Tip del Examen**: Una regla corta de oro que pueda memorizar el estudiante para este tipo de preguntas.

Mantén el tono profesional, didáctico y centrado en las buenas prácticas del Well-Architected Framework de AWS. Esfuérzate por el nivel de detalle y precisión.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptMessage,
      config: {
        temperature: 0.2, // low temperature for precise reasoning
      }
    });

    res.json({ explanation: response.text });
  } catch (error: any) {
    console.error("Error in AI explanation:", error);
    res.status(500).json({ error: "Error interno al generar explicación: " + error.message });
  }
});

// 2. API: Dynamic Translation of Question Object (English to Spanish/Mix)
app.post("/api/translate-question", async (req, res) => {
  try {
    const { question, options, targetLanguage } = req.body;
    
    if (!question || !options) {
      return res.status(400).json({ error: "Faltan parámetros de traducción (question, options)" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: "Servicio de IA de traducción no disponible." });
    }

    const promptText = `Traduce el siguiente texto de pregunta de AWS y sus opciones al español de España/Latinoamérica, adaptando la terminología técnica estándar de AWS (p. ej., "Virtual Private Cloud (VPC)", "Direct Connect", "Transit Gateway", "Application Load Balancer" deben quedarse en inglés o usarse con su término oficial de AWS).

**Pregunta Original:**
${question}

**Opciones Originales:**
${JSON.stringify(options)}

Devuelve el resultado en formato JSON estructurado siguiendo este esquema exacto:
{
  "translated_question": "pregunta traducida al español comercial y técnico",
  "translated_options": [
    { "key": "A", "text": "opcion A traducida" },
    ...
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translated_question: { type: Type.STRING, description: "La pregunta traducida de forma fluida y profesional." },
            translated_options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  text: { type: Type.STRING }
                },
                required: ["key", "text"]
              }
            }
          },
          required: ["translated_question", "translated_options"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("Error in translation api:", error);
    res.status(500).json({ error: "Error al traducir la pregunta: " + error.message });
  }
});

// 3. API: Dynamic SAA-C03 Question Generator by Topic (Great for bootstrapping with 0 questions)
app.post("/api/generate-question", async (req, res) => {
  try {
    const { topic, language } = req.body;
    const resolvedTopic = topic || "S3 Storage Classes & Lifecycle Policies";
    const resolvedLang = language || "mix"; // default mix bilingual

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: "Servicio de generación por IA no disponible." });
    }

    let langInstruction = "";
    if (resolvedLang === "es") {
      langInstruction = "La pregunta, opciones y explicación deben estar en Español.";
    } else if (resolvedLang === "en") {
      langInstruction = "La pregunta, opciones y explicación deben estar en Inglés.";
    } else {
      langInstruction = "La pregunta y las opciones deben proporcionarse en un estilo 'Mix / Bilingüe', de ser posible redactada primero en Inglés y luego su traducción al Español abajo entre corchetes o indicando '[Tradución al Español]' para facilitar el estudio dual.";
    }

    const promptText = `Genera una pregunta realista, de opción múltiple, con el nivel de rigor real del examen oficial AWS Certified Solutions Architect - Associate (SAA-C03).
El tema de la pregunta debe ser: "${resolvedTopic}".

Requisitos de la pregunta:
- Debe representar un caso de uso empresarial real (escenario real de arquitectura).
- Debe incluir requerimientos específicos como: coste mínimo, tolerancia a fallos, menor complejidad administrativa, excelente rendimiento o alta disponibilidad.
- Debe incluir 4 o 5 opciones de respuesta bien diseñadas, donde solo una sea la correcta (o dos si es multiple_choice).
- Evita distractores obvios; las respuestas falsas deben sonar plausibles, pero violar alguna restricción del enunciado (e.g., coste elevado, más mantenimiento manual).
- ${langInstruction}

Devuelve el resultado en formato JSON estructurado siguiendo este esquema exacto:
{
  "question_number": 1,
  "is_multiple_choice": false,
  "question": "Texto de la pregunta...",
  "options": [
    { "key": "A", "text": "Texto opcion A..." },
    { "key": "B", "text": "Texto opcion B..." },
    { "key": "C", "text": "Texto opcion C..." },
    { "key": "D", "text": "Texto opcion D..." }
  ],
  "correct_answers": ["C"],
  "explanation": "Detalle breve de por qué la respuesta C es correcta y las demás incorrectas en el idioma seleccionado."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question_number: { type: Type.INTEGER },
            is_multiple_choice: { type: Type.BOOLEAN },
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  text: { type: Type.STRING }
                },
                required: ["key", "text"]
              }
            },
            correct_answers: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            explanation: { type: Type.STRING }
          },
          required: ["question_number", "is_multiple_choice", "question", "options", "correct_answers", "explanation"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("Error in question generation:", error);
    res.status(500).json({ error: "Error al generar pregunta: " + error.message });
  }
});

// Configure Vite middleware or serve static site
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Express dev server with Vite streaming middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving production static assets from dist/ folder...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AWS Study Server running successfully at http://localhost:${PORT}`);
  });
}

startServer();
