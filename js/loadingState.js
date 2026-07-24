/*
 * Shared, accessible loading/error state helpers.
 * Content is deliberately created with DOM APIs so status text never becomes
 * HTML.  Pages retain ownership of their data and retry operation.
 */
(() => {
    const adopt = (host) => {
        if (!host || host.classList.contains('loading-state')) return host;
        host.classList.add('loading-state');
        let spinner = host.querySelector('.loading-spinner, i[aria-hidden="true"]');
        if (!spinner) {
            spinner = document.createElement('span');
            spinner.setAttribute('aria-hidden', 'true');
            host.prepend(spinner);
        }
        spinner.className = 'loading-spinner';
        const label = host.querySelector('.loading-text, strong, b');
        if (label) label.classList.add('loading-text');
        return host;
    };

    const adoptDescendants = (root = document) => {
        root.querySelectorAll?.('.page-loading, .meal-map-placeholder, .record-written-image-loading').forEach(adopt);
    };
    const createState = (kind, title, detail = '', retry = null) => {
        const state = document.createElement('div');
        state.className = kind === 'error' ? 'page-state page-state-error' : 'page-state page-loading loading-state';
        state.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        state.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');

        if (kind !== 'error') {
            const spinner = document.createElement('span');
            spinner.className = 'loading-spinner';
            spinner.setAttribute('aria-hidden', 'true');
            state.append(spinner);
        }
        const heading = document.createElement('strong');
        heading.className = 'loading-text';
        heading.textContent = title;
        state.append(heading);
        if (detail) {
            const description = document.createElement('span');
            description.textContent = detail;
            state.append(description);
        }
        if (typeof retry === 'function') {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn-action page-state-retry';
            button.textContent = '重试';
            button.addEventListener('click', () => {
                button.disabled = true;
                Promise.resolve(retry()).finally(() => { button.disabled = false; });
            });
            state.append(button);
        }
        return state;
    };

    const replace = (host, state, busy) => {
        if (!host) return null;
        host.replaceChildren(state);
        host.setAttribute('aria-busy', busy ? 'true' : 'false');
        return state;
    };

    window.ClassRecordLoading = Object.freeze({
        show(host, title = '正在加载内容…', detail = '') {
            return replace(host, createState('loading', title, detail), true);
        },
        error(host, title = '内容暂时无法加载。', detail = '请稍后重试。', retry) {
            return replace(host, createState('error', title, detail, retry), false);
        },
        clearBusy(host) {
            host?.setAttribute('aria-busy', 'false');
        },
        adopt
    });
    document.addEventListener('DOMContentLoaded', () => {
        adoptDescendants();
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                if (node.matches?.('.page-loading, .meal-map-placeholder, .record-written-image-loading')) adopt(node);
                adoptDescendants(node);
            }));
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    }, { once: true });
})();
