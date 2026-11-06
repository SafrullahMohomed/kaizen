#!/usr/bin/env node
// Validates everything under content/. Run: node tools/validate.mjs
// Exit code 1 on errors. Warnings do not fail the run.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const errors = [];
const warnings = [];
const read = (p) => {
  try { return JSON.parse(readFileSync(join(root, p), 'utf8')); }
  catch (e) { errors.push(`${p}: ${e.message}`); return null; }
};
const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const index = read('index.json');
if (!index) { console.error(errors.join('\n')); process.exit(1); }
const topicIds = new Set(index.topics.map((t) => t.id));
const focusIds = new Set(Object.keys(index.focus || {}));
const ideaIds = new Map();
const sourceIds = new Set();
let ideaCount = 0;

for (const p of index.packs) {
  const pack = read(p.file);
  if (!pack) continue;
  if (pack.id !== p.id) errors.push(`${p.file}: pack id "${pack.id}" does not match index "${p.id}"`);
  if (!topicIds.has(pack.id)) errors.push(`${p.file}: pack id "${pack.id}" is not a topic in index.json`);
  if (!DATE.test(pack.added || '')) errors.push(`${p.file}: pack.added must be YYYY-MM-DD`);
  for (const s of pack.sources || []) {
    const where = `${p.file} › ${s.id}`;
    for (const k of ['id', 'title', 'author', 'type', 'focus', 'intro']) if (!s[k]) errors.push(`${where}: missing source.${k}`);
    if (!ID.test(s.id || '')) errors.push(`${where}: source id must be kebab-case`);
    if (sourceIds.has(s.id)) errors.push(`${where}: duplicate source id`);
    sourceIds.add(s.id);
    if (s.focus && !focusIds.has(s.focus)) errors.push(`${where}: focus "${s.focus}" is not listed in index.json focus`);
    if (s.added && !DATE.test(s.added)) errors.push(`${where}: added must be YYYY-MM-DD`);
    if (!s.ideas?.length) errors.push(`${where}: has no ideas`);
    for (const i of s.ideas || []) {
      ideaCount++;
      const w = `${where} › ${i.id}`;
      for (const k of ['id', 'title', 'body', 'action', 'q', 'a']) if (!i[k]) errors.push(`${w}: missing ${k}`);
      if (!ID.test(i.id || '')) errors.push(`${w}: idea id must be kebab-case`);
      if (ideaIds.has(i.id)) errors.push(`${w}: duplicate idea id (also in ${ideaIds.get(i.id)})`);
      ideaIds.set(i.id, s.id);
      if (i.added && !DATE.test(i.added)) errors.push(`${w}: added must be YYYY-MM-DD`);
      if (i.focus && !focusIds.has(i.focus)) errors.push(`${w}: focus "${i.focus}" not in index.json`);
      const bw = words(i.body);
      if (bw > 120) warnings.push(`${w}: body is ${bw} words (aim for 50–100)`);
      if (bw < 25) warnings.push(`${w}: body is only ${bw} words`);
      if (words(i.title) > 9) warnings.push(`${w}: title is long (${words(i.title)} words)`);
      if (/"/.test(i.body)) warnings.push(`${w}: body contains straight double quotes; prefer “ ”`);
    }
  }
}

const j = read(index.journeys);
const journeyIds = new Set();
for (const jr of j?.journeys || []) {
  const w = `journeys › ${jr.id}`;
  for (const k of ['id', 'title', 'topic', 'blurb', 'ideas']) if (!jr[k]) errors.push(`${w}: missing ${k}`);
  if (journeyIds.has(jr.id)) errors.push(`${w}: duplicate journey id`);
  journeyIds.add(jr.id);
  if (!topicIds.has(jr.topic)) errors.push(`${w}: unknown topic ${jr.topic}`);
  for (const id of jr.ideas || []) if (!ideaIds.has(id)) errors.push(`${w}: idea "${id}" does not exist`);
  if (new Set(jr.ideas).size !== jr.ideas.length) errors.push(`${w}: repeats an idea`);
}

for (const x of warnings) console.warn('warn  ' + x);
for (const x of errors) console.error('error ' + x);
console.log(`\n${index.packs.length} packs · ${sourceIds.size} sources · ${ideaCount} ideas · ${journeyIds.size} journeys · contentVersion ${index.contentVersion}`);
console.log(errors.length ? `✗ ${errors.length} error(s)` : '✓ content is valid');
process.exit(errors.length ? 1 : 0);
