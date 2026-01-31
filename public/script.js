// QuickWiki JavaScript - Production Version

// Initialize Lucide icons
function initializeLucideIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try {
            lucide.createIcons();
        } catch (error) {
            console.warn('Failed to initialize Lucide icons:', error);
        }
    }
}

// Theme Management - Automatic (System Preference)
class ThemeManager {
    constructor() {
        this.init();
    }

    init() {
        const updateTheme = () => {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        };
        updateTheme();
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
    }
}

// Cache Management
class CacheManager {
    constructor() {
        this.cache = JSON.parse(localStorage.getItem('quickwiki-cache') || '{}');
        this.maxAge = 24 * 60 * 60 * 1000;
        this.maxItems = 50;
    }

    getCacheKey(topic, length) {
        return `${topic.toLowerCase().trim()}_${length}`;
    }

    get(topic, length) {
        const key = this.getCacheKey(topic, length);
        const cached = this.cache[key];
        if (cached && Date.now() - cached.timestamp < this.maxAge) return cached;
        if (cached) { delete this.cache[key]; this.save(); }
        return null;
    }

    set(topic, length, summary, originalUrl) {
        const key = this.getCacheKey(topic, length);
        this.cache[key] = { summary, originalUrl, timestamp: Date.now() };
        const keys = Object.keys(this.cache);
        if (keys.length > this.maxItems) {
            const sortedKeys = keys.sort((a, b) => this.cache[a].timestamp - this.cache[b].timestamp);
            for (let i = 0; i < keys.length - this.maxItems; i++) delete this.cache[sortedKeys[i]];
        }
        this.save();
    }

    save() {
        localStorage.setItem('quickwiki-cache', JSON.stringify(this.cache));
    }
}

// History Management
class HistoryManager {
    constructor() {
        this.history = JSON.parse(localStorage.getItem('quickwiki-history') || '[]');
        this.maxItems = 10;
        this.historyPanel = document.getElementById('history-panel');
        this.historyList = document.getElementById('history-list');
        this.clearHistoryBtn = document.getElementById('clear-history');
        this.init();
    }

    init() {
        if (this.clearHistoryBtn) this.clearHistoryBtn.addEventListener('click', () => this.clear());
        this.render();
    }

    add(topic, length) {
        const historyItem = { id: Date.now().toString(), topic, length, timestamp: new Date().toISOString() };
        this.history = this.history.filter(h => h.topic.toLowerCase() !== topic.toLowerCase());
        this.history.unshift(historyItem);
        this.history = this.history.slice(0, this.maxItems);
        this.save();
        this.render();
    }

    remove(id, e) {
        if (e) e.stopPropagation();
        this.history = this.history.filter(h => h.id !== id);
        this.save();
        this.render();
        toastManager.show('Removed', 'Item removed from history.');
    }

    clear() {
        this.history = [];
        this.save();
        this.render();
        toastManager.show('Cleared', 'History has been cleared.');
    }

    save() {
        localStorage.setItem('quickwiki-history', JSON.stringify(this.history));
    }

    render() {
        if (!this.history || this.history.length === 0) {
            if (this.historyPanel) this.historyPanel.classList.add('hidden');
            return;
        }
        if (this.historyPanel) this.historyPanel.classList.remove('hidden');
        if (this.historyList) {
            this.historyList.innerHTML = '';
            this.history.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'flex items-center justify-between p-4 rounded-xl bg-current/[0.03] border border-current/[0.05] hover:bg-current/[0.06] cursor-pointer transition-all active:scale-[0.98] group animate-fade-in';
                historyItem.onclick = () => quickWikiApp.performSearch(item.topic, item.length, true);
                historyItem.innerHTML = `
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-sm truncate opacity-80 group-hover:opacity-100">${item.topic}</p>
                        <p class="text-[10px] uppercase tracking-widest opacity-30 mt-1">${item.length} sentences</p>
                    </div>
                    <div class="flex items-center gap-4">
                        <i data-lucide="trash-2" class="w-4 h-4 opacity-0 group-hover:opacity-30 hover:!opacity-100 hover:text-red-500 transition-all p-1" onclick="historyManager.remove('${item.id}', event)"></i>
                        <i data-lucide="chevron-right" class="w-4 h-4 opacity-20 group-hover:opacity-50"></i>
                    </div>
                `;
                this.historyList.appendChild(historyItem);
            });
        }
        initializeLucideIcons();
    }
}

// Toast Manager
class ToastManager {
    constructor() {
        this.toast = document.getElementById('toast');
        this.toastIcon = document.getElementById('toast-icon');
        this.toastTitle = document.getElementById('toast-title');
    }

    show(title, type = 'success') {
        const icons = {
            success: '<i data-lucide="check" class="w-4 h-4"></i>',
            error: '<i data-lucide="x" class="w-4 h-4"></i>',
            info: '<i data-lucide="info" class="w-4 h-4"></i>'
        };
        if (this.toastIcon) this.toastIcon.innerHTML = icons[type] || icons.success;
        if (this.toastTitle) this.toastTitle.textContent = title;
        if (this.toast) {
            this.toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
            setTimeout(() => initializeLucideIcons(), 100);
            setTimeout(() => this.toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none'), 3000);
        }
    }
}

// Main QuickWiki Application
class QuickWikiApp {
    constructor() {
        this.currentResult = null;
        this.elements = {
            heroSection: document.getElementById('hero-section'),
            searchForm: document.getElementById('search-form'),
            topicInput: document.getElementById('topic'),
            lengthSelect: document.getElementById('length'),
            searchBtn: document.getElementById('search-btn'),
            toggleAdvanced: document.getElementById('toggle-advanced'),
            advancedSettings: document.getElementById('advanced-settings'),
            loadingState: document.getElementById('loading-state'),
            errorState: document.getElementById('error-state'),
            errorMessage: document.getElementById('error-message'),
            retryBtn: document.getElementById('retry-btn'),
            resultCard: document.getElementById('result-card'),
            resultTitle: document.getElementById('result-title'),
            resultBadge: document.getElementById('result-badge'),
            resultContent: document.getElementById('result-content'),
            cacheIndicator: document.getElementById('cache-indicator'),
            copyBtn: document.getElementById('copy-btn'),
            shareBtn: document.getElementById('share-btn'),
            wikiLink: document.getElementById('wiki-link')
        };
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        if (this.elements.toggleAdvanced) this.elements.toggleAdvanced.addEventListener('click', () => this.elements.advancedSettings.classList.toggle('hidden'));
        
        // Custom Length Selector
        const lengthOpts = document.querySelectorAll('.length-opt');
        const lengthInput = document.getElementById('length');
        lengthOpts.forEach(opt => {
            opt.addEventListener('click', () => {
                lengthOpts.forEach(o => o.classList.remove('bg-current/10'));
                opt.classList.add('bg-current/10');
                if (lengthInput) lengthInput.value = opt.dataset.value;
            });
        });

        if (this.elements.searchForm) this.elements.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const topic = this.elements.topicInput.value.trim();
            const length = parseInt(lengthInput.value);
            if (topic) this.performSearch(topic, length);
        });
        if (this.elements.retryBtn) this.elements.retryBtn.addEventListener('click', () => {
            if (this.currentResult) this.performSearch(this.currentResult.topic, this.currentResult.sentenceCount);
        });
        if (this.elements.copyBtn) this.elements.copyBtn.addEventListener('click', async () => {
            if (this.currentResult) {
                try {
                    await navigator.clipboard.writeText(this.currentResult.summary.replace(/<[^>]*>/g, ''));
                    toastManager.show('Copied');
                } catch (e) { toastManager.show('Error', 'error'); }
            }
        });
        if (this.elements.shareBtn) this.elements.shareBtn.addEventListener('click', async () => {
            if (navigator.share && this.currentResult) {
                try {
                    await navigator.share({ title: `QuickWiki: ${this.currentResult.topic}`, text: this.currentResult.summary.replace(/<[^>]*>/g, ''), url: window.location.href });
                } catch (e) {}
            } else {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    toastManager.show('Link Copied');
                } catch (e) {}
            }
        });
    }

    hideAllStates() {
        if (this.elements.loadingState) this.elements.loadingState.classList.add('hidden');
        if (this.elements.errorState) this.elements.errorState.classList.add('hidden');
        if (this.elements.resultCard) this.elements.resultCard.classList.add('hidden');
    }

    async performSearch(topic, length, fromHistory = false) {
        const cached = cacheManager.get(topic, length);
        if (cached) {
            this.displayResult(topic, length, cached.summary, cached.originalUrl, true);
            if (!fromHistory) historyManager.add(topic, length);
            return;
        }

        this.hideAllStates();
        if (this.elements.heroSection) this.elements.heroSection.classList.add('hidden');
        if (this.elements.loadingState) this.elements.loadingState.classList.remove('hidden');
        if (this.elements.searchBtn) {
            this.elements.searchBtn.disabled = true;
            this.elements.searchBtn.textContent = '...';
        }

        try {
            const response = await fetch(`/api/summarize?topic=${encodeURIComponent(topic)}&length=${length}`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({ error: 'Request failed' }));
                throw new Error(data.error || 'Something went wrong');
            }
            const data = await response.json();
            cacheManager.set(topic, length, data.summary, data.originalUrl);
            this.displayResult(topic, length, data.summary, data.originalUrl, false);
            historyManager.add(topic, length);
        } catch (error) {
            this.hideAllStates();
            if (this.elements.errorMessage) this.elements.errorMessage.textContent = error.message;
            if (this.elements.errorState) this.elements.errorState.classList.remove('hidden');
            toastManager.show(error.message, 'error');
        } finally {
            if (this.elements.searchBtn) {
                this.elements.searchBtn.disabled = false;
                this.elements.searchBtn.textContent = 'Summarize';
            }
            initializeLucideIcons();
        }
    }

    displayResult(topic, length, summary, originalUrl, fromCache) {
        this.currentResult = { summary, originalUrl, topic, sentenceCount: length };
        this.hideAllStates();
        
        // Calculate reading time (approx 200 words per minute)
        const wordCount = summary.split(' ').length;
        const readTime = Math.max(1, Math.ceil(wordCount / 200));

        if (this.elements.resultTitle) this.elements.resultTitle.textContent = topic;
        if (this.elements.resultBadge) this.elements.resultBadge.innerHTML = `${length} Sentences &bull; ${readTime} min read`;
        if (this.elements.resultContent) this.elements.resultContent.innerHTML = summary;
        if (this.elements.wikiLink) this.elements.wikiLink.href = originalUrl;
        if (this.elements.cacheIndicator) {
            if (fromCache) this.elements.cacheIndicator.classList.remove('hidden');
            else this.elements.cacheIndicator.classList.add('hidden');
        }
        if (this.elements.resultCard) {
            this.elements.resultCard.classList.remove('hidden');
            this.elements.resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        initializeLucideIcons();
    }
}

let themeManager, cacheManager, historyManager, toastManager, quickWikiApp;

document.addEventListener('DOMContentLoaded', () => {
    themeManager = new ThemeManager();
    cacheManager = new CacheManager();
    historyManager = new HistoryManager();
    toastManager = new ToastManager();
    quickWikiApp = new QuickWikiApp();
    initializeLucideIcons();
});
