// Tohfa Seller Studio Unified Components

// Inject design system tokens (font family, colors) programmatically
(function injectGlobalStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Global layout design overrides */
    body, html {
      background-color: #F7F3EC !important;
      font-family: 'DM Sans', sans-serif !important;
      color: #1A1A1A !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    /* Ensure heading typography consistency */
    h1, h2, h3, h4, h5, h6, .font-headline, .font-headline-lg, .font-headline-md, .font-headline-sm {
      font-family: 'Playfair Display', serif !important;
    }

    /* Scrollbar customization */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #E8E2D9;
      border-radius: 10px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #C1C9C0;
    }

    /* Component specific classes */
    .sidebar-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 10px;
      padding-bottom: 10px;
      color: #6B6B6B;
      font-weight: 500;
      transition: all 0.2s ease-in-out;
    }
    .sidebar-link:hover {
      background-color: rgba(143, 175, 130, 0.15) !important;
      color: #1A1A1A !important;
    }
    .sidebar-link-active {
      background-color: #3D6B4F !important;
      color: #FFFFFF !important;
      font-weight: 700 !important;
    }
    .sidebar-link-active span {
      color: #FFFFFF !important;
    }

    /* CSS layout overrides to prevent vertical white spaces and horizontal offsets */
    seller-layout {
      display: block !important;
      width: 100% !important;
      min-height: 100vh !important;
      background-color: #F7F3EC !important;
    }

    .seller-layout-container {
      display: flex !important;
      min-height: 100vh !important;
      width: 100% !important;
      background-color: #F7F3EC !important;
    }

    seller-sidebar {
      display: block !important;
      width: 130px !important;
      flex-shrink: 0 !important;
      z-index: 50 !important;
    }

    .seller-main-panel {
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      min-width: 0 !important;
      margin-left: 130px !important;
      position: relative !important;
      background-color: #F7F3EC !important;
      padding: 32px 64px 64px 64px !important;
    }

    seller-topbar {
      display: block !important;
      height: 64px !important;
      width: 100% !important;
      flex-shrink: 0 !important;
      z-index: 40 !important;
    }

    .seller-topbar-header {
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      left: 130px !important;
      height: 64px !important;
      background-color: #FFFFFF !important;
      border-bottom: 1px solid #E8E2D9 !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding-left: 64px !important;
      padding-right: 64px !important;
      z-index: 40 !important;
    }
  `;
  document.head.appendChild(style);
})();

class SellerSidebar extends HTMLElement {
  connectedCallback() {
    const activeTab = this.getAttribute('active-tab') || '';
    
    this.innerHTML = `
      <aside class="w-[130px] h-screen fixed left-0 top-0 bg-white border-r border-[#E8E2D9] shadow-sm flex flex-col py-8 z-50 overflow-y-auto custom-scrollbar font-['DM_Sans'] text-[#6B6B6B]">
        <!-- Brand Logo Header -->
        <div class="px-4 mb-8 flex flex-col items-center">
          <img alt="TOFA Logo" class="w-12 h-12 mb-3 rounded-full border border-[#E8E2D9]" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKjQjmSoJKqFl-kRbAH85_u94nMS-Ok8oPnG2PAsYIPao9rA7dhGe8UxdJrc2ZZAzrwZNabbn59QVEgS7BBnW9tgfg43AOgPPepQuKoNu9Y8LnAgELFnunu7fN4ziKFD3utWMnD1wUchu7IL5DN5S8YIbb4t6eImmC8IYIbyaXgktzANbK3Bp9S-uJUoxNyfKN0-3CdY6CCeB0ICMb4og8ToBCMSoIyIF4u5UejdhA3mwODAny-lA6K9JdMJHT5Qhp3buD-BTaEM0">
          <h1 class="font-['Playfair_Display'] font-bold text-[14px] text-center leading-tight text-[#1A1A1A]">Tohfa Studio</h1>
        </div>
        
        <!-- Navigation Links (Inventory removed completely) -->
        <nav class="flex-1 space-y-1">
          <!-- Home (Dashboard) -->
          <a class="sidebar-link \${activeTab === 'home' ? 'sidebar-link-active' : ''}" href="/seller/dashboard.html" id="sidebar-home" title="Home">
            <span class="material-symbols-outlined mb-1 text-2xl">home</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Home</span>
          </a>
          <!-- Catalog -->
          <a class="sidebar-link \${activeTab === 'catalog' ? 'sidebar-link-active' : ''}" href="/seller/catalog.html" id="sidebar-catalog" title="Catalog">
            <span class="material-symbols-outlined mb-1 text-2xl">library_books</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Catalog</span>
          </a>
          <!-- Orders -->
          <a class="sidebar-link \${activeTab === 'orders' ? 'sidebar-link-active' : ''}" href="/seller/orders.html" id="sidebar-orders" title="Orders">
            <span class="material-symbols-outlined mb-1 text-2xl">shopping_basket</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Orders</span>
          </a>
          <!-- Capacity -->
          <a class="sidebar-link \${activeTab === 'capacity' ? 'sidebar-link-active' : ''}" href="/seller/production-planner.html" id="sidebar-capacity" title="Capacity">
            <span class="material-symbols-outlined mb-1 text-2xl">pending_actions</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Capacity</span>
          </a>
          <!-- Payments (Payouts) -->
          <a class="sidebar-link \${activeTab === 'payments' ? 'sidebar-link-active' : ''}" href="/seller/payouts.html" id="sidebar-payments" title="Payments">
            <span class="material-symbols-outlined mb-1 text-2xl">payments</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Payments</span>
          </a>
          <!-- Analytics -->
          <a class="sidebar-link \${activeTab === 'analytics' ? 'sidebar-link-active' : ''}" href="/seller/analytics.html" id="sidebar-analytics" title="Analytics">
            <span class="material-symbols-outlined mb-1 text-2xl">insights</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Analytics</span>
          </a>
          <!-- Messages -->
          <a class="sidebar-link \${activeTab === 'messages' ? 'sidebar-link-active' : ''}" href="/seller/messages.html" id="sidebar-messages" title="Messages">
            <span class="material-symbols-outlined mb-1 text-2xl">chat_bubble</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Messages</span>
          </a>
          <!-- Reviews -->
          <a class="sidebar-link \${activeTab === 'reviews' ? 'sidebar-link-active' : ''}" href="/seller/reviews.html" id="sidebar-reviews" title="Reviews">
            <span class="material-symbols-outlined mb-1 text-2xl">reviews</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Reviews</span>
          </a>
          <!-- Reels -->
          <a class="sidebar-link \${activeTab === 'reels' ? 'sidebar-link-active' : ''}" href="/seller/upload-reel.html" id="sidebar-reels" title="Reels">
            <span class="material-symbols-outlined mb-1 text-2xl">movie</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Reels</span>
          </a>
          <!-- Config / Settings -->
          <a class="sidebar-link \${activeTab === 'config' ? 'sidebar-link-active' : ''}" href="/seller/store-config.html" id="sidebar-config" title="Settings">
            <span class="material-symbols-outlined mb-1 text-2xl">settings</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Settings</span>
          </a>
          <!-- Profile -->
          <a class="sidebar-link \${activeTab === 'profile' ? 'sidebar-link-active' : ''}" href="/seller/profile.html" id="sidebar-profile" title="Profile">
            <span class="material-symbols-outlined mb-1 text-2xl">account_circle</span>
            <span class="text-[9px] uppercase tracking-widest text-center">Profile</span>
          </a>
        </nav>
        
        <!-- Footer actions -->
        <div class="px-3 mt-auto pt-6 space-y-2 w-full">
          <button id="view-store-btn" class="w-full py-2 bg-[#C8973A] text-white rounded-lg font-['DM_Sans'] font-medium text-[10px] uppercase tracking-tight hover:opacity-90 transition-all shadow-sm">
            View Store
          </button>
          <button id="logout-btn" class="w-full py-2 bg-[#ba1a1a] text-white rounded-lg font-['DM_Sans'] font-medium text-[10px] uppercase tracking-tight hover:opacity-90 transition-all shadow-sm">
            Logout
          </button>
        </div>
      </aside>
    `;

    // Hook up view store action
    const viewStoreBtn = this.querySelector('#view-store-btn');
    if (viewStoreBtn) {
      viewStoreBtn.addEventListener('click', () => {
        const token = sessionStorage.getItem('tohfa_access_token') || sessionStorage.getItem('access_token');
        fetch(`/api/seller/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          const profileData = data.data || data;
          if (profileData && profileData.handle) {
            window.location.href = `/store/${profileData.handle}`;
          } else if (profileData && profileData.store_slug) {
            window.location.href = `/${profileData.store_slug}`;
          } else {
            window.location.href = '/';
          }
        })
        .catch(err => {
          console.error('Error viewing store:', err);
          window.location.href = '/';
        });
      });
    }

    // Hook up logout action
    const logoutBtn = this.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        const token = sessionStorage.getItem('tohfa_access_token') || sessionStorage.getItem('access_token');
        const refresh = sessionStorage.getItem('tohfa_refresh_token') || sessionStorage.getItem('refresh_token');
        if (token && refresh) {
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ refresh_token: refresh })
          }).catch(() => {});
        }
        sessionStorage.clear();
        window.location.href = '/auth/login.html';
      });
    }
  }
}

class SellerTopBar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="seller-topbar-header font-['DM_Sans']">
        <!-- Left Side: Tohfa branding -->
        <div class="flex items-center gap-3">
          <a href="/seller/dashboard.html" class="flex items-center gap-2">
            <span class="font-['Playfair_Display'] text-[20px] font-bold italic text-[#3D6B4F]">Tohfa</span>
            <span class="font-['DM_Sans'] text-xs uppercase tracking-widest text-[#6B6B6B] border-l border-[#E8E2D9] pl-3 py-1">Seller Studio</span>
          </a>
        </div>
        
        <!-- Right Side: User Name + Avatar + ZAI Toggle -->
        <div class="flex items-center gap-6">
          <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#3D6B4F]/30 text-[#3D6B4F] text-[12px] font-bold hover:bg-[#3D6B4F]/10 transition-all shadow-sm" id="zai-toggle-btn">
            <span class="material-symbols-outlined text-[16px]" id="zai-toggle-icon">flutter_dash</span>
            ZAI Mode
          </button>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <p class="text-xs font-bold text-[#1A1A1A] line-clamp-1" id="topbar-seller-name">Loading...</p>
              <p class="text-[9px] text-[#6B6B6B] uppercase tracking-wider">Artisan Partner</p>
            </div>
            <div class="w-9 h-9 rounded-full overflow-hidden border border-[#E8E2D9] flex-shrink-0 bg-gray-50">
              <img id="sidebar-avatar" class="w-full h-full object-cover" src="https://ui-avatars.com/api/?name=Seller" alt="Avatar"/>
            </div>
          </div>
        </div>
      </header>
    `;

    const token = sessionStorage.getItem('tohfa_access_token') || sessionStorage.getItem('access_token');
    
    // ZAI toggle state management
    const updateZaiState = (enabled) => {
      const btn = this.querySelector('#zai-toggle-btn');
      const icon = this.querySelector('#zai-toggle-icon');
      const banner = document.getElementById('zai-tip-banner');
      
      if (btn && icon) {
        if (enabled) {
          btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#573b81] text-white text-[12px] font-bold transition-all shadow-sm';
          icon.style.fontVariationSettings = "'FILL' 1";
        } else {
          btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#573b81]/30 text-[#573b81] text-[12px] font-bold hover:bg-[#573b81]/10 transition-all shadow-sm';
          icon.style.fontVariationSettings = "'FILL' 0";
        }
      }
      
      if (banner) {
        const tipTextEl = document.getElementById('zai-tip-text');
        const hasText = tipTextEl && tipTextEl.textContent.trim() !== '' && tipTextEl.textContent.trim() !== '...';
        if (enabled && hasText) {
          banner.classList.remove('hidden');
        } else {
          banner.classList.add('hidden');
        }
      }
    };

    // Initial load from localStorage
    const initialEnabled = localStorage.getItem('zai_mode') === 'true';
    updateZaiState(initialEnabled);

    // ZAI Toggle Click Event
    const toggleBtn = this.querySelector('#zai-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isEnabled = localStorage.getItem('zai_mode') === 'true';
        const nextEnabled = !isEnabled;
        
        localStorage.setItem('zai_mode', nextEnabled ? 'true' : 'false');
        updateZaiState(nextEnabled);
        
        if (token) {
          fetch('/api/seller/zai-mode', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ enabled: nextEnabled })
          })
          .catch(err => console.error("Error toggling ZAI Mode:", err));
        }

        // Notify page scripts
        window.dispatchEvent(new CustomEvent('zai-mode-change', { detail: { enabled: nextEnabled } }));
      });
    }

    // Listen to changes from page-level toggle actions to keep synced
    window.addEventListener('zai-mode-change', (e) => {
      if (e.detail && typeof e.detail.enabled === 'boolean') {
        updateZaiState(e.detail.enabled);
      }
    });

    // Fetch profile and update display name and avatar dynamically
    if (token) {
      fetch('/api/seller/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(resp => {
        const profile = resp.data || resp;
        if (profile) {
          const nameEl = this.querySelector('#topbar-seller-name');
          const avatarEl = this.querySelector('#sidebar-avatar');
          if (nameEl) nameEl.textContent = profile.display_name || 'Artisan';
          if (avatarEl && profile.avatar_url) avatarEl.src = profile.avatar_url;
          
          const dbEnabled = !!profile.zai_mode_enabled;
          localStorage.setItem('zai_mode', dbEnabled ? 'true' : 'false');
          updateZaiState(dbEnabled);
        }
      })
      .catch(err => console.error("Error populating topbar profile details:", err));
    }
  }
}

class SellerLayout extends HTMLElement {
  connectedCallback() {
    const activeTab = this.getAttribute('active-tab') || '';

    const render = () => {
      // 1. Capture all existing child nodes (using Array.from to make a static copy)
      const children = Array.from(this.childNodes);

      // 2. Create the wrapper container
      const container = document.createElement('div');
      container.className = "seller-layout-container font-body-md text-[#1A1A1A]";

      // 3. Create the sidebar
      const sidebar = document.createElement('seller-sidebar');
      sidebar.setAttribute('active-tab', activeTab);

      // 4. Create the main panel wrapper
      const mainPanel = document.createElement('div');
      mainPanel.className = "seller-main-panel";

      // 5. Create the top bar
      const topbar = document.createElement('seller-topbar');

      // 6. Move all original child nodes directly into the mainPanel container
      mainPanel.appendChild(topbar);
      children.forEach(child => {
        mainPanel.appendChild(child);
      });

      // 7. Assemble the tree
      container.appendChild(sidebar);
      container.appendChild(mainPanel);

      // 8. Clear this custom element and append the new wrapped DOM structure
      this.innerHTML = '';
      this.appendChild(container);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', render, { once: true });
    } else {
      render();
    }
  }
}

// Register Custom Elements
customElements.define('seller-sidebar', SellerSidebar);
customElements.define('seller-topbar', SellerTopBar);
customElements.define('seller-layout', SellerLayout);
