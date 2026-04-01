import WebSocket from 'ws';
import * as dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.log("NO API KEY");
  process.exit(1);
}

const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;
// const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

const ws = new WebSocket(url);
ws.on('open', () => {
    console.log("WebSocket OPEN");
    const setupMsg = {
        setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: "Kore"
                        }
                    }
                }
            },
            systemInstruction: {
                parts: [{ text: "Hello, testing." }]
            }
        }
    };
    ws.send(JSON.stringify(setupMsg));
});

ws.on('message', (data) => {
    console.log("MESSAGE:", Buffer.isBuffer(data) ? data.toString() : data);
});

ws.on('error', (err) => {
    console.error("ERROR:", err);
});

ws.on('close', (code, reason) => {
    console.log("CLOSE:", code, reason.toString());
});
