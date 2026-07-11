#!/usr/bin/env node
// Unit tests for the canonical model registry. Run: node --test test/models.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_REGISTRY, MODEL_KEYS, modelByEntityId } from '../scripts/lib/models.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entities = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'entities.json'), 'utf-8'));

test('MODEL_REGISTRY has a complete, well-formed entry for every tracked model', () => {
  assert.equal(MODEL_KEYS.length, 7);
  for (const key of MODEL_KEYS) {
    const m = MODEL_REGISTRY[key];
    assert.equal(m.key, key);
    for (const field of ['name', 'brand', 'org', 'version', 'versionLabel', 'hnQuery', 'entityId']) {
      assert.ok(typeof m[field] === 'string' && m[field].length > 0, `${key}.${field} missing`);
    }
  }
});

test('entities.json (Ocean Map) version strings match the canonical registry — no drift', () => {
  // This is the exact bug the registry fixes: "Gemini 3.1" (entities.json) vs
  // "Gemini 3.5 Pro" (leaderboard), "Grok 4" vs "Grok 4.5". Every frontier
  // model node's `version` must equal MODEL_REGISTRY[id].version.
  const nodesById = Object.fromEntries(entities.nodes.map((n) => [n.id, n]));
  for (const key of MODEL_KEYS) {
    const entity = nodesById[key];
    assert.ok(entity, `entities.json has no node for registry key "${key}"`);
    assert.equal(entity.version, MODEL_REGISTRY[key].version, `entities.json "${key}" version drifted from the canonical registry`);
    assert.equal(entity.name, MODEL_REGISTRY[key].name);
  }
});

test('modelByEntityId resolves a known entity id and rejects an unknown one', () => {
  assert.equal(modelByEntityId('claude').key, 'claude');
  assert.equal(modelByEntityId('gpt').org, 'OpenAI');
  assert.equal(modelByEntityId('not-a-real-model'), null);
});
