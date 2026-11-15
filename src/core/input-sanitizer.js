// Keep ordinary settings useful while excluding opaque internal script payloads.
// A shared budget also prevents nested inputs from producing unbounded output.
export function sanitizeIndicatorInputs(inputs) {
  let remaining = 200;
  const clean = (value, depth = 0) => {
    if (--remaining < 0 || depth > 4) return undefined;
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'string') return value.length <= 500 ? value : undefined;
    if (typeof value !== 'object') return undefined;
    const blocked = (key) => /^(text|pineSource|scriptSource|__proto__|prototype|constructor)$/i.test(key);
    // getInputValues() uses [{id, value}], whereas inputs() uses an object.
    if (typeof value.id === 'string' && (blocked(value.id) || (typeof value.value === 'string' && value.value.length > 500))) return undefined;
    if (Array.isArray(value)) return value.slice(0, remaining).map(v => clean(v, depth + 1)).filter(v => v !== undefined);
    const entries = [];
    for (const [key, item] of Object.entries(value)) {
      if (blocked(key)) continue;
      const safe = clean(item, depth + 1);
      if (safe !== undefined) entries.push([key, safe]);
      if (remaining <= 0) break;
    }
    return Object.fromEntries(entries);
  };
  return clean(inputs) ?? null;
}
