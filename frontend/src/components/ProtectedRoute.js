// ProtectedRoute.js — Client-side route guarding
(function() {
  const path = window.location.pathname;
  
  // Admin routes guard
  if (path.startsWith('/admin/') && !path.includes('/admin/login.html')) {
    const adminToken = sessionStorage.getItem('tohfa_admin_token');
    if (!adminToken) {
      window.location.replace('/admin/login.html');
      return;
    }
  }
  
  // Seller routes guard
  if (path.startsWith('/seller/')) {
    const token = sessionStorage.getItem('tohfa_access_token');
    if (!token) {
      window.location.replace('/auth/login.html');
      return;
    }
    const userStr = sessionStorage.getItem('tohfa_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role !== 'seller') {
          window.location.replace('/buyer/profile.html');
          return;
        }
      } catch (e) {
        window.location.replace('/auth/login.html');
        return;
      }
    }
  }

  // Buyer routes guard
  if (path.startsWith('/buyer/')) {
    const token = sessionStorage.getItem('tohfa_access_token');
    if (!token) {
      window.location.replace('/auth/login.html');
      return;
    }
  }
})();
