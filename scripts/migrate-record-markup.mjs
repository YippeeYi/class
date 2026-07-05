#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataRoot = path.join(root, 'data');
const checkOnly = process.argv.includes('--check');
const typedBinary = new Set(['person', 'term', 'record', 'frac', 'anno', 'illu', 'arrow']);
const typedUnary = new Set(['del', 'under', 'red', 'hide', 'sup', 'sub', 'center', 'right']);

function isEscaped(source, index) {
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) slashCount += 1;
    return slashCount % 2 === 1;
}

function findBalancedSquareEnd(source, start) {
    let depth = 1;
    for (let index = start + 2; index < source.length - 1; index += 1) {
        if (!isEscaped(source, index) && source.startsWith('[[', index)) {
            depth += 1;
            index += 1;
        } else if (!isEscaped(source, index) && source.startsWith(']]', index)) {
            depth -= 1;
            if (depth === 0) return index + 2;
            index += 1;
        }
    }
    return -1;
}

function findTopLevelSeparator(source, separator = '|') {
    let squareDepth = 0;
    let curlyDepth = 0;
    for (let index = 0; index <= source.length - separator.length; index += 1) {
        if (isEscaped(source, index)) continue;
        if (source.startsWith('[[', index)) {
            squareDepth += 1;
            index += 1;
        } else if (source.startsWith(']]', index) && squareDepth > 0) {
            squareDepth -= 1;
            index += 1;
        } else if (source.startsWith('{{', index)) {
            curlyDepth += 1;
            index += 1;
        } else if (source.startsWith('}}', index) && curlyDepth > 0) {
            curlyDepth -= 1;
            index += 1;
        } else if (squareDepth === 0 && curlyDepth === 0 && source.startsWith(separator, index)) {
            return index;
        }
    }
    return -1;
}

function splitTopLevelOnce(source, separator = '|') {
    const index = findTopLevelSeparator(source, separator);
    return index < 0 ? null : [source.slice(0, index), source.slice(index + separator.length)];
}

function migrateSquare(body, raw) {
    const colon = body.indexOf(':');
    const type = colon > 0 ? body.slice(0, colon) : '';
    if (typedUnary.has(type)) {
        const content = body.slice(colon + 1);
        return content ? `[[${type}:${migrateMarkup(content)}]]` : raw;
    }
    if (typedBinary.has(type)) {
        const parts = splitTopLevelOnce(body.slice(colon + 1));
        if (!parts || !parts[0] || !parts[1]) return raw;
        const first = type === 'illu' ? parts[0].replace(/^data\/attachments\//i, '') : migrateMarkup(parts[0]);
        return `[[${type}:${first}|${migrateMarkup(parts[1])}]]`;
    }
    const person = splitTopLevelOnce(body);
    if (person && /^[a-zA-Z0-9_-]+$/.test(person[0]) && person[1]) {
        return `[[person:${person[0]}|${migrateMarkup(person[1])}]]`;
    }
    return raw;
}

function migrateMarkup(value) {
    const source = String(value ?? '');
    let output = '';
    for (let index = 0; index < source.length;) {
        if (source[index] === '\\' && index + 1 < source.length && '\\|[]'.includes(source[index + 1])) {
            output += source.slice(index, index + 2);
            index += 2;
            continue;
        }
        if (source.startsWith('[[', index)) {
            const end = findBalancedSquareEnd(source, index);
            if (end > 0) {
                const raw = source.slice(index, end);
                output += migrateSquare(raw.slice(2, -2), raw);
                index = end;
                continue;
            }
        }
        if (source.startsWith('->[', index)) {
            const end = source.indexOf(']<-', index + 3);
            if (end >= 0) {
                const parts = splitTopLevelOnce(source.slice(index + 3, end), '||');
                if (parts) {
                    output += `[[arrow:${migrateMarkup(parts[0])}|${migrateMarkup(parts[1])}]]`;
                    index = end + 3;
                    continue;
                }
            }
        }
        const paired = [
            ['{{', '}}', 'term'],
            ['((', '))', 'hide'],
            ['!!', '!!', 'center'],
            ['>>', '<<', 'right'],
            ['^', '^', 'sup'],
            ['_', '_', 'sub']
        ].find(([open]) => source.startsWith(open, index));
        if (paired) {
            const [open, close, type] = paired;
            const end = source.indexOf(close, index + open.length);
            if (end >= 0) {
                const inner = source.slice(index + open.length, end);
                if (type === 'term') {
                    const parts = splitTopLevelOnce(inner);
                    if (parts && /^[a-zA-Z0-9_-]+$/.test(parts[0]) && parts[1]) {
                        output += `[[term:${parts[0]}|${migrateMarkup(parts[1])}]]`;
                        index = end + close.length;
                        continue;
                    }
                } else {
                    output += `[[${type}:${migrateMarkup(inner)}]]`;
                    index = end + close.length;
                    continue;
                }
            }
        }
        output += source[index];
        index += 1;
    }
    return output;
}

function migrateValue(value) {
    if (typeof value === 'string') return migrateMarkup(value);
    if (Array.isArray(value)) return value.map(migrateValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, migrateValue(item)]));
    }
    return value;
}

async function listJsonFiles(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? listJsonFiles(file) : [file];
    }));
    return nested.flat().filter((file) => file.toLowerCase().endsWith('.json'));
}

const changed = [];
for (const file of await listJsonFiles(dataRoot)) {
    const original = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(original);
    const migrated = migrateValue(parsed);
    const next = `${JSON.stringify(migrated, null, 4)}\n`;
    if (next === original.replace(/\r\n/g, '\n')) continue;
    changed.push(path.relative(root, file).replaceAll('\\', '/'));
    if (!checkOnly) await fs.writeFile(file, next, 'utf8');
}

if (checkOnly && changed.length) {
    console.error(`Markup migration required in ${changed.length} JSON file(s).`);
    for (const file of changed) console.error(file);
    process.exitCode = 1;
} else {
    console.log(`${checkOnly ? 'Checked' : 'Migrated'} ${changed.length} JSON file(s).`);
}

export { migrateMarkup };
