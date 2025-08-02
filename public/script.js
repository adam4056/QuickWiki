// QuickWiki JavaScript - Production Version

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize Lucide icons
function initializeLucideIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Theme Management
class ThemeManager {
    constructor() {
        this.themeToggle = document.getElementById('theme-toggle');
        this.html = document.documentElement;
        this.init();
    }

    init() {
        // Check for saved theme preference or default to system preference
        const savedTheme = localStorage.getItem('theme');
        
        if (savedTheme) {
            // User has manually set a theme
            this.setTheme(savedTheme);
        } else {
            // Use system preference
            this.setSystemTheme();
        }

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                // Only auto-switch if user hasn't manually set a theme
                this.setSystemTheme();
            }
        });

        // Click handler for theme toggle
        this.themeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleTheme();
        });

        // Long press to reset to system theme
        let longPressTimer;
        this.themeToggle.addEventListener('mousedown', (e) => {
            longPressTimer = setTimeout(() => {
                this.resetToSystemTheme();
            }, 1000);
        });

        this.themeToggle.addEventListener('mouseup', () => {
            clearTimeout(longPressTimer);
        });

        this.themeToggle.addEventListener('mouseleave', () => {
            clearTimeout(longPressTimer);
        });
    }

    setSystemTheme() {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.setTheme(isDark ? 'dark' : 'light');
    }

    setTheme(theme) {
        if (theme === 'dark') {
            this.html.classList.add('dark');
        } else {
            this.html.classList.remove('dark');
        }
        
        // Reinitialize icons after theme change
        setTimeout(() => {
            initializeLucideIcons();
        }, 100);
    }

    toggleTheme() {
        const isDark = this.html.classList.contains('dark');
        const newTheme = isDark ? 'light' : 'dark';
        
        // Save manual preference
        localStorage.setItem('theme', newTheme);
        
        this.setTheme(newTheme);
    }

    resetToSystemTheme() {
        localStorage.removeItem('theme');
        this.setSystemTheme();
    }
}

// Cache Management
class CacheManager {
    constructor() {
        this.cache = JSON.parse(localStorage.getItem('quickwiki-cache') || '{}');
        this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
        this.maxItems = 50;
    }

    getCacheKey(topic, length) {
        return `${topic.toLowerCase().trim()}_${length}`;
    }

    get(topic, length) {
        const key = this.getCacheKey(topic, length);
        const cached = this.cache[key];
        
        if (cached && Date.now() - cached.timestamp < this.maxAge) {
            return cached;
        }
        
        // Remove expired cache
        if (cached) {
            delete this.cache[key];
            this.save();
        }
        
        return null;
    }

    set(topic, length, summary, originalUrl) {
        const key = this.getCacheKey(topic, length);
        this.cache[key] = {
            summary,
            originalUrl,
            timestamp: Date.now()
        };
        
        // Keep only last 50 cached items
        const keys = Object.keys(this.cache);
        if (keys.length > this.maxItems) {
            const sortedKeys = keys.sort((a, b) => this.cache[a].timestamp - this.cache[b].timestamp);
            for (let i = 0; i < keys.length - this.maxItems; i++) {
                delete this.cache[sortedKeys[i]];
            }
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
        this.clearHistoryBtn.addEventListener('click', () => {
            this.clear();
        });
        this.render();
    }

    add(topic, length) {
        const historyItem = {
            id: Date.now().toString(),
            topic,
            length,
            timestamp: new Date().toISOString()
        };
        
        this.history.unshift(historyItem);
        this.history = this.history.slice(0, this.maxItems);
        this.save();
        this.render();
    }

    clear() {
        this.history = [];
        this.save();
        this.render();
        
        if (typeof toastManager !== 'undefined') {
            toastManager.show('History cleared', 'Search history has been successfully cleared.');
        }
    }

    save() {
        localStorage.setItem('quickwiki-history', JSON.stringify(this.history));
    }

    render() {
        if (this.history.length === 0) {
            this.historyPanel.classList.add('hidden');
            return;
        }
        
        this.historyPanel.classList.remove('hidden');
        this.historyList.innerHTML = '';
        
        this.history.slice(0, 5).forEach(item => {
            const historyItem = document.createElement('div');
            const cached = cacheManager.get(item.topic, item.length);
            const cacheIcon = cached ? '<i data-lucide="zap" class="w-3 h-3 text-green-500 dark:text-green-400"></i>' : '';
            
            historyItem.className = 'flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-blue-500/50 cursor-pointer transition-colors duration-200 shadow-sm';
            historyItem.onclick = () => quickWikiApp.performSearch(item.topic, item.length, true);
            
            historyItem.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="font-medium text-sm truncate text-gray-900 dark:text-white">${item.topic}</p>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-400 rounded-full transition-colors duration-200 shadow-sm">
                            ${item.length} sentences
                        </span>
                        <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <i data-lucide="clock" class="w-3 h-3"></i>
                            ${this.formatTimeAgo(new Date(item.timestamp))}
                        </div>
                        ${cacheIcon}
                    </div>
                </div>
            `;
            this.historyList.appendChild(historyItem);
        });
        initializeLucideIcons();
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} h ago`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays} days ago`;
    }
}

// Toast Manager
class ToastManager {
    constructor() {
        this.toast = document.getElementById('toast');
        this.toastIcon = document.getElementById('toast-icon');
        this.toastTitle = document.getElementById('toast-title');
        this.toastMessage = document.getElementById('toast-message');
    }

    show(title, message, type = 'success') {
        const iconMap = {
            success: '<i data-lucide="check-circle" class="w-5 h-5 text-green-500 dark:text-green-400"></i>',
            error: '<i data-lucide="x-circle" class="w-5 h-5 text-red-500 dark:text-red-400"></i>',
            info: '<i data-lucide="info" class="w-5 h-5 text-blue-500 dark:text-blue-400"></i>'
        };
        
        this.toastIcon.innerHTML = iconMap[type] || iconMap.success;
        this.toastTitle.textContent = title;
        this.toastMessage.textContent = message;
        
        // Show toast by removing translate-x-full, opacity-0, and pointer-events-none classes
        this.toast.classList.remove('translate-x-full', 'opacity-0', 'pointer-events-none');
        
        setTimeout(() => {
            initializeLucideIcons();
        }, 100);
        
        // Hide toast after 3 seconds
        setTimeout(() => {
            this.toast.classList.add('translate-x-full', 'opacity-0', 'pointer-events-none');
        }, 3000);
    }
}

// Statistics Manager
class StatsManager {
    constructor() {
        this.cacheHits = 0;
        this.totalSearches = 0;
        this.cacheRateElement = document.getElementById('cache-rate');
    }

    incrementCacheHits() {
        this.cacheHits++;
        this.updateCacheRate();
    }

    incrementTotalSearches() {
        this.totalSearches++;
        this.updateCacheRate();
    }

    updateCacheRate() {
        const rate = this.totalSearches > 0 ? Math.round((this.cacheHits / this.totalSearches) * 100) : 0;
        this.cacheRateElement.textContent = `${rate}%`;
    }
}

// Main QuickWiki Application
class QuickWikiApp {
    constructor() {
        this.currentResult = null;
        
        // Get DOM elements
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
        // Advanced settings toggle
        this.elements.toggleAdvanced.addEventListener('click', () => {
            this.elements.advancedSettings.classList.toggle('hidden');
        });

        // Search form submission
        this.elements.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const topic = this.elements.topicInput.value.trim();
            const length = parseInt(this.elements.lengthSelect.value);
            
            if (topic) {
                this.performSearch(topic, length);
            }
        });

        // Retry button
        this.elements.retryBtn.addEventListener('click', () => {
            if (this.currentResult) {
                this.performSearch(this.currentResult.topic, this.currentResult.sentenceCount);
            }
        });

        // Copy button
        this.elements.copyBtn.addEventListener('click', async () => {
            if (this.currentResult) {
                try {
                    await navigator.clipboard.writeText(this.currentResult.summary.replace(/<[^>]*>/g, ''));
                    toastManager.show('Copied!', 'Summary has been copied to clipboard.');
                } catch (error) {
                    toastManager.show('Error', 'Failed to copy text.', 'error');
                }
            }
        });

        // Share button
        this.elements.shareBtn.addEventListener('click', async () => {
            if (navigator.share && this.currentResult) {
                try {
                    await navigator.share({
                        title: `QuickWiki summary: ${this.currentResult.topic}`,
                        text: this.currentResult.summary.replace(/<[^>]*>/g, ''),
                        url: window.location.href,
                    });
                } catch (error) {
                    // Share cancelled or failed
                }
            } else {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    toastManager.show('Link copied!', 'Link to this page has been copied to clipboard.');
                } catch (error) {
                    toastManager.show('Error', 'Failed to copy link.', 'error');
                }
            }
        });
    }

    hideAllStates() {
        this.elements.loadingState.classList.add('hidden');
        this.elements.errorState.classList.add('hidden');
        this.elements.resultCard.classList.add('hidden');
    }

    async performSearch(topic, length, fromHistory = false) {
        statsManager.incrementTotalSearches();
        
        // Check cache first
        const cached = cacheManager.get(topic, length);
        if (cached) {
            statsManager.incrementCacheHits();
            this.displayResult(topic, length, cached.summary, cached.originalUrl, true);
            
            // Add to history if not from history
            if (!fromHistory) {
                historyManager.add(topic, length);
            }
            toastManager.show('Success!', `Summary for "${topic}" was loaded from cache.`);
            return;
        }

        this.hideAllStates();
        this.elements.heroSection.classList.add('hidden');
        this.elements.loadingState.classList.remove('hidden');

        // Update button state
        this.elements.searchBtn.innerHTML = `
            <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Processing...
        `;
        this.elements.searchBtn.disabled = true;

        try {
            // Make API call to summarize endpoint
            const response = await fetch(`/api/summarize?topic=${encodeURIComponent(topic)}&length=${length}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.summary || !data.originalUrl) {
                throw new Error('Invalid response from API - missing summary or URL');
            }

            // Cache the result
            cacheManager.set(topic, length, data.summary, data.originalUrl);
            
            this.displayResult(topic, length, data.summary, data.originalUrl, false);

            // Add to history
            historyManager.add(topic, length);

            toastManager.show('Success!', `Summary for "${topic}" was successfully created.`);

        } catch (error) {
            this.hideAllStates();
            this.elements.errorMessage.textContent = error.message;
            this.elements.errorState.classList.remove('hidden');
            toastManager.show('Error', error.message, 'error');
        } finally {
            // Reset button state
            this.elements.searchBtn.innerHTML = `
                <i data-lucide="search" class="w-5 h-5"></i>
                Search and summarize
            `;
            this.elements.searchBtn.disabled = false;
            initializeLucideIcons();
        }
    }

    displayResult(topic, length, summary, originalUrl, fromCache) {
        // Store result
        this.currentResult = {
            summary,
            originalUrl,
            topic,
            sentenceCount: length
        };

        // Update UI
        this.hideAllStates();
        this.elements.resultTitle.innerHTML = `
            <div class="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
                <i data-lucide="book-open" class="w-4 h-4 text-white"></i>
            </div>
            ${topic}
        `;
        this.elements.resultBadge.textContent = `${length} ${length === 1 ? 'sentence' : 'sentences'}`;
        this.elements.resultContent.innerHTML = summary;
        this.elements.wikiLink.href = originalUrl;
        
        // Show/hide cache indicator
        if (fromCache) {
            this.elements.cacheIndicator.classList.remove('hidden');
        } else {
            this.elements.cacheIndicator.classList.add('hidden');
        }
        
        this.elements.resultCard.classList.remove('hidden');
        initializeLucideIcons();
    }
}

// Global instances
let themeManager;
let cacheManager;
let historyManager;
let toastManager;
let statsManager;
let quickWikiApp;

// Initialize the application
function initializeApp() {
    try {
        // Initialize all managers and the main app
        themeManager = new ThemeManager();
        cacheManager = new CacheManager();
        historyManager = new HistoryManager();
        toastManager = new ToastManager();
        statsManager = new StatsManager();
        quickWikiApp = new QuickWikiApp();
        
        // Initialize Lucide icons
        initializeLucideIcons();
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
}
