// Toast.js — Global Vanilla JS Toast Component
export default class Toast {
  static show(message, type = 'success') {
    let container = document.getElementById('global-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'global-toast-container';
      container.style.position = 'fixed';
      container.style.top = '24px';
      container.style.right = '24px';
      container.style.zIndex = '9999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '12px';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.color = '#FFFFFF';
    toast.style.transition = 'all 0.3s ease';
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';

    if (type === 'success') {
      toast.style.backgroundColor = '#255338'; // Tohfa primary
      toast.style.border = '1px solid #3d6b4f';
    } else if (type === 'error') {
      toast.style.backgroundColor = '#ba1a1a'; // Tohfa error
      toast.style.border = '1px solid #ffdad6';
    } else {
      toast.style.backgroundColor = '#49663f'; // Secondary
      toast.style.border = '1px solid #caecbb';
    }

    toast.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 20px; font-variation-settings: 'FILL' 1;">
        ${type === 'success' ? 'check_circle' : 'error'}
      </span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    // Slide in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    }, 10);

    // Slide out and remove
    setTimeout(() => {
      toast.style.transform = 'translateX(120%)';
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      }, 300);
    }, 3500);
  }
}

// Bind to window for global access
window.Toast = Toast;
window.showToast = Toast.show;
