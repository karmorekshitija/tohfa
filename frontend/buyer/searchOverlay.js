import apiClient from '/src/utils/apiClient.js';

class SearchOverlay {
  constructor() {
    this.overlay = null;
    this.scrim = null;
    this.card = null;
    this.input = null;
    this.clearBtn = null;
    this.closeBtn = null;
    this.resultsContainer = null;
    this.typingTimeout = null;
    this.isOpen = false;
    
    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    // Check if search overlay already exists
    if (document.getElementById('global-search-overlay')) {
      this.overlay = document.getElementById('global-search-overlay');
      this.scrim = document.getElementById('global-search-scrim');
      this.card = document.getElementById('global-search-card');
      this.input = document.getElementById('global-search-input');
      this.clearBtn = document.getElementById('global-search-clear');
      this.closeBtn = document.getElementById('global-search-close');
      this.resultsContainer = document.getElementById('global-search-results');
      return;
    }

    // Create the overlay elements
    const overlayMarkup = `
      <div id="global-search-overlay" class="fixed inset-0 z-[250] flex items-start justify-center p-4 md:p-10 pointer-events-none hidden font-['DM_Sans']">
        <!-- Backdrop Blur Scrim -->
        <div id="global-search-scrim" class="fixed inset-0 bg-[#1f1b15]/40 backdrop-blur-md transition-opacity duration-300 opacity-0 pointer-events-auto cursor-pointer"></div>
        
        <!-- Search Card -->
        <div id="global-search-card" class="relative max-w-2xl w-full bg-[#FAF7F0] rounded-2xl shadow-2xl border border-[#C1C9C0] flex flex-col max-h-[85vh] overflow-hidden transform transition-all duration-300 scale-95 opacity-0 -translate-y-5 pointer-events-auto z-[251]">
          
          <!-- Search Header -->
          <div class="relative flex items-center border-b border-[#C1C9C0]/50 px-4">
            <span class="material-symbols-outlined text-[#74786f] absolute left-4 pointer-events-none">search</span>
            
            <input type="text" id="global-search-input" placeholder="Search by item, tag, artisan..." class="w-full bg-transparent py-5 pl-12 pr-16 outline-none text-[#1f1b15] text-base border-0 focus:ring-0 placeholder:text-[#74786f]" autocomplete="off">
            
            <button id="global-search-clear" class="absolute right-12 flex items-center text-[#74786f] hover:text-[#255338] transition-colors hidden" title="Clear input">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
            
            <button id="global-search-close" class="absolute right-4 flex items-center text-[#74786f] hover:text-red-600 transition-colors" title="Close Search">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <!-- Search Content / Results Container -->
          <div id="global-search-results" class="overflow-y-auto flex-1 bg-[#FAF7F0] p-6 space-y-6">
            <!-- Recent / Recommended Searches Section -->
            <div id="global-search-idle" class="space-y-6">
              <div>
                <h4 class="text-xs font-semibold tracking-wider text-[#74786f] uppercase mb-3 font-['DM_Sans']">Popular Categories</h4>
                <div class="flex flex-wrap gap-2">
                  <a href="/buyer/category.html?slug=textile-arts" class="px-4 py-2 bg-[#E6E2D8]/40 hover:bg-[#255338]/10 text-[#255338] text-sm rounded-full transition-colors font-medium">Crochet & Knitting</a>
                  <a href="/buyer/category.html?slug=jewellery" class="px-4 py-2 bg-[#E6E2D8]/40 hover:bg-[#255338]/10 text-[#255338] text-sm rounded-full transition-colors font-medium">Jewellery</a>
                  <a href="/buyer/category.html?slug=ceramics-pottery" class="px-4 py-2 bg-[#E6E2D8]/40 hover:bg-[#255338]/10 text-[#255338] text-sm rounded-full transition-colors font-medium">Ceramics</a>
                  <a href="/buyer/category.html?slug=candles-fragrance" class="px-4 py-2 bg-[#E6E2D8]/40 hover:bg-[#255338]/10 text-[#255338] text-sm rounded-full transition-colors font-medium">Candles</a>
                </div>
              </div>
              
              <div id="global-search-recents-section" class="hidden">
                <div class="flex justify-between items-center mb-2">
                  <h4 class="text-xs font-semibold tracking-wider text-[#74786f] uppercase">Recent Searches</h4>
                  <button id="global-search-clear-recents" class="text-xs text-[#255338] hover:underline">Clear all</button>
                </div>
                <div id="global-search-recents-list" class="divide-y divide-[#C1C9C0]/30 border border-[#C1C9C0]/30 rounded-xl overflow-hidden bg-white"></div>
              </div>
            </div>
            
            <!-- Dynamic Autocomplete Results -->
            <div id="global-search-typing" class="hidden space-y-6">
              <div id="global-suggestions-list" class="divide-y divide-[#C1C9C0]/30"></div>
              
              <div id="global-sellers-section" class="hidden">
                <h4 class="text-xs font-semibold tracking-wider text-[#74786f] uppercase mb-3">Artisans</h4>
                <div id="global-sellers-list" class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"></div>
              </div>
              
              <div id="global-categories-section" class="hidden">
                <h4 class="text-xs font-semibold tracking-wider text-[#74786f] uppercase mb-3">Categories</h4>
                <div id="global-categories-list" class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"></div>
              </div>
            </div>

            <!-- Full Product Grid Results -->
            <div id="global-search-results-view" class="hidden space-y-4">
              <div class="flex justify-between items-center border-b border-[#C1C9C0]/30 pb-2">
                <h3 id="global-results-title" class="font-['Playfair_Display'] text-lg text-[#255338] italic font-semibold">Search Results</h3>
                <span id="global-results-count" class="text-xs text-[#74786f]"></span>
              </div>
              
              <div id="global-results-loader" class="hidden flex flex-col items-center justify-center py-10">
                <div class="relative w-8 h-8">
                  <div class="absolute inset-0 border-4 border-[#255338]/10 rounded-full"></div>
                  <div class="absolute inset-0 border-4 border-[#255338] border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p class="mt-2 text-[#74786f] text-xs italic">Gathering handcrafted items...</p>
              </div>

              <div id="global-results-grid" class="grid grid-cols-2 gap-4 max-h-[45vh] overflow-y-auto p-1"></div>
              
              <div id="global-no-results" class="hidden text-center py-10 space-y-2">
                <span class="material-symbols-outlined text-4xl text-[#74786f]">sentiment_dissatisfied</span>
                <p class="text-sm font-medium text-[#1f1b15]">No products found matching that query.</p>
                <p class="text-xs text-[#74786f]">Try searching for different terms or browse categories.</p>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', overlayMarkup);

    this.overlay = document.getElementById('global-search-overlay');
    this.scrim = document.getElementById('global-search-scrim');
    this.card = document.getElementById('global-search-card');
    this.input = document.getElementById('global-search-input');
    this.clearBtn = document.getElementById('global-search-clear');
    this.closeBtn = document.getElementById('global-search-close');
    this.resultsContainer = document.getElementById('global-search-results');
  }

  bindEvents() {
    // Intercept clicks on search button in header
    document.addEventListener('click', (e) => {
      const searchBtn = e.target.closest('a[href="/buyer/categories.html"]');
      if (searchBtn && !searchBtn.closest('#global-search-overlay')) {
        // Prevent default navigation
        e.preventDefault();
        this.open();
      }
    });

    // Scrim click closes
    this.scrim.addEventListener('click', () => this.close());
    
    // Close button click closes
    this.closeBtn.addEventListener('click', () => this.close());

    // Input events
    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    // Clear input button
    this.clearBtn.addEventListener('click', () => {
      this.input.value = '';
      this.clearBtn.classList.add('hidden');
      this.showState('idle');
      this.input.focus();
    });

    // Clear recent searches
    const clearRecents = document.getElementById('global-search-clear-recents');
    if (clearRecents) {
      clearRecents.addEventListener('click', () => {
        localStorage.removeItem('global_recent_searches');
        this.renderRecentSearches();
      });
    }

    // Escape key closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    // Show overlay element container
    this.overlay.classList.remove('hidden');
    
    // Render latest recent searches
    this.renderRecentSearches();
    this.showState('idle');

    // Force reflow for transitions
    this.overlay.offsetHeight;

    // Transition animations in
    this.scrim.classList.remove('opacity-0');
    this.scrim.classList.add('opacity-100');
    this.card.classList.remove('scale-95', 'opacity-0', '-translate-y-5');
    this.card.classList.add('scale-100', 'opacity-100', 'translate-y-0');

    // Focus immediately
    setTimeout(() => {
      this.input.focus();
    }, 100);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    // Transition animations out
    this.scrim.classList.remove('opacity-100');
    this.scrim.classList.add('opacity-0');
    this.card.classList.remove('scale-100', 'opacity-100', 'translate-y-0');
    this.card.classList.add('scale-95', 'opacity-0', '-translate-y-5');

    // Hide overlay container after transitions finish
    setTimeout(() => {
      if (!this.isOpen) {
        this.overlay.classList.add('hidden');
        this.input.value = '';
        this.clearBtn.classList.add('hidden');
      }
    }, 300);
  }

  showState(stateName) {
    const idleView = document.getElementById('global-search-idle');
    const typingView = document.getElementById('global-search-typing');
    const resultsView = document.getElementById('global-search-results-view');

    if (stateName === 'idle') {
      idleView.classList.remove('hidden');
      typingView.classList.add('hidden');
      resultsView.classList.add('hidden');
      this.clearBtn.classList.add('hidden');
    } else if (stateName === 'typing') {
      idleView.classList.add('hidden');
      typingView.classList.remove('hidden');
      resultsView.classList.add('hidden');
      this.clearBtn.classList.remove('hidden');
    } else if (stateName === 'results') {
      idleView.classList.add('hidden');
      typingView.classList.add('hidden');
      resultsView.classList.remove('hidden');
      this.clearBtn.classList.remove('hidden');
    }
  }

  handleInput() {
    const val = this.input.value.trim();
    if (val === '') {
      this.showState('idle');
      return;
    }

    this.showState('typing');

    // Debounce suggestion calls
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(async () => {
      try {
        const res = await apiClient.get('/products/search-suggestions', { params: { q: val } });
        if (res.data && res.data.success) {
          this.renderSuggestions(res.data.data, val);
        }
      } catch (err) {
        console.error("Global suggestions fetch error:", err);
      }
    }, 300);
  }

  handleKeydown(e) {
    if (e.key === 'Enter') {
      const query = this.input.value.trim();
      if (query) {
        this.executeSearch(query);
      }
    }
  }

  renderRecentSearches() {
    const recentsSection = document.getElementById('global-search-recents-section');
    const recentsList = document.getElementById('global-search-recents-list');
    if (!recentsSection || !recentsList) return;

    const searches = JSON.parse(localStorage.getItem('global_recent_searches') || '[]');
    if (searches.length === 0) {
      recentsSection.classList.add('hidden');
      return;
    }

    recentsSection.classList.remove('hidden');
    recentsList.innerHTML = searches.map(s => `
      <div class="recent-search-row flex items-center justify-between p-3 hover:bg-[#255338]/5 transition-colors cursor-pointer group" data-query="${s}">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-[#74786f] group-hover:text-[#255338]">history</span>
          <span class="text-sm text-[#1f1b15] font-medium">${s}</span>
        </div>
        <span class="material-symbols-outlined text-[#74786f] text-sm opacity-0 group-hover:opacity-100 transition-opacity">north_east</span>
      </div>
    `).join('');

    // Bind clicks to execute search
    recentsList.querySelectorAll('.recent-search-row').forEach(row => {
      row.addEventListener('click', () => {
        const q = row.getAttribute('data-query');
        this.input.value = q;
        this.executeSearch(q);
      });
    });
  }

  saveRecentSearch(query) {
    let searches = JSON.parse(localStorage.getItem('global_recent_searches') || '[]');
    searches = searches.filter(s => s !== query);
    searches.unshift(query);
    searches = searches.slice(0, 5); // Keep top 5
    localStorage.setItem('global_recent_searches', JSON.stringify(searches));
  }

  highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<strong class="text-[#255338] font-semibold">$1</strong>');
  }

  renderSuggestions(data, query) {
    const { suggestions, sellers, categories } = data;
    const suggestionsList = document.getElementById('global-suggestions-list');
    
    // 1. Text suggestions
    if (suggestions.length === 0 && sellers.length === 0 && categories.length === 0) {
      suggestionsList.innerHTML = `
        <div class="py-4 text-[#74786f] italic text-sm text-center">
          No matches found... press Enter to search anyway.
        </div>
      `;
      document.getElementById('global-sellers-section').classList.add('hidden');
      document.getElementById('global-categories-section').classList.add('hidden');
      return;
    }

    suggestionsList.innerHTML = suggestions.slice(0, 5).map(s => {
      const highlighted = this.highlightMatch(s, query);
      return `
        <div class="suggestion-row py-3 flex items-center justify-between hover:bg-[#255338]/5 transition-colors cursor-pointer group" data-suggestion="${s}">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-[#74786f] group-hover:text-[#255338]">search</span>
            <p class="text-sm text-[#1f1b15] font-medium">${highlighted}</p>
          </div>
          <span class="material-symbols-outlined text-[#74786f] text-sm opacity-0 group-hover:opacity-100 transition-opacity">north_east</span>
        </div>
      `;
    }).join('');

    // Bind suggestion clicks
    suggestionsList.querySelectorAll('.suggestion-row').forEach(row => {
      row.addEventListener('click', () => {
        const val = row.getAttribute('data-suggestion');
        this.input.value = val;
        this.executeSearch(val);
      });
    });

    // 2. Sellers (Artisans)
    const sellersSection = document.getElementById('global-sellers-section');
    const sellersList = document.getElementById('global-sellers-list');
    if (sellers.length > 0) {
      sellersSection.classList.remove('hidden');
      sellersList.innerHTML = sellers.map(s => `
        <a href="/buyer/seller-profile.html?id=${s.id}" class="flex flex-col items-center flex-shrink-0 w-20 text-center hover:scale-105 transition-transform duration-200">
          <img src="${s.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuA1MlCvGNVC5kb3_0adXisBIXKR2kO5rDi5REC7Ws_jdqAl-d9k85WtM1zhT8kPt7miefUL2zB7ZWlht6gOBoOFf_yaM44xEDS_XDmP2CC3-O2XtWEbyNWU5d0aYrxHES2zAVOb4to55ZXc0JuEuYUxljiCZtgqH9k3hGJLepqGwKKZZmnmigxFXREVk5a9jUDkeBzDkZX8Z9jT_im_tJi4_Y8YVc3tbxMsxYFYLwpSOJOXUuN4y3YO7VUkGCQmkVDabJ6ip82gLbE'}" class="w-12 h-12 rounded-full border border-[#C1C9C0] object-cover">
          <p class="text-[11px] text-[#1f1b15] font-semibold truncate w-full mt-1">${s.shop_name || s.username}</p>
        </a>
      `).join('');
    } else {
      sellersSection.classList.add('hidden');
    }

    // 3. Categories
    const categoriesSection = document.getElementById('global-categories-section');
    const categoriesList = document.getElementById('global-categories-list');
    if (categories.length > 0) {
      categoriesSection.classList.remove('hidden');
      categoriesList.innerHTML = categories.map(c => `
        <a href="/buyer/category.html?slug=${c.slug}" class="flex items-center gap-2 px-3 py-1.5 border border-[#C1C9C0]/50 rounded-full hover:bg-[#255338]/5 hover:border-[#255338] transition-colors text-xs text-[#255338] font-semibold flex-shrink-0">
          <span class="material-symbols-outlined text-[14px]">category</span>
          <span>${c.name}</span>
        </a>
      `).join('');
    } else {
      categoriesSection.classList.add('hidden');
    }
  }

  async executeSearch(query) {
    if (!query || query.trim() === '') return;
    query = query.trim();
    this.saveRecentSearch(query);
    this.showState('results');

    const resultsTitle = document.getElementById('global-results-title');
    const resultsCount = document.getElementById('global-results-count');
    const resultsLoader = document.getElementById('global-results-loader');
    const resultsGrid = document.getElementById('global-results-grid');
    const noResults = document.getElementById('global-no-results');

    resultsTitle.innerText = `Search Results for "${query}"`;
    resultsCount.innerText = 'Finding items...';
    resultsLoader.classList.remove('hidden');
    resultsGrid.classList.add('hidden');
    noResults.classList.add('hidden');

    try {
      const res = await apiClient.get('/products/search', { params: { q: query, limit: 12 } });
      resultsLoader.classList.add('hidden');
      
      if (res.data && res.data.success) {
        const products = res.data.data.products || [];
        resultsCount.innerText = `${products.length} items found`;
        
        if (products.length === 0) {
          noResults.classList.remove('hidden');
          resultsGrid.innerHTML = '';
        } else {
          resultsGrid.classList.remove('hidden');
          resultsGrid.innerHTML = products.map(p => `
            <a href="/buyer/product.html?id=${p.id}" class="flex gap-3 p-2 border border-[#C1C9C0]/30 rounded-xl hover:bg-[#255338]/5 hover:border-[#255338]/50 transition-all duration-200">
              <img src="${p.image_url || 'https://placehold.co/100x100?text=Item'}" class="w-16 h-16 rounded-lg object-cover bg-white border border-[#C1C9C0]/20 flex-shrink-0">
              <div class="flex-1 min-w-0 flex flex-col justify-center">
                <h4 class="text-xs font-semibold text-[#255338] truncate leading-tight">${p.name}</h4>
                <p class="text-[10px] text-[#74786f] truncate mt-0.5">By ${p.seller_name || 'Artisan'}</p>
                <p class="text-xs font-bold text-[#1f1b15] mt-1">₹${p.price}</p>
              </div>
            </a>
          `).join('');
        }
      } else {
        noResults.classList.remove('hidden');
      }
    } catch (err) {
      console.error("Execute search error:", err);
      resultsLoader.classList.add('hidden');
      noResults.classList.remove('hidden');
    }
  }
}

// Bind method to class instance so executeSearch runs properly
SearchOverlay.prototype.executeSearch = SearchOverlay.prototype.executeSearch;

let searchOverlayInstance = null;

export function initSearchOverlay() {
  if (!searchOverlayInstance) {
    searchOverlayInstance = new SearchOverlay();
  }
  return searchOverlayInstance;
}
