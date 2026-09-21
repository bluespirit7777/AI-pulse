import { readFile } from 'node:fs/promises';
import * as curated from '../../js/curated.js';

// Only reader-facing prose. Identifiers, URLs, prices, dates and proper names
// stay in the source data and are never sent through a translation service.
const prose = new Set(['title','desc','description','h','blurb','why','signal','segment','note','excerpt','bullets','summary','tierLabel','setup','lbl','disclaimer']);
export async function contentStrings() {
  const strings = new Set();
  function walk(value, key='') {
    if (typeof value === 'string') {
      if (prose.has(key) && value.trim()) strings.add(value.trim().replace(/\s+/g,' '));
    } else if (Array.isArray(value)) value.forEach(v=>walk(v,key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k,v])=>walk(v,k));
  }
  for (const name of ['latest','entities','stock-network','youtube-trending','ai-summary']) {
    walk(JSON.parse(await readFile(new URL(`../../data/${name}.json`,import.meta.url),'utf8')));
  }
  walk(curated);
  Object.values(curated.modelReception).forEach(s=>strings.add(s));
  strings.add(curated.LOCAL_AI_SPECS_METHODOLOGY);
  return [...strings];
}
