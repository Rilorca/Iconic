// Tauri API invoke interface
const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.invoke;

// Application State
let appState = {
  currentSysTheme: '',
  selectedBaseTheme: '',
  tempSelectedBase: '',
  iconThemes: [],
  apps: [],
  systemItems: [],
  appIconMap: new Map(),     // key -> base64
  systemIconMap: new Map(),  // key -> base64
  overrides: new Map(),      // itemKey -> { match: ThemeIconMatch, app: AppEntry | SystemItem, isSystem: bool }
  activeView: 'apps-view',
  selectedApp: null,
  selectedVariant: null,
  showOnlyModified: false,
  isLoadingApps: false,
  systemFilter: 'all',
};

// UI Elements
const els = {
  themeToggle: document.getElementById('btn-theme-toggle'),
  btnSelectBaseTheme: document.getElementById('btn-select-base-theme'),
  headerBaseThemeName: document.getElementById('header-base-theme-name'),
  viewBtns: document.querySelectorAll('.adw-view-btn'),
  views: {
    'apps-view': document.getElementById('view-apps'),
    'system-view': document.getElementById('view-system'),
    'themes-view': document.getElementById('view-themes'),
    'mix-view': document.getElementById('view-mix'),
  },
  // Progress Bar & Loading Elements
  appLoadingBarContainer: document.getElementById('app-loading-bar-container'),
  appLoadingBar: document.getElementById('app-loading-bar'),
  appsLoadingBanner: document.getElementById('apps-loading-banner'),
  loadingStatusText: document.getElementById('loading-status-text'),
  loadingProgressPercentage: document.getElementById('loading-progress-percentage'),
  bannerProgressBar: document.getElementById('banner-progress-bar'),

  appsGrid: document.getElementById('apps-grid'),
  appSearchInput: document.getElementById('app-search-input'),
  btnRefreshApps: document.getElementById('btn-refresh-apps'),
  btnFilterModified: document.getElementById('btn-filter-modified'),
  customizedCount: document.getElementById('customized-count'),
  overrideCountTab: document.getElementById('override-count-tab'),

  // System items view
  systemGrid: document.getElementById('system-grid'),
  systemSearchInput: document.getElementById('system-search-input'),
  btnSysFilters: document.querySelectorAll('.btn-sys-filter'),

  themesGrid: document.getElementById('themes-grid'),
  themeSearchInput: document.getElementById('theme-search-input'),
  themeTotalCount: document.getElementById('theme-total-count'),

  // Mix View
  mixedThemeName: document.getElementById('mixed-theme-name'),
  mixedBaseSelect: document.getElementById('mixed-base-theme-select'),
  btnMixChangeBase: document.getElementById('btn-mix-change-base'),
  mixedBaseThemeLabel: document.getElementById('mixed-base-theme-label'),
  btnQuickSave: document.getElementById('btn-quick-save'),
  btnClearOverrides: document.getElementById('btn-clear-overrides'),
  mixGrid: document.getElementById('mix-grid'),
  mixEmptyPlaceholder: document.getElementById('mix-empty-placeholder'),

  // Base Theme Selection Modal
  baseThemeModal: document.getElementById('base-theme-modal'),
  btnCloseBaseModal: document.getElementById('btn-close-base-modal'),
  baseThemeSearch: document.getElementById('base-theme-search'),
  baseThemesGrid: document.getElementById('base-themes-grid'),
  baseSelectedHint: document.getElementById('base-selected-hint'),
  btnConfirmBaseTheme: document.getElementById('btn-confirm-base-theme'),

  // Export Modal
  btnExportTheme: document.getElementById('btn-export-theme'),
  exportModal: document.getElementById('export-modal'),
  btnCloseExportModal: document.getElementById('btn-close-export-modal'),
  btnCancelExport: document.getElementById('btn-cancel-export'),
  btnConfirmExport: document.getElementById('btn-confirm-export'),
  exportThemeNameInput: document.getElementById('export-theme-name-input'),
  exportBaseSelect: document.getElementById('export-base-select'),
  checkApplyImmediately: document.getElementById('check-apply-immediately'),

  // Icon Picker Modal
  iconModal: document.getElementById('icon-picker-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  modalAppTitle: document.getElementById('modal-app-title'),
  modalAppIconName: document.getElementById('modal-app-icon-name'),
  modalAppPreview: document.getElementById('modal-app-preview'),
  modalCustomSearchInput: document.getElementById('modal-custom-search-input'),
  btnModalSearchCustom: document.getElementById('btn-modal-search-custom'),
  modalVariantsLabel: document.getElementById('modal-variants-label'),
  variantsContainer: document.getElementById('variants-container'),
  modalLoadingIndicator: document.getElementById('modal-loading-indicator'),
  btnSelectForMixed: document.getElementById('btn-select-for-mixed'),
  btnDirectOverride: document.getElementById('btn-direct-override'),
  btnResetAppIcon: document.getElementById('btn-reset-app-icon'),

  // Toast
  toastContainer: document.getElementById('toast-container'),
};

// Adwaita Toast Notification
function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = 'adw-toast';
  if (isError) {
    toast.style.borderColor = 'var(--destructive)';
  }
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// Initialize Application
async function init() {
  loadSavedTheme();
  setupEventListeners();
  loadSavedOverrides();

  try {
    const currentTheme = await invoke('get_current_desktop_theme');
    appState.currentSysTheme = currentTheme;
    if (els.currentSysTheme) {
      els.currentSysTheme.textContent = `Tema actual: ${currentTheme}`;
    }
  } catch (err) {
    console.warn('Failed to get current desktop theme:', err);
  }

  await loadIconThemes();
  initializeBaseTheme();
  await loadApplications();
  await loadSystemItems();
}

function loadSavedTheme() {
  const saved = localStorage.getItem('icon_mixer_color_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

// Event Listeners
function setupEventListeners() {
  // Theme Toggle (Light / Dark)
  els.themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('icon_mixer_color_theme', next);
  });

  // View Switcher
  els.viewBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.viewBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.dataset.view;
      appState.activeView = target;

      Object.entries(els.views).forEach(([viewKey, viewEl]) => {
        if (viewEl) {
          viewEl.style.display = viewKey === target ? 'flex' : 'none';
        }
      });

      if (target === 'mix-view') {
        renderMixedView();
      } else if (target === 'system-view') {
        renderSystemItems();
      }
    });
  });

  // Search Inputs
  els.appSearchInput.addEventListener('input', () => renderApps());
  els.themeSearchInput.addEventListener('input', () => renderThemes());
  if (els.systemSearchInput) {
    els.systemSearchInput.addEventListener('input', () => renderSystemItems());
  }

  // System category filters
  els.btnSysFilters.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.btnSysFilters.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      appState.systemFilter = btn.dataset.filter;
      renderSystemItems();
    });
  });

  // Filter modified
  els.btnFilterModified.addEventListener('click', () => {
    appState.showOnlyModified = !appState.showOnlyModified;
    els.btnFilterModified.classList.toggle('suggested', appState.showOnlyModified);
    renderApps();
  });

  // Refresh
  els.btnRefreshApps.addEventListener('click', () => {
    if (appState.isLoadingApps) return;
    loadApplications();
    showToast('Recargando aplicaciones...');
  });

  // Quick Save in Mix View
  if (els.btnQuickSave) {
    els.btnQuickSave.addEventListener('click', async () => {
      await performExport(true);
    });
  }

  // Icon Modal Actions
  els.btnCloseModal.addEventListener('click', closeModal);
  els.iconModal.addEventListener('click', (e) => {
    if (e.target === els.iconModal) closeModal();
  });

  // Custom icon search within modal (e.g. search "discord" while editing "equibop")
  if (els.btnModalSearchCustom && els.modalCustomSearchInput) {
    const handleCustomSearch = () => {
      const q = els.modalCustomSearchInput.value.trim();
      if (q) {
        fetchAndRenderVariants(q, true);
      } else if (appState.selectedApp) {
        fetchAndRenderVariants(appState.selectedApp.icon_name, false);
      }
    };
    els.btnModalSearchCustom.addEventListener('click', handleCustomSearch);
    els.modalCustomSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCustomSearch();
      }
    });
  }

  els.btnSelectForMixed.addEventListener('click', () => {
    if (!appState.selectedApp || !appState.selectedVariant) {
      showToast('Selecciona una variante primero');
      return;
    }
    // Ensure target_app_icon is linked to this item's icon_name
    appState.selectedVariant.target_app_icon = appState.selectedApp.icon_name;

    const key = appState.selectedApp.file_name || appState.selectedApp.id;
    appState.overrides.set(key, {
      match: appState.selectedVariant,
      app: appState.selectedApp,
      isSystem: Boolean(appState.selectedApp.category),
    });
    saveOverrides();
    updateBadgeCounts();
    renderApps();
    renderSystemItems();
    closeModal();
    showToast(`Asignado a tema combinado: ${appState.selectedApp.name}`);
  });

  els.btnDirectOverride.addEventListener('click', async () => {
    if (!appState.selectedApp || !appState.selectedVariant) {
      showToast('Selecciona una variante primero');
      return;
    }
    if (!appState.selectedApp.file_name) {
      showToast('Las carpetas y tipos de archivos se configuran a través del Tema Combinado');
      return;
    }
    try {
      await invoke('override_single_app_icon', {
        desktopFileName: appState.selectedApp.file_name,
        newIconPath: appState.selectedVariant.icon_path,
      });
      showToast(`Icono modificado directamente en su .desktop`);
      appState.selectedApp.is_user_override = true;
      renderApps();
      closeModal();
    } catch (err) {
      showToast(`Error: ${err}`, true);
    }
  });

  els.btnResetAppIcon.addEventListener('click', async () => {
    if (!appState.selectedApp) return;
    const key = appState.selectedApp.file_name || appState.selectedApp.id;

    if (appState.selectedApp.file_name) {
      try {
        await invoke('restore_single_app_icon', {
          desktopFileName: appState.selectedApp.file_name,
        });
      } catch (err) {
        // continue to clear mix override
      }
      appState.selectedApp.is_user_override = false;
    }

    appState.overrides.delete(key);
    saveOverrides();
    updateBadgeCounts();
    renderApps();
    renderSystemItems();
    closeModal();
    showToast(`Icono restaurado a su valor original`);
  });

  // Export Modal Actions
  els.btnExportTheme.addEventListener('click', () => {
    populateExportSelect();
    els.exportModal.classList.add('active');
  });

  els.btnCloseExportModal.addEventListener('click', () => {
    els.exportModal.classList.remove('active');
  });
  els.btnCancelExport.addEventListener('click', () => {
    els.exportModal.classList.remove('active');
  });

  els.btnConfirmExport.addEventListener('click', async () => {
    await performExport(false);
  });

  els.btnClearOverrides.addEventListener('click', () => {
    if (confirm('¿Deseas vaciar todas las asignaciones del tema combinado actual?')) {
      appState.overrides.clear();
      saveOverrides();
      updateBadgeCounts();
      renderMixedView();
      renderApps();
      renderSystemItems();
      showToast('Selección de iconos vaciada');
    }
  });

  // Base Theme Modal Actions
  if (els.btnSelectBaseTheme) {
    els.btnSelectBaseTheme.addEventListener('click', openBaseThemeModal);
  }
  if (els.btnMixChangeBase) {
    els.btnMixChangeBase.addEventListener('click', openBaseThemeModal);
  }
  if (els.btnCloseBaseModal) {
    els.btnCloseBaseModal.addEventListener('click', closeBaseThemeModal);
  }
  if (els.btnConfirmBaseTheme) {
    els.btnConfirmBaseTheme.addEventListener('click', confirmBaseTheme);
  }
  if (els.baseThemeSearch) {
    els.baseThemeSearch.addEventListener('input', (e) => {
      renderBaseThemesGrid(e.target.value);
    });
  }
  if (els.baseThemeModal) {
    els.baseThemeModal.addEventListener('click', (e) => {
      if (e.target === els.baseThemeModal) {
        closeBaseThemeModal();
      }
    });
  }
}

// Base Theme Management
function openBaseThemeModal() {
  appState.tempSelectedBase = appState.selectedBaseTheme || getDefaultBaseTheme();
  renderBaseThemesGrid(els.baseThemeSearch ? els.baseThemeSearch.value : '');
  if (els.baseThemeModal) {
    els.baseThemeModal.classList.add('active');
  }
  if (els.baseThemeSearch) {
    els.baseThemeSearch.focus();
  }
}

function closeBaseThemeModal() {
  if (els.baseThemeModal) {
    els.baseThemeModal.classList.remove('active');
  }
}

function getDefaultBaseTheme() {
  const isCustom = (t) => t.comment && (t.comment.includes('Custom Iconic') || t.comment.includes('Custom Icon Mixer'));
  const realThemes = appState.iconThemes.filter(t => !isCustom(t));
  return realThemes.find(t => t.id === 'Papirus-Dark' || t.id === 'Papirus')?.id
    || realThemes.find(t => t.id.toLowerCase().includes('papirus'))?.id
    || realThemes.find(t => t.id.toLowerCase().includes('breeze'))?.id
    || realThemes[0]?.id
    || 'Papirus-Dark';
}

function renderBaseThemesGrid(searchFilter = '') {
  if (!els.baseThemesGrid) return;
  const query = searchFilter.toLowerCase().trim();
  const isCustom = (t) => t.comment && (t.comment.includes('Custom Iconic') || t.comment.includes('Custom Icon Mixer'));

  // Only show real icon themes as valid base themes (never custom mixes)
  const realThemes = appState.iconThemes.filter(t => !isCustom(t));
  const filtered = query
    ? realThemes.filter(t => t.name.toLowerCase().includes(query) || t.id.toLowerCase().includes(query))
    : realThemes;

  els.baseThemesGrid.innerHTML = '';

  if (filtered.length === 0) {
    els.baseThemesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-muted);">No se encontraron paquetes base con ese nombre</div>`;
    updateBaseConfirmState();
    return;
  }

  filtered.forEach(t => {
    const isSelected = t.id === appState.tempSelectedBase;
    const card = document.createElement('div');
    card.className = `base-theme-card ${isSelected ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="theme-icon">📦</div>
      <div class="app-info">
        <div class="app-name">${t.name}</div>
        <div class="app-desc" style="font-size: 11px;">${t.comment || t.id}</div>
        <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 3px;">
          ${t.is_user ? '👤 Instalado por usuario' : '🌐 Sistema (/usr)'}
        </div>
      </div>
      ${isSelected ? '<span style="color: var(--accent); font-weight: bold; font-size: 18px; margin-left: auto;">✓</span>' : ''}
    `;

    card.addEventListener('click', () => {
      appState.tempSelectedBase = t.id;
      document.querySelectorAll('.base-theme-card').forEach(c => {
        c.classList.remove('selected');
        const check = c.querySelector('span[style*="font-size: 18px"]');
        if (check) check.remove();
      });
      card.classList.add('selected');
      card.insertAdjacentHTML('beforeend', '<span style="color: var(--accent); font-weight: bold; font-size: 18px; margin-left: auto;">✓</span>');
      updateBaseConfirmState();
    });

    els.baseThemesGrid.appendChild(card);
  });

  updateBaseConfirmState();
}

function updateBaseConfirmState() {
  if (!els.baseSelectedHint || !els.btnConfirmBaseTheme) return;
  const selectedTheme = appState.iconThemes.find(t => t.id === appState.tempSelectedBase);
  if (selectedTheme) {
    els.baseSelectedHint.innerHTML = `Seleccionado: <b style="color: var(--accent);">${selectedTheme.name}</b>`;
    els.btnConfirmBaseTheme.disabled = false;
  } else {
    els.baseSelectedHint.textContent = 'Selecciona un pack para continuar';
    els.btnConfirmBaseTheme.disabled = true;
  }
}

async function confirmBaseTheme() {
  if (!appState.tempSelectedBase) return;
  await applyBaseThemeSelection(appState.tempSelectedBase, true);
  closeBaseThemeModal();
}

async function applyBaseThemeSelection(themeId, reloadPreviews = false) {
  const previousBase = appState.selectedBaseTheme;
  appState.selectedBaseTheme = themeId;
  localStorage.setItem('iconic_selected_base_theme', themeId);

  const themeObj = appState.iconThemes.find(t => t.id === themeId);
  const themeName = themeObj ? themeObj.name : themeId;

  if (els.headerBaseThemeName) {
    els.headerBaseThemeName.textContent = themeName;
  }
  if (els.mixedBaseThemeLabel) {
    els.mixedBaseThemeLabel.textContent = themeName;
  }
  if (els.mixedBaseSelect) {
    els.mixedBaseSelect.value = themeId;
  }
  if (els.exportBaseSelect) {
    els.exportBaseSelect.value = themeId;
  }

  if (reloadPreviews) {
    showToast(`Pack base establecido: ${themeName}`);
    if (previousBase !== themeId) {
      appState.appIconMap.clear();
      appState.systemIconMap.clear();
      await loadAppsIconsBatch(appState.apps);
      await loadSystemIconsBatch(appState.systemItems);
      renderApps();
      renderSystemItems();
    }
  }
}

function initializeBaseTheme() {
  const isCustom = (t) => t.comment && (t.comment.includes('Custom Iconic') || t.comment.includes('Custom Icon Mixer'));
  const savedBase = localStorage.getItem('iconic_selected_base_theme');
  const validBase = appState.iconThemes.find((t) => t.id === savedBase && !isCustom(t));

  if (validBase) {
    applyBaseThemeSelection(validBase.id, false);
  } else {
    const defaultId = getDefaultBaseTheme();
    applyBaseThemeSelection(defaultId, false);
    openBaseThemeModal();
  }
}

// Perform export / update of theme
async function performExport(isQuickSave = false) {
  const targetName = (isQuickSave ? els.mixedThemeName.value : els.exportThemeNameInput.value).trim() || 'Mi-Icon-Mix';
  const targetId = targetName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const baseTheme = appState.selectedBaseTheme || getDefaultBaseTheme();
  const applyImmediately = isQuickSave ? true : els.checkApplyImmediately.checked;

  const overridesList = Array.from(appState.overrides.values()).map((item) => {
    const m = { ...item.match };
    if (!m.target_app_icon) {
      m.target_app_icon = item.app.icon_name;
    }
    if (m.size === undefined) {
      m.size = null;
    }
    return m;
  });

  try {
    const result = await invoke('export_mixed_theme', {
      targetThemeId: targetId,
      targetThemeName: targetName,
      baseThemeId: baseTheme,
      overrides: overridesList,
      applyImmediately,
    });
    showToast(result);

    if (!isQuickSave) {
      els.exportModal.classList.remove('active');
    }

    if (applyImmediately) {
      appState.currentSysTheme = targetId;
    }

    // Refresh themes list & app icons cache
    await loadIconThemes();
    appState.appIconMap.clear();
    appState.systemIconMap.clear();
    await loadAppsIconsBatch(appState.apps);
    await loadSystemIconsBatch(appState.systemItems);
    renderApps();
    renderSystemItems();
  } catch (err) {
    showToast(`Error exportando tema: ${err}`, true);
  }
}

// Load Icon Themes
async function loadIconThemes() {
  try {
    const themes = await invoke('list_icon_themes');
    appState.iconThemes = themes;
    els.themeTotalCount.textContent = `${themes.length} paquetes instalados`;
    renderThemes();
  } catch (err) {
    showToast(`Error al listar temas: ${err}`, true);
  }
}

function populateExportSelect() {
  els.exportThemeNameInput.value = els.mixedThemeName.value.trim() || 'Mi-Icon-Mix';
  const themeObj = appState.iconThemes.find(t => t.id === appState.selectedBaseTheme);
  const themeName = themeObj ? themeObj.name : appState.selectedBaseTheme;
  if (els.exportBaseSelect) {
    els.exportBaseSelect.innerHTML = `<option value="${appState.selectedBaseTheme}" selected>${themeName} (${appState.selectedBaseTheme})</option>`;
  }
}

// Load Applications with Progress
async function loadApplications() {
  appState.isLoadingApps = true;
  els.appsGrid.innerHTML = '';
  els.appLoadingBarContainer.style.display = 'block';
  els.appLoadingBar.style.width = '0%';
  els.appsLoadingBanner.style.display = 'flex';
  els.loadingProgressPercentage.textContent = '0%';
  els.bannerProgressBar.style.width = '0%';
  els.loadingStatusText.textContent = 'Analizando aplicaciones instaladas...';

  try {
    const apps = await invoke('list_applications');
    appState.apps = apps;
    updateBadgeCounts();

    // Batch resolve icons in parallel chunks
    await loadAppsIconsBatch(apps);
  } catch (err) {
    showToast(`Error al cargar aplicaciones: ${err}`, true);
  } finally {
    appState.isLoadingApps = false;
    els.appLoadingBarContainer.style.display = 'none';
    els.appsLoadingBanner.style.display = 'none';
    renderApps();
  }
}

// Parallel Chunked Icon Resolver
async function loadAppsIconsBatch(apps) {
  const toLoad = apps.filter((a) => !appState.appIconMap.has(a.file_name));
  const total = toLoad.length;
  if (total === 0) return;

  const chunkSize = 25;
  let completed = 0;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = toLoad.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (app) => {
        try {
          const iconUri = await invoke('resolve_app_icon', {
            iconName: app.icon_name,
            themeId: appState.selectedBaseTheme || appState.currentSysTheme || null,
          });
          if (iconUri) {
            appState.appIconMap.set(app.file_name, iconUri);
          }
        } catch (e) {
          // fallback
        }
      })
    );

    completed += chunk.length;
    const progress = Math.min(100, Math.round((completed / total) * 100));
    els.appLoadingBar.style.width = `${progress}%`;
    els.bannerProgressBar.style.width = `${progress}%`;
    els.loadingProgressPercentage.textContent = `${progress}%`;
    els.loadingStatusText.textContent = `Cargando iconos (${completed} de ${total})...`;
  }
}

// Load System Items (Carpetas, Formatos, Dispositivos)
async function loadSystemItems() {
  try {
    const items = await invoke('list_system_items');
    appState.systemItems = items;
    await loadSystemIconsBatch(items);
    renderSystemItems();
  } catch (err) {
    console.warn('Failed to load system items:', err);
  }
}

async function loadSystemIconsBatch(items) {
  for (const it of items) {
    if (!appState.systemIconMap.has(it.id)) {
      try {
        const iconUri = await invoke('resolve_app_icon', {
          iconName: it.icon_name,
          themeId: appState.selectedBaseTheme || appState.currentSysTheme || null,
        });
        if (iconUri) {
          appState.systemIconMap.set(it.id, iconUri);
        }
      } catch (e) {
        // fallback
      }
    }
  }
}

// Render System Items View
function renderSystemItems() {
  if (!els.systemGrid) return;
  const query = (els.systemSearchInput ? els.systemSearchInput.value : '').toLowerCase().trim();

  let filtered = appState.systemItems.filter((it) => {
    const matchFilter = appState.systemFilter === 'all' || it.category === appState.systemFilter;
    const matchQuery =
      it.name.toLowerCase().includes(query) ||
      it.icon_name.toLowerCase().includes(query) ||
      it.description.toLowerCase().includes(query);
    return matchFilter && matchQuery;
  });

  els.systemGrid.innerHTML = '';
  if (filtered.length === 0) {
    els.systemGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No se encontraron elementos coincidentes</div>`;
    return;
  }

  filtered.forEach((it) => {
    const override = appState.overrides.get(it.id);
    const hasMix = Boolean(override);

    const iconSrc = hasMix
      ? override.match.icon_data
      : appState.systemIconMap.get(it.id) || '';

    const card = document.createElement('div');
    card.className = `adw-app-card ${hasMix ? 'has-override' : ''}`;
    card.innerHTML = `
      <div class="app-icon-preview">
        <img id="icon-sys-${CSS.escape(it.id)}" src="${iconSrc || ''}" alt="" onerror="this.style.display='none'" />
      </div>
      <div class="app-info">
        <div class="app-name">${it.name}</div>
        <div class="app-desc">${it.description}</div>
        <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
          <span style="font-size: 10px; color: var(--text-muted);">${it.category}</span>
          ${hasMix ? `<span class="badge-override">🎨 ${override.match.theme_name}</span>` : ''}
        </div>
      </div>
    `;

    card.addEventListener('click', () => openIconPicker(it));
    els.systemGrid.appendChild(card);
  });
}

// Render Themes
function renderThemes() {
  const query = els.themeSearchInput.value.toLowerCase().trim();
  const filtered = appState.iconThemes.filter(
    (t) => t.name.toLowerCase().includes(query) || t.id.toLowerCase().includes(query)
  );

  els.themesGrid.innerHTML = '';
  if (filtered.length === 0) {
    els.themesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No se encontraron paquetes de iconos</div>`;
    return;
  }

  filtered.forEach((t) => {
    const isCurrent = t.id === appState.currentSysTheme;
    const isCustomMixer = t.comment && (t.comment.includes('Custom Iconic theme') || t.comment.includes('Custom Icon Mixer theme'));

    const card = document.createElement('div');
    card.className = `adw-app-card ${isCurrent ? 'has-override' : ''}`;
    card.innerHTML = `
      <div class="app-icon-preview" style="background: ${isCustomMixer ? 'rgba(53, 132, 228, 0.18)' : 'rgba(255, 255, 255, 0.05)'}; color: var(--accent); font-size: 20px;">
        ${isCustomMixer ? '🎨' : '📦'}
      </div>
      <div class="app-info">
        <div class="app-name">
          ${t.name} ${isCurrent ? '<span style="color: var(--accent); font-size: 11px;">(Activo)</span>' : ''}
          ${isCustomMixer ? '<span class="badge-override" style="margin-left: 4px;">Tema Personalizado</span>' : ''}
        </div>
        <div class="app-desc">${t.comment || t.path}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
          ${t.is_user ? '👤 Instalado por usuario' : '🌐 Sistema (/usr)'}
        </div>
      </div>
      <div style="display: flex; gap: 6px; margin-left: auto;">
        ${isCustomMixer ? `<button class="adw-btn flat btn-edit-theme" title="Cargar este tema en el editor para seguir modificándolo">✏️ Editar</button>` : ''}
        <button class="adw-btn flat btn-open-folder" title="Abrir carpeta contenedora en el gestor de archivos">📂 Abrir</button>
        <button class="adw-btn flat btn-apply-theme" title="Establecer como tema actual del sistema">
          ${isCurrent ? '✓ Activo' : 'Activar'}
        </button>
        <button class="adw-btn flat btn-delete-theme" style="color: var(--destructive);" title="Eliminar este paquete de iconos">🗑️</button>
      </div>
    `;

    // Open Folder
    card.querySelector('.btn-open-folder').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await invoke('open_theme_folder', { themePath: t.path });
      } catch (err) {
        showToast(`Error al abrir carpeta: ${err}`, true);
      }
    });

    // Apply button
    card.querySelector('.btn-apply-theme').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await invoke('set_current_desktop_theme', { themeName: t.id });
        appState.currentSysTheme = t.id;
        if (els.currentSysTheme) {
          els.currentSysTheme.textContent = `Tema actual: ${t.id}`;
        }
        showToast(`Tema aplicado: ${t.name}`);
        renderThemes();
        appState.appIconMap.clear();
        appState.systemIconMap.clear();
        await loadAppsIconsBatch(appState.apps);
        await loadSystemIconsBatch(appState.systemItems);
        renderApps();
        renderSystemItems();
      } catch (err) {
        showToast(`Error al aplicar tema: ${err}`, true);
      }
    });

    // Edit button for custom themes
    if (isCustomMixer) {
      const editBtn = card.querySelector('.btn-edit-theme');
      if (editBtn) {
        editBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await loadThemeForEditing(t.id);
        });
      }
    }

    // Delete button for any icon theme (User or System)
    const deleteBtn = card.querySelector('.btn-delete-theme');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const msg = t.is_user
          ? `¿Eliminar el paquete de iconos "${t.name}" del sistema?`
          : `"${t.name}" es un paquete de sistema (/usr). Para eliminarlo se requerirá autorización de administrador (pkexec). ¿Deseas continuar?`;

        if (confirm(msg)) {
          try {
            const res = await invoke('delete_icon_theme', { themePath: t.path });
            showToast(res);
            await loadIconThemes();
          } catch (err) {
            showToast(`Error: ${err}`, true);
          }
        }
      });
    }

    els.themesGrid.appendChild(card);
  });
}

// Load an existing custom mixed theme into the editor
async function loadThemeForEditing(themeId) {
  try {
    const profile = await invoke('load_mixed_theme_overrides', { themeId });
    els.mixedThemeName.value = profile.target_theme_name;
    els.mixedBaseSelect.value = profile.base_theme;

    // Map overrides back to apps or system items if matching
    appState.overrides.clear();
    for (const [iconStem, appOv] of Object.entries(profile.overrides)) {
      // Find matching app or system item
      const matchedApp = appState.apps.find((a) => a.icon_name.toLowerCase() === iconStem.toLowerCase());
      const matchedSys = appState.systemItems.find((s) => s.icon_name.toLowerCase() === iconStem.toLowerCase());

      const targetItem = matchedApp || matchedSys;
      if (targetItem) {
        const uri = await invoke('resolve_app_icon', {
          iconName: targetItem.icon_name,
          themeId: themeId,
        });

        const key = targetItem.file_name || targetItem.id;
        appState.overrides.set(key, {
          match: {
            theme_id: themeId,
            theme_name: profile.target_theme_name,
            icon_path: appOv.icon_path,
            icon_format: appOv.icon_path.endsWith('.svg') ? 'svg' : 'png',
            icon_data: uri || '',
            target_app_icon: targetItem.icon_name,
            size: appOv.icon_path.endsWith('.svg') ? 'Vectorial (SVG)' : 'Raster',
          },
          app: targetItem,
          isSystem: Boolean(targetItem.category),
        });
      }
    }

    saveOverrides();
    updateBadgeCounts();

    // Switch to mix-view tab
    document.querySelector('.adw-view-btn[data-view="mix-view"]').click();
    showToast(`Tema "${profile.target_theme_name}" cargado en el editor`);
  } catch (err) {
    showToast(`Error al cargar tema: ${err}`, true);
  }
}

// Render Applications
function renderApps() {
  if (appState.isLoadingApps) return;

  const query = els.appSearchInput.value.toLowerCase().trim();
  let filtered = appState.apps.filter(
    (a) =>
      a.name.toLowerCase().includes(query) ||
      (a.generic_name && a.generic_name.toLowerCase().includes(query)) ||
      a.icon_name.toLowerCase().includes(query)
  );

  if (appState.showOnlyModified) {
    filtered = filtered.filter(
      (a) => appState.overrides.has(a.file_name) || a.is_user_override
    );
  }

  els.appsGrid.innerHTML = '';
  if (filtered.length === 0) {
    els.appsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No se encontraron aplicaciones coincidentes</div>`;
    return;
  }

  filtered.forEach((app) => {
    const override = appState.overrides.get(app.file_name);
    const hasMix = Boolean(override);
    const hasDirect = app.is_user_override;

    const iconSrc = hasMix
      ? override.match.icon_data
      : appState.appIconMap.get(app.file_name) || '';

    const card = document.createElement('div');
    card.className = `adw-app-card ${hasMix || hasDirect ? 'has-override' : ''}`;
    card.innerHTML = `
      <div class="app-icon-preview">
        <img id="icon-img-${CSS.escape(app.file_name)}" src="${iconSrc || ''}" alt="" onerror="this.style.display='none'" />
      </div>
      <div class="app-info">
        <div class="app-name">${app.name}</div>
        <div class="app-desc">${app.generic_name || app.comment || app.icon_name}</div>
        ${hasMix ? `<span class="badge-override">🎨 ${override.match.theme_name}</span>` : ''}
        ${hasDirect ? `<span class="badge-override" style="background: rgba(46, 194, 126, 0.2); color: #8ff0a4;">Modificado en .desktop</span>` : ''}
      </div>
    `;

    card.addEventListener('click', () => openIconPicker(app));
    els.appsGrid.appendChild(card);
  });
}

// Render Mixed View
function renderMixedView() {
  const items = Array.from(appState.overrides.values());
  if (items.length === 0) {
    els.mixEmptyPlaceholder.style.display = 'block';
    els.mixGrid.style.display = 'none';
    return;
  }

  els.mixEmptyPlaceholder.style.display = 'none';
  els.mixGrid.style.display = 'grid';
  els.mixGrid.innerHTML = '';

  items.forEach(({ match, app, isSystem }) => {
    const card = document.createElement('div');
    card.className = 'adw-app-card has-override';
    card.innerHTML = `
      <div class="app-icon-preview">
        <img src="${match.icon_data}" alt="" />
      </div>
      <div class="app-info">
        <div class="app-name">${app.name}</div>
        <div class="app-desc">Origen: <b>${match.theme_name}</b> ${isSystem ? '• ' + (app.category || 'Sistema') : ''}</div>
        <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
          <span class="badge-override">${match.icon_format.toUpperCase()}</span>
          ${match.size ? `<span class="variant-size-pill">${match.size}</span>` : ''}
        </div>
      </div>
      <button class="adw-btn flat btn-remove-mix" style="margin-left: auto; color: var(--destructive);" title="Quitar asignación">✕</button>
    `;

    card.querySelector('.btn-remove-mix').addEventListener('click', (e) => {
      e.stopPropagation();
      const key = app.file_name || app.id;
      appState.overrides.delete(key);
      saveOverrides();
      updateBadgeCounts();
      renderMixedView();
      renderApps();
      renderSystemItems();
      showToast(`Quitado ${app.name} del tema combinado`);
    });

    els.mixGrid.appendChild(card);
  });
}

// Open Icon Picker Modal (App or System Item)
async function openIconPicker(item) {
  appState.selectedApp = item;
  appState.selectedVariant = null;

  els.modalAppTitle.textContent = item.name;
  els.modalAppIconName.textContent = `Identificador de icono: ${item.icon_name}`;
  if (els.modalCustomSearchInput) {
    els.modalCustomSearchInput.value = '';
  }

  const key = item.file_name || item.id;
  const currentUri = item.file_name ? appState.appIconMap.get(key) : appState.systemIconMap.get(key);
  els.modalAppPreview.innerHTML = currentUri ? `<img src="${currentUri}" alt="" />` : '🖼️';

  // Direct desktop override is only valid for desktop apps
  if (els.btnDirectOverride) {
    els.btnDirectOverride.style.display = item.file_name ? 'inline-flex' : 'none';
  }

  els.iconModal.classList.add('active');

  await fetchAndRenderVariants(item.icon_name, false);
}

// Fetch and render variants (supports custom icon name search & displays pixel dimensions)
async function fetchAndRenderVariants(iconQuery, isCustom = false) {
  if (!iconQuery || !iconQuery.trim()) return;
  const cleanQuery = iconQuery.trim();

  els.variantsContainer.innerHTML = '';
  els.modalLoadingIndicator.style.display = 'inline-block';
  if (els.modalVariantsLabel) {
    els.modalVariantsLabel.textContent = isCustom
      ? `Resultados para "${cleanQuery}":`
      : `Variantes para "${cleanQuery}" en paquetes instalados:`;
  }

  try {
    const variants = await invoke('find_icons_in_all_themes', {
      iconName: cleanQuery,
    });
    els.modalLoadingIndicator.style.display = 'none';

    if (variants.length === 0) {
      els.variantsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: var(--text-muted);">No se encontraron iconos para "${cleanQuery}". Intenta con otro término (ej: folder, document, text, archive...).</div>`;
      return;
    }

    const key = appState.selectedApp ? (appState.selectedApp.file_name || appState.selectedApp.id) : null;
    const existingOverride = key ? appState.overrides.get(key) : null;

    variants.forEach((v) => {
      const isSelected = existingOverride && existingOverride.match.icon_path === v.icon_path;
      const vCard = document.createElement('div');
      vCard.className = `variant-card ${isSelected ? 'selected' : ''}`;
      vCard.innerHTML = `
        <div class="variant-icon-wrapper">
          <img src="${v.icon_data}" alt="" />
        </div>
        <div class="variant-theme-name" title="${v.theme_name}">${v.theme_name}</div>
        <div style="display: flex; gap: 4px; align-items: center; justify-content: center; flex-wrap: wrap;">
          <div class="variant-format">${v.icon_format}</div>
          ${v.size ? `<span class="variant-size-pill">${v.size}</span>` : ''}
        </div>
      `;

      vCard.addEventListener('click', () => {
        document.querySelectorAll('.variant-card').forEach((c) => c.classList.remove('selected'));
        vCard.classList.add('selected');
        appState.selectedVariant = v;
        els.modalAppPreview.innerHTML = `<img src="${v.icon_data}" alt="" />`;
      });

      if (isSelected) {
        appState.selectedVariant = v;
      }

      els.variantsContainer.appendChild(vCard);
    });
  } catch (err) {
    els.modalLoadingIndicator.style.display = 'none';
    showToast(`Error buscando variantes: ${err}`, true);
  }
}

function closeModal() {
  els.iconModal.classList.remove('active');
  appState.selectedApp = null;
  appState.selectedVariant = null;
}

function updateBadgeCounts() {
  const count = appState.overrides.size;
  els.customizedCount.textContent = count;
  els.overrideCountTab.textContent = count;
}

// LocalStorage persistence for user configuration
function saveOverrides() {
  const serialized = Array.from(appState.overrides.entries());
  localStorage.setItem('icon_mixer_overrides', JSON.stringify(serialized));
}

function loadSavedOverrides() {
  try {
    const saved = localStorage.getItem('icon_mixer_overrides');
    if (saved) {
      const entries = JSON.parse(saved);
      appState.overrides = new Map(entries);
      updateBadgeCounts();
    }
  } catch (e) {
    console.warn('Error reading saved overrides:', e);
  }
}

// Launch
init();
