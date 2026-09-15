// Local dev server for TypeAloud. Serves the static app AND a small
// /api/generate-lesson endpoint that calls an AI API to generate on-the-fly
// curriculum content. This is deliberately NOT part of the static site —
// GitHub Pages has no backend, so the AI Lesson Lab only appears when this
// server is what's serving the page (it checks GET /api/health first).
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node server.js
//   OPENAI_API_KEY=sk-... node server.js
//   (no key set: static app still works, AI Lesson Lab just stays hidden)
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 8935;
const ROOT = __dirname;

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

function buildPrompt({ theme, allowedLetters, count, sentence }) {
  const letterNote = allowedLetters && allowedLetters.length
    ? ` Only use these letters (plus spaces) in every item: ${allowedLetters.join(' ')}. Do not use any other letter.`
    : '';
  const kind = sentence
    ? 'short, grammatically correct, real English sentences (each ending in . ! or ?)'
    : 'real, whole, common English words (no invented words, no gibberish, no abbreviations, no proper nouns)';
  return `Generate exactly ${count} ${kind} for a touch-typing practice lesson themed "${theme}".` + letterNote +
    ' Respond with ONLY a JSON array of strings, nothing else — no markdown fences, no explanation, no extra text.';
}

async function handleGenerateLesson(req, res) {
  const body = await readJsonBody(req);
  const theme = String(body.theme || 'general practice').slice(0, 80);
  const count = Math.min(Math.max(Number(body.count) || 16, 5), 30);
  const allowedLetters = Array.isArray(body.allowedLetters)
    ? body.allowedLetters.filter((c) => typeof c === 'string' && c.length === 1)
    : null;
  const sentence = !!body.sentence;

  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  if (!hasAnthropic && !hasOpenAI) {
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in the environment running this server, then restart it.' }));
    return;
  }

  try {
    const prompt = buildPrompt({ theme, allowedLetters, count, sentence });
    const text = hasAnthropic ? await callAnthropic(prompt) : await callOpenAI(prompt);
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI response did not contain a JSON array');
    let words = JSON.parse(match[0]);
    words = words.filter((w) => typeof w === 'string' && w.trim().length > 0).map((w) => w.trim());
    if (allowedLetters && !sentence) {
      const allowedSet = new Set(allowedLetters.map((c) => c.toLowerCase()).concat(' '));
      words = words.filter((w) => [...w.toLowerCase()].every((ch) => !/[a-z]/.test(ch) || allowedSet.has(ch)));
    }
    if (words.length === 0) throw new Error('AI returned no usable words after filtering for the allowed letters');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ theme, words }));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String((err && err.message) || err) }));
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, aiAvailable: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) }));
    return;
  }
  if (u.pathname === '/api/generate-lesson' && req.method === 'POST') {
    await handleGenerateLesson(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  const aiOn = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  console.log(`TypeAloud running at http://localhost:${PORT}`);
  console.log(`AI Lesson Lab: ${aiOn ? 'enabled' : 'disabled — set ANTHROPIC_API_KEY or OPENAI_API_KEY to enable'}`);
});
