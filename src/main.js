// Tauri API invoke interface
const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.invoke;

// Application State
let appState = {
  currentSysTheme: '',
  iconThemes: [],
  apps: [],
  appIconMap: new Map(), // fileName -> base64
  overrides: new Map(),  // appFileName -> { match: ThemeIconMatch, app: AppEntry }
  activeView: 'apps-view',
  selectedApp: null,
  selectedVariant: null,
  showOnlyModified: false,
};

// UI Elements
const els = {
  themeToggle: document.getElementById('btn-theme-toggle'),
  currentSysTheme: document.getElementById('current-sys-theme'),
  viewBtns: document.querySelectorAll('.adw-view-btn'),
  views: {
    'apps-view': document.getElementById('view-apps'),
    'themes-view': document.getElementById('view-themes'),
    'mix-view': document.getElementById('view-mix'),
  },
  appsGrid: document.getElementById('apps-grid'),
  appSearchInput: document.getElementById('app-search-input'),
  btnRefreshApps: document.getElementById('btn-refresh-apps'),
  btnFilterModified: document.getElementById('btn-filter-modified'),
  customizedCount: document.getElementById('customized-count'),
  overrideCountTab: document.getElementById('override-count-tab'),

  themesGrid: document.getElementById('themes-grid'),
  themeSearchInput: document.getElementById('theme-search-input'),
  themeTotalCount: document.getElementById('theme-total-count'),

  // Mix View
  mixedThemeName: document.getElementById('mixed-theme-name'),
  mixedBaseSelect: document.getElementById('mixed-base-theme-select'),
  btnQuickSave: document.getElementById('btn-quick-save'),
  btnClearOverrides: document.getElementById('btn-clear-overrides'),
  mixGrid: document.getElementById('mix-grid'),
  mixEmptyPlaceholder: document.getElementById('mix-empty-placeholder'),

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
  setupEventListeners();
  loadSavedOverrides();

  try {
    const currentTheme = await invoke('get_current_desktop_theme');
    appState.currentSysTheme = currentTheme;
    els.currentSysTheme.textContent = `Tema actual: ${currentTheme}`;
  } catch (err) {
    console.warn('Failed to get current desktop theme:', err);
  }

  await loadIconThemes();
  await loadApplications();
}

// Event Listeners
function setupEventListeners() {
  // Theme Toggle (Light / Dark)
  els.themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
  });

  // View Switcher
  els.viewBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.viewBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.dataset.view;
      appState.activeView = target;

      Object.entries(els.views).forEach(([viewKey, viewEl]) => {
        viewEl.style.display = viewKey === target ? 'flex' : 'none';
      });

      if (target === 'mix-view') {
        renderMixedView();
      }
    });
  });

  // Search Inputs
  els.appSearchInput.addEventListener('input', () => renderApps());
  els.themeSearchInput.addEventListener('input', () => renderThemes());

  // Filter modified
  els.btnFilterModified.addEventListener('click', () => {
    appState.showOnlyModified = !appState.showOnlyModified;
    els.btnFilterModified.classList.toggle('suggested', appState.showOnlyModified);
    renderApps();
  });

  // Refresh
  els.btnRefreshApps.addEventListener('click', () => {
    loadApplications();
    showToast('Lista de aplicaciones recargada');
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
    // Ensure target_app_icon is linked to this app's icon_name
    appState.selectedVariant.target_app_icon = appState.selectedApp.icon_name;

    appState.overrides.set(appState.selectedApp.file_name, {
      match: appState.selectedVariant,
      app: appState.selectedApp,
    });
    saveOverrides();
    updateBadgeCounts();
    renderApps();
    closeModal();
    showToast(`Asignado a tema combinado: ${appState.selectedApp.name}`);
  });

  els.btnDirectOverride.addEventListener('click', async () => {
    if (!appState.selectedApp || !appState.selectedVariant) {
      showToast('Selecciona una variante primero');
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
    try {
      await invoke('restore_single_app_icon', {
        desktopFileName: appState.selectedApp.file_name,
      });
      appState.overrides.delete(appState.selectedApp.file_name);
      saveOverrides();
      appState.selectedApp.is_user_override = false;
      updateBadgeCounts();
      renderApps();
      closeModal();
      showToast(`Icono restaurado a su valor original`);
    } catch (err) {
      showToast(`Error al restaurar: ${err}`, true);
    }
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
      showToast('Selección de iconos vaciada');
    }
  });
}

// Perform export / update of theme
async function performExport(isQuickSave = false) {
  const targetName = (isQuickSave ? els.mixedThemeName.value : els.exportThemeNameInput.value).trim() || 'Mi-Icon-Mix';
  const targetId = targetName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const baseTheme = (isQuickSave ? els.mixedBaseSelect.value : els.exportBaseSelect.value) || appState.currentSysTheme || 'Adwaita';
  const applyImmediately = isQuickSave ? true : els.checkApplyImmediately.checked;

  const overridesList = Array.from(appState.overrides.values()).map((item) => {
    const m = { ...item.match };
    if (!m.target_app_icon) {
      m.target_app_icon = item.app.icon_name;
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
      els.currentSysTheme.textContent = `Tema actual: ${targetId}`;
    }

    // Refresh themes list & app icons cache
    await loadIconThemes();
    appState.appIconMap.clear();
    loadAppsIconsBatch(appState.apps);
    renderApps();
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
    populateBaseSelects();
    renderThemes();
  } catch (err) {
    showToast(`Error al listar temas: ${err}`, true);
  }
}

function populateBaseSelects() {
  const options = appState.iconThemes
    .map(
      (t) =>
        `<option value="${t.id}" ${t.id === appState.currentSysTheme ? 'selected' : ''}>${t.name} (${t.id})</option>`
    )
    .join('');
  els.mixedBaseSelect.innerHTML = options;
  els.exportBaseSelect.innerHTML = options;
}

function populateExportSelect() {
  els.exportThemeNameInput.value = els.mixedThemeName.value.trim() || 'Mi-Icon-Mix';
  els.exportBaseSelect.value = els.mixedBaseSelect.value;
}

// Load Applications
async function loadApplications() {
  els.appsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Cargando aplicaciones instaladas...</div>`;
  try {
    const apps = await invoke('list_applications');
    appState.apps = apps;
    updateBadgeCounts();
    renderApps();

    // Lazy load icons for visible applications
    loadAppsIconsBatch(apps);
  } catch (err) {
    showToast(`Error al cargar aplicaciones: ${err}`, true);
  }
}

// Batch resolver for app icons
async function loadAppsIconsBatch(apps) {
  for (const app of apps) {
    if (!appState.appIconMap.has(app.file_name)) {
      try {
        const iconUri = await invoke('resolve_app_icon', {
          iconName: app.icon_name,
          themeId: appState.currentSysTheme || null,
        });
        if (iconUri) {
          appState.appIconMap.set(app.file_name, iconUri);
          const imgEl = document.getElementById(`icon-img-${CSS.escape(app.file_name)}`);
          if (imgEl) {
            imgEl.src = iconUri;
          }
        }
      } catch (e) {
        // silently fallback
      }
    }
  }
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
    const isCustomMixer = t.comment && t.comment.includes('Custom Icon Mixer theme');

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
        <button class="adw-btn flat btn-apply-theme" title="Establecer como tema actual del sistema">
          ${isCurrent ? '✓ Activo' : 'Activar'}
        </button>
        ${isCustomMixer ? `<button class="adw-btn flat btn-delete-theme" style="color: var(--destructive);" title="Eliminar tema personalizado">🗑️</button>` : ''}
      </div>
    `;

    // Apply button
    card.querySelector('.btn-apply-theme').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await invoke('set_current_desktop_theme', { themeName: t.id });
        appState.currentSysTheme = t.id;
        els.currentSysTheme.textContent = `Tema actual: ${t.id}`;
        showToast(`Tema aplicado: ${t.name}`);
        renderThemes();
        appState.appIconMap.clear();
        loadAppsIconsBatch(appState.apps);
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

      const deleteBtn = card.querySelector('.btn-delete-theme');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`¿Eliminar el tema personalizado "${t.name}"?`)) {
            try {
              await invoke('delete_mixed_theme', { themeId: t.id });
              showToast(`Tema "${t.name}" eliminado`);
              await loadIconThemes();
            } catch (err) {
              showToast(`Error: ${err}`, true);
            }
          }
        });
      }
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

    // Map overrides back to apps if matching
    appState.overrides.clear();
    for (const [iconStem, appOv] of Object.entries(profile.overrides)) {
      // Find matching app by icon_name
      const matchedApp = appState.apps.find((a) => a.icon_name.toLowerCase() === iconStem.toLowerCase());
      if (matchedApp) {
        // Resolve data URI
        const uri = await invoke('resolve_app_icon', {
          iconName: matchedApp.icon_name,
          themeId: themeId,
        });

        appState.overrides.set(matchedApp.file_name, {
          match: {
            theme_id: themeId,
            theme_name: profile.target_theme_name,
            icon_path: appOv.icon_path,
            icon_format: appOv.icon_path.endsWith('.svg') ? 'svg' : 'png',
            icon_data: uri || '',
            target_app_icon: matchedApp.icon_name,
          },
          app: matchedApp,
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

  items.forEach(({ match, app }) => {
    const card = document.createElement('div');
    card.className = 'adw-app-card has-override';
    card.innerHTML = `
      <div class="app-icon-preview">
        <img src="${match.icon_data}" alt="" />
      </div>
      <div class="app-info">
        <div class="app-name">${app.name}</div>
        <div class="app-desc">Origen: <b>${match.theme_name}</b></div>
        <span class="badge-override">${match.icon_format.toUpperCase()}</span>
      </div>
      <button class="adw-btn flat btn-remove-mix" style="margin-left: auto; color: var(--destructive);" title="Quitar asignación">✕</button>
    `;

    card.querySelector('.btn-remove-mix').addEventListener('click', (e) => {
      e.stopPropagation();
      appState.overrides.delete(app.file_name);
      saveOverrides();
      updateBadgeCounts();
      renderMixedView();
      renderApps();
      showToast(`Quitado ${app.name} del tema combinado`);
    });

    els.mixGrid.appendChild(card);
  });
}

// Open Icon Picker Modal
async function openIconPicker(app) {
  appState.selectedApp = app;
  appState.selectedVariant = null;

  els.modalAppTitle.textContent = app.name;
  els.modalAppIconName.textContent = `Identificador de icono: ${app.icon_name}`;
  if (els.modalCustomSearchInput) {
    els.modalCustomSearchInput.value = '';
  }
  
  const currentUri = appState.appIconMap.get(app.file_name);
  els.modalAppPreview.innerHTML = currentUri ? `<img src="${currentUri}" alt="" />` : '🖼️';

  els.iconModal.classList.add('active');

  await fetchAndRenderVariants(app.icon_name, false);
}

// Fetch and render variants (supports custom icon name search)
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
      els.variantsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: var(--text-muted);">No se encontraron iconos para "${cleanQuery}". Intenta con otro término (ej: spotify, discord, firefox, web-browser...).</div>`;
      return;
    }

    // Existing override for this app?
    const existingOverride = appState.selectedApp ? appState.overrides.get(appState.selectedApp.file_name) : null;

    variants.forEach((v) => {
      const isSelected = existingOverride && existingOverride.match.icon_path === v.icon_path;
      const vCard = document.createElement('div');
      vCard.className = `variant-card ${isSelected ? 'selected' : ''}`;
      vCard.innerHTML = `
        <div class="variant-icon-wrapper">
          <img src="${v.icon_data}" alt="" />
        </div>
        <div class="variant-theme-name" title="${v.theme_name}">${v.theme_name}</div>
        <div class="variant-format">${v.icon_format}</div>
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
