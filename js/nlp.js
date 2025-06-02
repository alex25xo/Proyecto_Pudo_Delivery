// js/nlp.js
const MODEL      = 'gpt-4o-mini';
const OPENAI_KEY = 'TU_API_KEY_DEL_AGENTE_OPENAI';   // ← pon tu clave

export async function parseAddresses(text){
  const prompt = `
Eres un asistente. Extrae una dirección ORIGEN y hasta 10 DESTINOS
dentro de la ciudad de Puno (Perú) a partir de la frase.
Devuelve SOLO un JSON con la forma:
{
  "origin":"string",
  "destinations":["string", ...]
}
Frase: """${text}"""`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+OPENAI_KEY
    },
    body:JSON.stringify({
      model:MODEL,
      temperature:0,
      max_tokens:150,
      messages:[{role:'user',content:prompt}]
    })
  });
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}
