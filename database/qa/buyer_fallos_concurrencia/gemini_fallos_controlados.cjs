// Unica sustitucion funcional: Models.generateContent. El clasificador y SDK restantes son reales.
const { performance } = require('node:perf_hooks');
function install(backendRequire, prefix) {
  const sdk = backendRequire('@google/genai');
  const Original = sdk.GoogleGenAI;
  const plans = new Map(), calls = [];
  sdk.GoogleGenAI = class extends Original {
    constructor(options) {
      super({ ...options, apiKey: 'QA_NO_KEY' });
      this.models.generateContent = async request => {
        const prompt = String(request.contents || '');
        if (!prompt.includes(prefix)) throw Error('QA_CLASSIFICATION_OUTSIDE_PREFIX');
        const entry = [...plans].find(([message]) => prompt.includes(message));
        if (!entry) throw Error('QA_NO_PLAN_FOR_MESSAGE');
        const [message, plan] = entry;
        const call = { message, mode: plan.mode, status: plan.status, response: plan.response,
          model: request.model, startedUtc: new Date().toISOString(), startedMs: performance.now(),
          promptContainsCatalog: prompt.includes('Catálogo de servicios disponibles:') };
        calls.push(call);
        try {
          if (plan.delayMs) await new Promise((resolve, reject) => {
            const signal = request.config?.abortSignal;
            const aborted = () => { clearTimeout(timer); const e = Error('QA_ABORTED'); e.name = 'AbortError'; reject(e); };
            const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve(); }, plan.delayMs);
            if (signal?.aborted) aborted(); else signal?.addEventListener('abort', aborted, { once: true });
          });
          if (plan.mode === 'FAIL') {
            const error = Error('QA_GEMINI_503'); error.status = plan.status; call.error = { message: error.message, status: error.status }; throw error;
          }
          return { text: JSON.stringify(plan.response) };
        } finally { call.finishedMs = performance.now(); call.finishedUtc = new Date().toISOString(); }
      };
    }
  };
  return { calls, fail: message => plans.set(message, { mode: 'FAIL', status: 503 }),
    respond: (message, response, delayMs = 0) => plans.set(message, { mode: 'SUCCESS', response, delayMs }),
    restore: () => { sdk.GoogleGenAI = Original; } };
}
module.exports = { install };
