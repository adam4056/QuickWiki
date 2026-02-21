// QuickWiki JavaScript - Production Version

// Translations
const translations = {
    en: {
        heroTitle: "Terminology, refined.",
        heroSubtitle: "25-word flash definitions for podcasters & editors.",
        placeholder: "Enter a term...",
        askBtn: "Define",
        thinking: "Defining...",
        agentAnalysis: "Fact-Checked Definition",
        words: "words",
        recentSearches: "Recent Terms",
        clear: "Clear",
        copy: "Copy",
        copied: "Copied",
        share: "Share",
        viewWiki: "View Source",
        historyTag: "Quick Definition",
        linkCopied: "Link Copied"
    },
    cs: {
        heroTitle: "Terminologie, bleskově.",
        heroSubtitle: "Definice do 25 slov pro tvůrce a editory.",
        placeholder: "Zadejte pojem...",
        askBtn: "Definovat",
        thinking: "Definuji...",
        agentAnalysis: "Ověřená definice",
        words: "slov",
        recentSearches: "Nedávné pojmy",
        clear: "Smazat",
        copy: "Kopírovat",
        copied: "Zkopírováno",
        share: "Sdílet",
        viewWiki: "Zobrazit zdroj",
        historyTag: "Rychlá definice",
        linkCopied: "Odkaz zkopírován"
    },
    de: {
        heroTitle: "Wissen, verfeinert.",
        heroSubtitle: "Ihr intelligenter Wikipedia-Agent.",
        placeholder: "Was möchten Sie wissen?",
        askBtn: "Agent fragen",
        thinking: "Nachdenken...",
        agentAnalysis: "Agenten-Analyse",
        words: "Wörter",
        recentSearches: "Letzte Suchen",
        clear: "Löschen",
        copy: "Kopieren",
        copied: "Kopiert",
        share: "Teilen",
        viewWiki: "Wikipedia anzeigen",
        historyTag: "Agenten-Definition",
        linkCopied: "Link kopiert"
    },
    es: {
        heroTitle: "Conocimiento, refinado.",
        heroSubtitle: "Tu agente inteligente de Wikipedia.",
        placeholder: "¿Qué te gustaría saber?",
        askBtn: "Preguntar",
        thinking: "Pensando...",
        agentAnalysis: "Análisis del agente",
        words: "palabras",
        recentSearches: "Búsquedas recientes",
        clear: "Limpiar",
        copy: "Copiar",
        copied: "Copiado",
        share: "Compartir",
        viewWiki: "Ver Wikipedia",
        historyTag: "Definición del agente",
        linkCopied: "Enlace copiado"
    }
};

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

// Language Management
class LanguageManager {
    constructor() {
        let savedLang = localStorage.getItem('quickwiki-lang');
        
        // Zkontrolujeme, zda je v URL použit speciální klíč
        const urlParams = new URLSearchParams(window.location.search);
        const hasSpecialKey = urlParams.has('special_key') || urlParams.has('backup_key') || urlParams.has('key') || urlParams.has('gemini_key');
        
        if (hasSpecialKey) {
            // Pokud je v URL použit speciální klíč, automaticky vnutí češtinu
            savedLang = 'cs';
            localStorage.setItem('quickwiki-lang', 'cs');
        } else if (!savedLang) {
            // Automatická lokalizace podle prohlížeče, pokud uživatel ještě nemá uloženou preferenci
            const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
            if (browserLang.startsWith('cs') || browserLang.startsWith('sk')) {
                savedLang = 'cs';
            } else if (browserLang.startsWith('de')) {
                savedLang = 'de';
            } else if (browserLang.startsWith('es')) {
                savedLang = 'es';
            } else {
                savedLang = 'en'; // Bezpečnostní fallback
            }
        }
        
        this.currentLang = savedLang;
        this.init();
    }

    init() {
        const langBtns = document.querySelectorAll('.lang-btn');
        langBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                this.setLanguage(lang);
            });
        });
        this.updateUI();
    }

    setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('quickwiki-lang', lang);
        this.updateUI();
        
        // Refresh history render to update language labels
        if (historyManager) historyManager.render();
    }

    updateUI() {
        const t = translations[this.currentLang];
        
        // Update Buttons state
        document.querySelectorAll('.lang-btn').forEach(btn => {
            if (btn.dataset.lang === this.currentLang) {
                btn.classList.add('bg-black', 'dark:bg-white', 'text-white', 'dark:text-black');
                btn.classList.remove('opacity-40');
            } else {
                btn.classList.remove('bg-black', 'dark:bg-white', 'text-white', 'dark:text-black');
                btn.classList.add('opacity-40');
            }
        });

        // Update Text Elements
        const heroTitle = document.getElementById('ui-hero-title');
        if (heroTitle) heroTitle.textContent = t.heroTitle;
        
        const heroSubtitle = document.getElementById('ui-hero-subtitle');
        if (heroSubtitle) heroSubtitle.textContent = t.heroSubtitle;

        const topicInput = document.getElementById('topic');
        if (topicInput) topicInput.placeholder = t.placeholder;

        const searchBtn = document.getElementById('search-btn');
        if (searchBtn && !searchBtn.disabled) searchBtn.textContent = t.askBtn;

        const clearHistory = document.getElementById('clear-history');
        if (clearHistory) clearHistory.textContent = t.clear;

        // Result Buttons
        const copyBtn = document.getElementById('copy-btn');
        if (copyBtn) copyBtn.innerHTML = `<i data-lucide="copy" class="w-4 h-4"></i> ${t.copy}`;
        
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) shareBtn.innerHTML = `<i data-lucide="share" class="w-4 h-4"></i> ${t.share}`;

        const recentTitle = document.querySelector('#history-panel h3');
        if (recentTitle) recentTitle.textContent = t.recentSearches;

        initializeLucideIcons();
    }

    getTranslation(key) {
        return translations[this.currentLang][key] || key;
    }
}

// Cache Management
class CacheManager {
    constructor() {
        this.cache = JSON.parse(localStorage.getItem('quickwiki-cache') || '{}');
        this.maxAge = 24 * 60 * 60 * 1000;
        this.maxItems = 50;
    }

    getCacheKey(topic, lang) {
        return `${topic.toLowerCase().trim()}_${lang}`;
    }

    get(topic, lang) {
        const key = this.getCacheKey(topic, lang);
        const cached = this.cache[key];
        if (cached && Date.now() - cached.timestamp < this.maxAge) return cached;
        if (cached) { delete this.cache[key]; this.save(); }
        return null;
    }

    set(topic, lang, summary, originalUrl, title) {
        const key = this.getCacheKey(topic, lang);
        this.cache[key] = { summary, originalUrl, title, timestamp: Date.now() };
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

    add(topic, lang) {
        const historyItem = { id: Date.now().toString(), topic, lang, timestamp: new Date().toISOString() };
        this.history = this.history.filter(h => h.topic.toLowerCase() !== topic.toLowerCase() || h.lang !== lang);
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
        toastManager.show(languageManager.getTranslation('clear'), 'info');
    }

    clear() {
        this.history = [];
        this.save();
        this.render();
        toastManager.show(languageManager.getTranslation('clear'), 'info');
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
                historyItem.onclick = () => {
                    languageManager.setLanguage(item.lang);
                    quickWikiApp.performSearch(item.topic, true);
                };
                historyItem.innerHTML = `
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <p class="font-medium text-[15px] truncate opacity-80 group-hover:opacity-100 transition-opacity">${item.topic}</p>
                            <span class="text-[10px] font-semibold opacity-40 uppercase tracking-widest border border-current/10 px-2 py-0.5 rounded-full">${item.lang}</span>
                        </div>
                        <p class="text-[10px] uppercase tracking-widest opacity-30 mt-1">${languageManager.getTranslation('historyTag')}</p>
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
            searchBtn: document.getElementById('search-btn'),
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
            sourcePill: document.getElementById('source-pill'),
            sourceFavicon: document.getElementById('source-favicon'),
            sourceName: document.getElementById('source-name')
        };
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        if (this.elements.searchForm) this.elements.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const topic = this.elements.topicInput.value.trim();
            if (!topic) {
                toastManager.show(languageManager.getTranslation('placeholder'), 'info');
                return;
            }
            this.performSearch(topic);
        });
        if (this.elements.retryBtn) this.elements.retryBtn.addEventListener('click', () => {
            if (this.currentResult) this.performSearch(this.currentResult.topic);
        });
        if (this.elements.copyBtn) this.elements.copyBtn.addEventListener('click', async () => {
            if (this.currentResult) {
                try {
                    await navigator.clipboard.writeText(this.currentResult.summary.replace(/<[^>]*>/g, ''));
                    toastManager.show(languageManager.getTranslation('copied'));
                } catch (e) { toastManager.show('Error', 'error'); }
            }
        });
        if (this.elements.shareBtn) this.elements.shareBtn.addEventListener('click', async () => {
            if (navigator.share && this.currentResult) {
                try {
                    await navigator.share({ title: `QuickWiki Agent: ${this.currentResult.topic}`, text: this.currentResult.summary.replace(/<[^>]*>/g, ''), url: window.location.href });
                } catch (e) {}
            } else {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    toastManager.show(languageManager.getTranslation('linkCopied'));
                } catch (e) {}
            }
        });
    }

    hideAllStates() {
        if (this.elements.loadingState) this.elements.loadingState.classList.add('hidden');
        if (this.elements.errorState) this.elements.errorState.classList.add('hidden');
        if (this.elements.resultCard) this.elements.resultCard.classList.add('hidden');
    }

    async performSearch(topic, fromHistory = false) {
        const lang = languageManager.currentLang;
        const cached = cacheManager.get(topic, lang);
        
        if (cached) {
            this.displayResult(cached.title || topic, cached.summary, cached.originalUrl, true);
            if (!fromHistory) historyManager.add(topic, lang);
            return;
        }

        this.hideAllStates();
        
        // Shrink wrapper to reduce gap
        const wrapper = document.getElementById('search-wrapper');
        if (wrapper) {
            wrapper.classList.remove('min-h-screen', 'justify-center');
            wrapper.classList.add('pt-32', 'md:pt-40', 'pb-8'); // Larger gap from header
        }

        if (this.elements.heroSection) this.elements.heroSection.classList.add('hidden');
        if (this.elements.loadingState) this.elements.loadingState.classList.remove('hidden');
        if (this.elements.searchBtn) {
            this.elements.searchBtn.disabled = true;
            this.elements.searchBtn.textContent = languageManager.getTranslation('thinking');
        }

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const params = new URLSearchParams({
                topic: topic,
                lang: lang
            });
            
            // Přidání případného speciálního klíče nebo dalších parametrů z URL
            urlParams.forEach((value, key) => {
                if (key !== 'topic' && key !== 'lang') {
                    params.append(key, value);
                }
            });

            const response = await fetch(`/api/summarize?${params.toString()}`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({ error: 'Request failed' }));
                throw new Error(data.error || 'Something went wrong');
            }
            const data = await response.json();
            cacheManager.set(topic, lang, data.summary, data.originalUrl, data.title);
            this.displayResult(data.title || topic, data.summary, data.originalUrl, false);
            historyManager.add(topic, lang);
        } catch (error) {
            this.hideAllStates();
            if (this.elements.errorMessage) this.elements.errorMessage.textContent = error.message;
            if (this.elements.errorState) this.elements.errorState.classList.remove('hidden');
            toastManager.show(error.message, 'error');
        } finally {
            if (this.elements.searchBtn) {
                this.elements.searchBtn.disabled = false;
                this.elements.searchBtn.textContent = languageManager.getTranslation('askBtn');
            }
            initializeLucideIcons();
        }
    }

    displayResult(topic, summary, originalUrl, fromCache) {
        this.currentResult = { summary, originalUrl, topic };
        this.hideAllStates();
        
        // Ensure wrapper is shrunk
        const wrapper = document.getElementById('search-wrapper');
        if (wrapper) {
            wrapper.classList.remove('min-h-screen', 'justify-center');
            wrapper.classList.add('pt-32', 'md:pt-40', 'pb-8');
        }

        const wordCount = summary.split(' ').length;
        const t = translations[languageManager.currentLang];

        if (this.elements.resultTitle) this.elements.resultTitle.textContent = topic;
        if (this.elements.resultBadge) this.elements.resultBadge.innerHTML = `${t.agentAnalysis} &bull; ${wordCount} ${t.words}`;
        if (this.elements.resultContent) this.elements.resultContent.innerHTML = summary;
        
        if (this.elements.sourcePill) {
            if (originalUrl) {
                this.elements.sourcePill.href = originalUrl;
                this.elements.sourcePill.classList.remove('hidden');
                this.elements.sourcePill.classList.add('inline-flex');
                
                try {
                    const urlObj = new URL(originalUrl);
                    let hostname = urlObj.hostname.replace(/^www\./, '');
                    
                    if (this.elements.sourceFavicon) {
                        this.elements.sourceFavicon.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
                    }
                    if (this.elements.sourceName) {
                        // Zformátuj název (např. cs.wikipedia.org -> Wikipedia)
                        if (hostname.includes('wikipedia.org')) {
                            this.elements.sourceName.textContent = 'Wikipedia';
                        } else {
                            this.elements.sourceName.textContent = hostname;
                        }
                    }
                } catch (e) {
                    if (this.elements.sourceName) this.elements.sourceName.textContent = t.viewWiki;
                }
            } else {
                this.elements.sourcePill.classList.add('hidden');
                this.elements.sourcePill.classList.remove('inline-flex');
            }
        }

        if (this.elements.cacheIndicator) {
            if (fromCache) this.elements.cacheIndicator.classList.remove('hidden');
            else this.elements.cacheIndicator.classList.add('hidden');
        }
        if (this.elements.resultCard) {
            this.elements.resultCard.classList.remove('hidden');
            // Scroll with small offset to keep search bar visible
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        initializeLucideIcons();
    }
}

let themeManager, languageManager, cacheManager, historyManager, toastManager, quickWikiApp;

document.addEventListener('DOMContentLoaded', () => {
    themeManager = new ThemeManager();
    languageManager = new LanguageManager();
    cacheManager = new CacheManager();
    historyManager = new HistoryManager();
    toastManager = new ToastManager();
    quickWikiApp = new QuickWikiApp();
    initializeLucideIcons();
});
