// Unica sustitucion funcional: respuesta de Models.generateContent en memoria.
// Se conservan el constructor SDK real, el clasificador, su prompt/JSON/validacion y el evaluador.
function installGeminiResponse(backendRequire, prefix) {
  const sdk = backendRequire('@google/genai');
  const Original = sdk.GoogleGenAI;
  const responses = new Map();
  const calls = [];
  let constructors = 0;
  sdk.GoogleGenAI = class QaGoogleGenAI extends Original {
    constructor(options) {
      super({ ...options, apiKey: 'QA_NO_KEY' });
      constructors++;
      this.models.generateContent = async request => {
        const prompt = String(request.contents || '');
        if (!prompt.includes(prefix)) throw Error('QA_CLASSIFICATION_OUTSIDE_PREFIX');
        const match = [...responses].find(([message]) => prompt.includes(message));
        if (!match) throw Error('QA_NO_CONTROLLED_RESPONSE_FOR_MESSAGE');
        const [message, result] = match;
        calls.push({ message, response: result, model: request.model, responseMimeType: request.config?.responseMimeType,
          promptContainsCatalog: prompt.includes('Catálogo de servicios disponibles:'), utc: new Date().toISOString() });
        return { text: JSON.stringify(result) };
      };
    }
  };
  return { calls, respond: (message, result) => responses.set(message, result),
    constructors: () => constructors, restore: () => { sdk.GoogleGenAI = Original; } };
}
module.exports = { installGeminiResponse };
