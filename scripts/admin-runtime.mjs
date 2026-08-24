import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAX_REQUEST_ATTEMPTS = 3;

export async function loadAdminDotEnv(root) {
    try {
        const text = await fs.readFile(path.join(root, '.env'), 'utf8');
        text.split(/\r?\n/).forEach((line) => {
            const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
            if (!match || match[1].startsWith('#') || process.env[match[1]]) return;
            process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        });
    } catch {
        // .env is optional. CI and production should pass real environment variables.
    }
}

export function parseAdminArguments(values) {
    const command = values[0] || 'help';
    const commandArgs = values.slice(1);
    const argv = new Set(commandArgs);
    const confirmPublish = argv.has('--confirm-publish');
    const shouldPrune = command === 'publish' || argv.has('--prune');
    const validateOnly = command === 'audit'
        || (command === 'publish' && !confirmPublish)
        || argv.has('--validate-only');
    const dryRun = argv.has('--dry-run');
    const confirmPrune = argv.has('--confirm-prune');
    const concurrencyArg = commandArgs.find((value) => value.startsWith('--concurrency='));
    const uploadConcurrency = Math.min(8, Math.max(1, Number(concurrencyArg?.split('=')[1]) || 3));
    return {
        argv,
        command,
        commandArgs,
        confirmPrune,
        confirmPublish,
        dryRun,
        shouldPrune,
        uploadConcurrency,
        validateOnly
    };
}

export function printAdminUsage() {
    console.log(`Usage:
  node scripts/admin.mjs upload [--dry-run|--validate-only] [--concurrency=3] [--prune --confirm-prune]
  node scripts/admin.mjs audit [--json]
  node scripts/admin.mjs publish [--json]
  node scripts/admin.mjs publish --confirm-publish
  node scripts/admin.mjs rollback --snapshot TIMESTAMP --confirm-rollback
  node scripts/admin.mjs invites generate --count N [--expires-days N] [--access-level normal|admin] [--note TEXT]
  node scripts/admin.mjs invites list
  node scripts/admin.mjs invites check --code CODE
  node scripts/admin.mjs sessions overview
  node scripts/admin.mjs sessions list
  node scripts/admin.mjs sessions revoke --id UUID --confirm-revoke
  node scripts/admin.mjs sessions revoke-all --confirm-revoke-all
  node scripts/admin.mjs attempts cleanup --confirm-cleanup

The local audit command does not need credentials. Other commands use
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Invite generation and single-code
checks also require INVITE_CODE_PEPPER. .env is loaded locally when present and
is never uploaded or logged.`);
}

export function createAdminRequest({ url, serviceRoleKey, fetchImpl = fetch, wait } = {}) {
    const baseUrl = String(url || '').replace(/\/$/, '');
    const authHeaders = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
    };
    const pause = wait || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

    return async (endpoint, options = {}) => {
        const { responseType = 'json', ...fetchOptions } = options;
        let lastError;
        for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
            try {
                const response = await fetchImpl(`${baseUrl}${endpoint}`, {
                    ...fetchOptions,
                    headers: { ...authHeaders, ...(fetchOptions.headers || {}) }
                });
                if (!response.ok) {
                    const retryable = response.status === 408
                        || response.status === 429
                        || response.status >= 500;
                    const failure = new Error(
                        `${fetchOptions.method || 'GET'} request failed (HTTP ${response.status}).`
                    );
                    failure.retryable = retryable;
                    if (!retryable || attempt === MAX_REQUEST_ATTEMPTS) {
                        throw failure;
                    }
                    lastError = failure;
                } else {
                    if (response.status === 204) return null;
                    if (responseType === 'buffer') return Buffer.from(await response.arrayBuffer());
                    const text = await response.text();
                    return text ? JSON.parse(text) : null;
                }
            } catch (error) {
                lastError = error;
                if (error?.retryable === false || attempt === MAX_REQUEST_ATTEMPTS) break;
            }
            await pause(250 * 2 ** (attempt - 1));
        }
        throw lastError || new Error('Network request failed.');
    };
}
