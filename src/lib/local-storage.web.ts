// Browsers provide localStorage natively. During server rendering (web output is "server")
// there is no localStorage, so install a throwaway in-memory one for that pass only.
if (typeof globalThis.localStorage === 'undefined') {
  const memory = new Map<string, string>();
  const shim: Storage = {
    get length() { return memory.size; },
    clear: () => memory.clear(),
    getItem: (key) => memory.get(key) ?? null,
    key: (index) => Array.from(memory.keys())[index] ?? null,
    removeItem: (key) => { memory.delete(key); },
    setItem: (key, value) => { memory.set(key, String(value)); },
  };
  globalThis.localStorage = shim;
}

export {};
