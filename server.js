// Local dev server for TypeAloud. Serves the static app AND a small
// /api/generate-lesson endpoint that calls an AI API to generate on-the-fly
// curriculum content. This is deliberately NOT part of the static site —
// GitHub Pages has no backend, so the server-backed AI Lesson Lab only
// appears when this server is what's serving the page (it checks
// GET /api/health first). The static site gets its own, smaller,
// fully-in-browser model instead — see ai-local-browser.js.
//
// Three tiers, picked in this order, no setup required for the first one
// to just work:
//   1. Local, open-source, in-process — the default. Runs a small ONNX
//      model (see LOCAL_MODEL_ID below) via @huggingface/transformers,
//      no external daemon, no account, no API key. This is what "ships
//      with it" — the first request after startup downloads the model
//      once (cached under .cache/models/) and every request after that
//      runs fully offline.
//   2. ANTHROPIC_API_KEY=sk-ant-... node server.js — bigger, hosted, paid.
//   3. OPENAI_API_KEY=sk-...      node server.js — same, alternate provider.
//
// Set LOCAL_MODEL_ID to swap the local model; LOCAL_MODEL_CACHE_DIR to
// change where weights are cached (defaults to ./.cache/models, gitignored).
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 8935;
const ROOT = __dirname;

// A real, small, open-source instruct model. 1.5B rather than the smallest
// 0.5B size — noticeably more reliable at instruction-following (observed:
// 0.5B occasionally mangled structured JSON output) while still running
// fine on a laptop CPU with no GPU. 4-bit quantized (~1 GB) so the one-time
// download stays reasonable. This is the "ships with it" default — no
// account, no key. Swap via LOCAL_MODEL_ID for a different size trade-off.
const LOCAL_MODEL_ID = process.env.LOCAL_MODEL_ID || 'onnx-community/Qwen2.5-1.5B-Instruct';
const LOCAL_MODEL_DTYPE = process.env.LOCAL_MODEL_DTYPE || 'q4';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml'
};

function serveStatic(req, res) {
  let reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, reqPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    // No caching — this is a local dev server for an app still being
    // actively edited; a stale cached app.js in the browser is confusing
    // and looks exactly like a fix "not working" when it already shipped.
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(data);
  });
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { req.destroy(); resolve({}); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function callAnthropic(prompt) {
  return new Promise((resolve, reject) => {
    const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
    const body = JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] });
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-length': Buffer.byteLength(body)
      }
    }, (resp) => {
      let data = '';
      resp.on('data', (c) => { data += c; });
      resp.on('end', () => {
        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve((parsed.content && parsed.content[0] && parsed.content[0].text) || '');
          } catch (e) { reject(e); }
        } else {
          reject(new Error(`Anthropic API ${resp.statusCode}: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const body = JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 1024 });
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-length': Buffer.byteLength(body)
      }
    }, (resp) => {
      let data = '';
      resp.on('data', (c) => { data += c; });
      resp.on('end', () => {
        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve((parsed.choices && parsed.choices[0] && parsed.choices[0].message.content) || '');
          } catch (e) { reject(e); }
        } else {
          reject(new Error(`OpenAI API ${resp.statusCode}: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Lazily loaded and cached across requests — loading the model is the slow
// part (one-time download + weight init), running it per-request is fast.
let localGeneratorPromise = null;
function getLocalGenerator() {
  if (!localGeneratorPromise) {
    localGeneratorPromise = (async () => {
      const { pipeline, env } = require('@huggingface/transformers');
      env.cacheDir = process.env.LOCAL_MODEL_CACHE_DIR || path.join(ROOT, '.cache', 'models');
      console.log(`Loading local model ${LOCAL_MODEL_ID} (first run downloads it, then it's cached)...`);
      const generator = await pipeline('text-generation', LOCAL_MODEL_ID, { dtype: LOCAL_MODEL_DTYPE });
      console.log('Local model ready.');
      return generator;
    })();
  }
  return localGeneratorPromise;
}

async function callLocal(prompt) {
  const generator = await getLocalGenerator();
  const output = await generator([{ role: 'user', content: prompt }], {
    max_new_tokens: 800,
    do_sample: false,
    return_full_text: false
  });
  const turn = output[0].generated_text;
  // With a chat template, generated_text is the message array; take the
  // final (assistant) turn's content. Some model/pipeline combos instead
  // return a plain string directly — handle both.
  if (typeof turn === 'string') return turn;
  const last = Array.isArray(turn) ? turn[turn.length - 1] : turn;
  return (last && last.content) || '';
}

// Two separate, simple prompts (one per kind) instead of one prompt asking
// for both mixed together. Small local models are reliable at "N words" or
// "N sentences" alone but degrade badly when asked to interleave both
// formats in one structured response (observed: a 0.5B model, asked to mix,
// exploded a sentence into one array entry per word). The natural mix the
// user sees comes from merging two clean generations, not from the model
// juggling two formats in its head at once — same end result, far more
// reliable, and it degrades gracefully (Anthropic/OpenAI handle the mixed
// prompt fine, but this keeps one code path for every provider).
function buildPrompt({ theme, allowedLetters, count, kind }) {
  const letterNote = allowedLetters && allowedLetters.length
    ? ` Only use these letters (plus spaces${kind === 'sentences' ? ', and . ! ?' : ''}) in every item: ${allowedLetters.join(' ')}. Do not use any other letter.`
    : '';
  const spec = kind === 'sentences'
    ? 'short, grammatically correct, real English sentences (each ending in . ! or ?)'
    : 'real, whole, common English words (no invented words, no gibberish, no abbreviations, no proper nouns)';
  return `Generate exactly ${count} ${spec} for a touch-typing practice lesson themed "${theme}".` + letterNote +
    ' Respond with ONLY a JSON array of strings, nothing else — no markdown fences, no explanation, no extra text.';
}

async function callProvider(provider, prompt) {
  return provider === 'anthropic' ? callAnthropic(prompt)
    : provider === 'openai' ? callOpenAI(prompt)
    : callLocal(prompt);
}

function extractItems(text, allowedLetters) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('AI response did not contain a JSON array');
  let items = JSON.parse(match[0]);
  items = items.filter((w) => typeof w === 'string' && w.trim().length > 0).map((w) => w.trim());
  if (allowedLetters && allowedLetters.length) {
    // Sentences carry their own punctuation ( . ! ? ' ) regardless of the
    // letter restriction — that restriction is about the *letters* used,
    // not whether an item is allowed to be a sentence at all.
    const allowedSet = new Set(allowedLetters.map((c) => c.toLowerCase()).concat([' ', '.', '!', '?', "'"]));
    items = items.filter((w) => [...w.toLowerCase()].every((ch) => !/[a-z]/.test(ch) || allowedSet.has(ch)));
  }
  return items;
}

// Fisher-Yates — a real shuffle, not Array.sort(() => Math.random() - 0.5)
// (which is neither uniform nor guaranteed stable across engines).
function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function handleGenerateLesson(req, res) {
  const body = await readJsonBody(req);
  const theme = String(body.theme || 'general practice').slice(0, 80);
  const count = Math.min(Math.max(Number(body.count) || 16, 5), 30);
  const allowedLetters = Array.isArray(body.allowedLetters)
    ? body.allowedLetters.filter((c) => typeof c === 'string' && c.length === 1)
    : null;

  const provider = activeProvider();
  const wordCount = Math.max(1, Math.round(count * 0.6));
  const sentenceCount = Math.max(1, count - wordCount);

  try {
    const [wordText, sentenceText] = await Promise.all([
      callProvider(provider, buildPrompt({ theme, allowedLetters, count: wordCount, kind: 'words' })),
      callProvider(provider, buildPrompt({ theme, allowedLetters, count: sentenceCount, kind: 'sentences' }))
    ]);
    const wordItems = extractItems(wordText, allowedLetters);
    // A sentence generation can legitimately come back empty after letter
    // filtering (tight letter restrictions rarely survive in a sentence) —
    // that's fine, the lesson just leans more word-heavy that time.
    let sentenceItems = [];
    try { sentenceItems = extractItems(sentenceText, allowedLetters); } catch (e) { /* words alone are enough */ }
    const words = shuffle(wordItems.concat(sentenceItems));
    if (words.length === 0) throw new Error('AI returned no usable words after filtering for the allowed letters');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ theme, words }));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String((err && err.message) || err) }));
  }
}

// Anthropic/OpenAI are bigger and hosted, so use one if a key is given;
// otherwise fall back to the local model that ships with the app — no
// setup, no key, works offline. aiAvailable is therefore always true once
// this server is running; the "local" provider never needs configuring.
function activeProvider() {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'local';
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, aiAvailable: true, provider: activeProvider() }));
    return;
  }
  if (u.pathname === '/api/generate-lesson' && req.method === 'POST') {
    await handleGenerateLesson(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  const provider = activeProvider();
  console.log(`TypeAloud running at http://localhost:${PORT}`);
  console.log(provider === 'local'
    ? `AI Lesson Lab: enabled, local model (${LOCAL_MODEL_ID}) — first generation downloads it once, then runs offline.`
    : `AI Lesson Lab: enabled, ${provider} (set ANTHROPIC_API_KEY/OPENAI_API_KEY to change which provider is used).`);
});
