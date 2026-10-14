import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

// Initialize Gemini client using current @google/genai SDK
let ai = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({});
  } catch (err) {
    console.warn('Could not initialize GoogleGenAI client:', err);
  }
}

// Dynamic superhero / citizen reaction & radio dispatch API
app.post('/api/dialogue', async (req, res) => {
  try {
    const { missionTitle, zone, heroAction } = req.body || {};

    if (!ai || !process.env.GEMINI_API_KEY) {
      return res.json({
        success: true,
        source: 'local-fallback',
        dialogue: '¡Es Superman! ¡Bogotá está a salvo contigo!',
      });
    }

    const prompt = `Eres el sistema narrativo inmersivo de un juego 3D de Superman en Bogotá, Colombia.
Genera una única frase corta (máximo 10 palabras), expresiva y enérgica de un ciudadano o de la radio policial de Bogotá.
Contexto:
- Misión: ${missionTitle || 'Patrulla de emergencia'}
- Zona: ${zone || 'La Candelaria'}
- Héroe: ${heroAction || 'Volando sobre la ciudad'}

Estilo: Cálido, colombiano/bogotano respetuoso (ejemplos: "¡Miren a Monserrate, es Superman!", "¡Nos salvaste en la Caracas!", "¡La Torre Colpatria está protegida!").
Devuelve ÚNICAMENTE la frase de texto, sin comillas, sin formato markdown ni explicaciones adicionales.`;

    const response = await ai.interactions.create({
      model: 'gemini-3.8-flash',
      input: prompt,
    });

    const text = response.output_text?.trim() || '¡Bogotá está protegida por el Hombre de Acero!';
    res.json({ success: true, source: 'gemini-3.8-flash', dialogue: text });
  } catch (error) {
    console.error('Gemini dialogue generation error:', error);
    res.json({
      success: true,
      source: 'error-fallback',
      dialogue: '¡El Hombre de Acero vigila la ciudad!',
    });
  }
});

// Health check endpoint for Google AI Studio container diagnostics
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'Bogotá 3D: Guardián de Bogotá',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Serve frontend build artifacts in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bogotá 3D] Game Server listening on http://0.0.0.0:${PORT}`);
});
