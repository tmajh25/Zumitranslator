/**
 * NAVIGATION CONTROLLER (SRP)
 * Manages sidebar navigation, panel switching, and sidebar collapsing
 */

const NavigationController = {
  init() {
    this.setupPanelNavigation();
    this.setupSidebarToggle();
  },

  setupPanelNavigation() {
    UI.elements.navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.panel === 'file' && item.classList.contains('active') && window.Bookshelf && Bookshelf.isDetailOpen) {
          Bookshelf.showList();
          return;
        }
        UI.showPanel(item.dataset.panel);
      });
    });
  },

  setupSidebarToggle() {
    const sidebar = UI.$('#sidebar');
    const toggleBtn = UI.$('#sidebarToggleBtn');
    if (!sidebar || !toggleBtn) return;

    // Restore preference
    if (localStorage.getItem('sidebar_collapsed') === 'true') {
      sidebar.classList.add('collapsed');
      toggleBtn.title = 'Mở rộng sidebar';
    }

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      toggleBtn.title = isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar';
      localStorage.setItem('sidebar_collapsed', isCollapsed);
    });
  }
};

window.NavigationController = NavigationController;
