#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

async function loadDotEnv() {
    try {
        const text = await readFile('.env', 'utf8');
        text.split(/\r?\n/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
            if (!match || process.env[match[1]]) return;
            process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        });
    } catch (error) {
        // .env is optional; real environment variables work too.
    }
}

function parseArgs(argv) {
    const args = { count: 0, expiresDays: null, note: '' };
    for (let index = 2; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];
        if (arg === '--count') {
            args.count = Number(next);
            index += 1;
        } else if (arg === '--expires-days') {
            args.expiresDays = Number(next);
            index += 1;
        } else if (arg === '--note') {
            args.note = String(next || '');
            index += 1;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    if (!Number.isInteger(args.count) || args.count <= 0) {
        throw new Error('--count must be a positive integer.');
    }
    if (args.expiresDays !== null && (!Number.isFinite(args.expiresDays) || args.expiresDays <= 0)) {
        throw new Error('--expires-days must be a positive number.');
    }
    return args;
}

function makeCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(12);
    let text = '';
    for (const byte of bytes) text += alphabet[byte % alphabet.length];
    return `CR-${text.slice(0, 4)}-${text.slice(4, 8)}-${text.slice(8, 12)}`;
}

function hashCode(pepper, code) {
    const normalized = code.trim().toUpperCase().replace(/\s+/g, '');
    return createHash('sha256').update(`${pepper}:${normalized}`, 'utf8').digest('hex');
}

await loadDotEnv();

let args;
try {
    args = parseArgs(process.argv);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pepper = process.env.INVITE_CODE_PEPPER;

if (!url || !serviceRoleKey || !pepper) {
    console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or INVITE_CODE_PEPPER.');
    process.exit(1);
}

const expiresAt = args.expiresDays
    ? new Date(Date.now() + args.expiresDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
const codes = Array.from({ length: args.count }, makeCode);
const rows = codes.map((code) => ({
    code_hash: hashCode(pepper, code),
    expires_at: expiresAt,
    note: args.note || null,
    used: false
}));

const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const { error } = await supabase.from('invite_codes').insert(rows);
if (error) {
    console.error(`Invite code upload failed: ${error.message}`);
    process.exit(1);
}

console.log(`Generated invite codes: ${codes.length}`);
console.log(`Expires at: ${expiresAt || 'never'}`);
console.log('Upload: success');
codes.forEach((code) => console.log(code));
