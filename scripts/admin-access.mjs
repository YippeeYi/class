import { createHash, randomBytes } from 'node:crypto';

export function createAccessAdmin({ request, commandArgs, argv }) {
    const invitePepper = () => {
        const pepper = String(process.env.INVITE_CODE_PEPPER || '');
        if (!pepper) throw new Error('INVITE_CODE_PEPPER is required for invite-code generation and checks.');
        return pepper;
    };

    const normalizeInviteCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
    const hashInviteCode = (code) => createHash('sha256')
        .update(`${invitePepper()}:${normalizeInviteCode(code)}`, 'utf8')
        .digest('hex');

    const createInviteCode = () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const bytes = randomBytes(12);
        let value = '';
        for (const byte of bytes) value += alphabet[byte % alphabet.length];
        return `CR-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
    };

    const readOption = (name, { required = false } = {}) => {
        const index = commandArgs.indexOf(name);
        if (index < 0) {
            if (required) throw new Error(`${name} is required.`);
            return null;
        }
        const value = commandArgs[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
        return value;
    };

    const assertInviteArguments = (allowed) => {
        for (let index = 1; index < commandArgs.length; index += 1) {
            const value = commandArgs[index];
            if (!value.startsWith('--')) continue;
            if (!allowed.has(value)) throw new Error(`Unknown invite option: ${value}`);
            index += 1;
        }
    };

    const assertFlagArguments = (allowed) => {
        for (const value of commandArgs) {
            if (value.startsWith('--') && !allowed.has(value)) throw new Error(`Unknown option: ${value}`);
        }
    };

    const createInvites = async () => {
        assertInviteArguments(new Set(['--count', '--expires-days', '--access-level', '--note']));
        const count = Number(readOption('--count', { required: true }));
        const expiresDays = readOption('--expires-days');
        const accessLevel = String(readOption('--access-level') || 'normal').toLowerCase();
        const note = readOption('--note') || null;
        if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('--count must be an integer between 1 and 500.');
        if (expiresDays !== null && (!Number.isFinite(Number(expiresDays)) || Number(expiresDays) <= 0)) {
            throw new Error('--expires-days must be a positive number.');
        }
        if (!['normal', 'admin'].includes(accessLevel)) throw new Error('--access-level must be normal or admin.');

        const expiresAt = expiresDays ? new Date(Date.now() + Number(expiresDays) * 86400_000).toISOString() : null;
        const codes = Array.from({ length: count }, createInviteCode);
        const rows = codes.map((code) => ({
            code_hash: hashInviteCode(code), expires_at: expiresAt, note, access_level: accessLevel, used: false
        }));
        await request('/rest/v1/invite_codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify(rows)
        });
        console.log(`Generated ${codes.length} one-time invite code(s); expires=${expiresAt || 'never'}; access=${accessLevel}.`);
        console.log('Store the following codes securely. They cannot be recovered from the database later:');
        codes.forEach((code) => console.log(code));
    };

    const loadInviteRows = async () => {
        const select = 'id,used,used_at,expires_at,access_level,note,created_at';
        const rows = [];
        for (let offset = 0; ; offset += 1000) {
            const page = await request(`/rest/v1/invite_codes?select=${encodeURIComponent(select)}&order=created_at.desc&limit=1000&offset=${offset}`);
            rows.push(...(page || []));
            if (!page || page.length < 1000) return rows;
        }
    };

    const inviteState = (row) => {
        if (row.used) return 'used';
        if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return 'expired';
        return 'available';
    };

    const listInvites = async () => {
        assertInviteArguments(new Set());
        const rows = await loadInviteRows();
        const summary = rows.reduce((result, row) => {
            result[inviteState(row)] += 1;
            return result;
        }, { available: 0, used: 0, expired: 0 });
        console.log(`Invite codes: total=${rows.length}, available=${summary.available}, used=${summary.used}, expired=${summary.expired}.`);
        rows.forEach((row) => {
            console.log(JSON.stringify({
                id: row.id, state: inviteState(row), usedAt: row.used_at || null,
                expiresAt: row.expires_at || null, accessLevel: row.access_level, note: row.note || null,
                createdAt: row.created_at || null
            }));
        });
    };

    const checkInvite = async () => {
        assertInviteArguments(new Set(['--code']));
        const code = readOption('--code', { required: true });
        const rows = await request(`/rest/v1/invite_codes?select=${encodeURIComponent('id,used,used_at,expires_at,access_level,note,created_at')}&code_hash=eq.${encodeURIComponent(hashInviteCode(code))}&limit=1`);
        const row = rows?.[0];
        if (!row) {
            console.log('Invite code not found.');
            return;
        }
        console.log(JSON.stringify({
            found: true, state: inviteState(row), usedAt: row.used_at || null,
            expiresAt: row.expires_at || null, accessLevel: row.access_level, note: row.note || null,
            createdAt: row.created_at || null
        }));
    };

    const callRpc = (name, body = {}) => request(`/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const runSessions = async () => {
        const action = commandArgs[0] || '';
        if (action === 'overview') {
            assertFlagArguments(new Set());
            console.log(JSON.stringify(await callRpc('get_invite_access_session_overview'), null, 2));
            return;
        }
        if (action === 'list') {
            assertFlagArguments(new Set());
            const rows = await callRpc('list_invite_access_sessions') || [];
            console.log(`Access sessions: total=${rows.length}.`);
            rows.forEach((row) => console.log(JSON.stringify({
                id: row.id,
                createdAt: row.created_at,
                lastUsedAt: row.last_used_at,
                expiresAt: row.expires_at,
                revokedAt: row.revoked_at,
                accessLevel: row.access_level,
                riskFlags: row.risk_flags,
                riskFlaggedAt: row.risk_flagged_at,
                recentRefreshCount: row.recent_refresh_count
            })));
            return;
        }
        if (action === 'revoke') {
            assertFlagArguments(new Set(['--id', '--confirm-revoke']));
            const id = readOption('--id', { required: true });
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
                throw new Error('--id must be a UUID.');
            }
            if (!argv.has('--confirm-revoke')) throw new Error('Session revoke requires --confirm-revoke. No session was changed.');
            const revoked = await callRpc('revoke_invite_access_session', { target_session_id: id });
            console.log(revoked === true ? `Revoked access session: ${id}.` : `Access session was not found: ${id}.`);
            return;
        }
        if (action === 'revoke-all') {
            assertFlagArguments(new Set(['--confirm-revoke-all']));
            if (!argv.has('--confirm-revoke-all')) throw new Error('Revoke-all requires --confirm-revoke-all. No session was changed.');
            const count = await callRpc('revoke_all_invite_access_sessions');
            console.log(`Revoked all active access sessions: count=${count}.`);
            return;
        }
        throw new Error('Use sessions overview, sessions list, sessions revoke, or sessions revoke-all.');
    };

    const runAttempts = async () => {
        const action = commandArgs[0] || '';
        if (action !== 'cleanup') throw new Error('Use attempts cleanup --confirm-cleanup.');
        assertFlagArguments(new Set(['--confirm-cleanup']));
        if (!argv.has('--confirm-cleanup')) throw new Error('Attempt cleanup requires --confirm-cleanup. No rows were deleted.');
        const count = await callRpc('cleanup_invite_code_attempts');
        console.log(`Deleted expired invite attempt rows: count=${count}.`);
    };

    return { createInvites, listInvites, checkInvite, runSessions, runAttempts };
}
