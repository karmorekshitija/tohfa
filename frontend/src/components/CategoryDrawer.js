import apiClient from '../utils/apiClient.js';

export function initCategoryDrawer() {
  if (document.getElementById('category-drawer')) {
    setupListeners();
    return;
  }

  // 1. Inject Drawer & Backdrop
  const drawerHtml = `
    <div id="category-drawer" class="fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-[100] transform -translate-x-full transition-transform duration-300 ease-in-out border-r border-[#C1C9C0] flex flex-col font-['DM_Sans']">
      <div class="p-6 border-b border-[#C1C9C0] flex justify-between items-center bg-[#FCFAF5]">
        <div>
          <h3 class="font-['Playfair_Display'] text-2xl italic text-[#255338] select-none">Tohfa.</h3>
          <p class="text-[10px] text-outline tracking-wider uppercase mt-1">Explore Crafts</p>
        </div>
        <button id="close-category-drawer" class="text-secondary hover:text-primary transition-colors focus:outline-none p-1 rounded-full hover:bg-[#C1C9C0]/20 flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>
      <div id="category-list-container" class="flex-grow overflow-y-auto p-4 space-y-2">
        <div class="animate-pulse space-y-3 p-4">
          <div class="h-12 bg-slate-100 rounded-xl"></div>
          <div class="h-12 bg-slate-100 rounded-xl"></div>
          <div class="h-12 bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    </div>
    <div id="category-drawer-backdrop" class="fixed inset-0 bg-black/40 z-[90] hidden opacity-0 transition-opacity duration-300 ease-in-out"></div>
  `;

  document.body.insertAdjacentHTML('beforeend', drawerHtml);
  setupListeners();
  loadCategories();
}

function setupListeners() {
  const drawer = document.getElementById('category-drawer');
  const backdrop = document.getElementById('category-drawer-backdrop');
  const closeBtn = document.getElementById('close-category-drawer');

  // Trigger buttons (both desktop header tab and mobile bottom nav)
  const triggers = document.querySelectorAll('#nav-category-btn, .trigger-category-drawer, a[href="/buyer/category.html"], a[href="category.html"]');
  
  const openDrawer = (e) => {
    if (e) e.preventDefault();
    
    // Show backdrop
    backdrop.classList.remove('hidden');
    // Force reflow for transitions
    void backdrop.offsetWidth;
    backdrop.classList.remove('opacity-0');
    
    // Slide drawer in
    drawer.classList.remove('-translate-x-full');
  };

  const closeDrawer = () => {
    drawer.classList.add('-translate-x-full');
    backdrop.classList.add('opacity-0');
    setTimeout(() => {
      backdrop.classList.add('hidden');
    }, 300);
  };

  triggers.forEach(trigger => {
    // If it's a link to category page, we intercept it to show the drawer instead!
    // Except if we are already on category.html, in which case clicking category can still open drawer
    trigger.addEventListener('click', openDrawer);
  });

  closeBtn.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
}

async function loadCategories() {
  const container = document.getElementById('category-list-container');
  try {
    const res = await apiClient.get('/categories');
    if (res.data && res.data.success) {
      const categories = res.data.data.categories || [];
      
      if (categories.length === 0) {
        container.innerHTML = `<p class="text-center py-8 text-secondary text-sm">No categories found.</p>`;
        return;
      }

      container.innerHTML = categories.map(cat => {
        const emoji = cat.emoji_icon || cat.icon_emoji || '🏷️';
        const displayName = cat.display_name || cat.name;
        const count = cat.product_count !== undefined ? cat.product_count : (cat.item_count || 0);

        return `
          <button class="w-full flex items-center justify-between p-4 bg-[#FCFAF5] hover:bg-[#E8F0E4] active:scale-[0.98] border border-[#C1C9C0]/40 rounded-xl transition-all duration-200 group text-left" data-slug="${cat.slug}">
            <div class="flex items-center gap-4">
              <span class="text-2xl">${emoji}</span>
              <div>
                <p class="font-semibold text-primary group-hover:text-[#255338] transition-colors">${displayName}</p>
                <p class="text-xs text-outline">${count} active makes</p>
              </div>
            </div>
            <span class="material-symbols-outlined text-outline group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span>
          </button>
        `;
      }).join('');

      // Add click events to items
      container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const slug = btn.getAttribute('data-slug');
          window.location.href = `/buyer/category.html?slug=${slug}`;
        });
      });
    }
  } catch (err) {
    console.error("Failed to load categories in drawer:", err);
    container.innerHTML = `
      <div class="text-center py-8 text-error">
        <p class="text-sm font-semibold">Failed to load categories</p>
        <button id="retry-drawer-categories" class="mt-2 text-xs bg-primary text-white px-3 py-1.5 rounded-lg">Retry</button>
      </div>
    `;
    document.getElementById('retry-drawer-categories')?.addEventListener('click', loadCategories);
  }
}
