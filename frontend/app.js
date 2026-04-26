// =============================================
// FeedMax — Social Intelligence Dashboard
// =============================================

// =============================================
// UTILS
// =============================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function copyToClipboard(text, successMsg) {
  successMsg = successMsg || 'Copiado';
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(function() { showToast(successMsg, 'success'); })
      .catch(function() { _fallbackCopy(text, successMsg); });
  } else {
    _fallbackCopy(text, successMsg);
  }
}

function _fallbackCopy(text, successMsg) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    var ok = document.execCommand('copy');
    showToast(ok ? successMsg : 'Erro ao copiar', ok ? 'success' : 'error');
  } catch (e) {
    showToast('Erro ao copiar', 'error');
  }
  document.body.removeChild(ta);
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch (e) { return ''; }
}

// Helpers que faltavam (usados em renderCalendar / renderCaption).
// Sem eles, qualquer código que tocava os resultados do content studio
// quebrava com ReferenceError — o que podia derrubar chamadas subsequentes
// (incluindo renderProfiles) quando a view-conteudo era restaurada.
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    || 'geral';
}

function escapeForOnclick(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/"/g, '&quot;');
}

function copyText(text) {
  try {
    copyToClipboard(String(text || ''), 'Legenda copiada');
  } catch (e) {
    console.warn('[FeedMax] copyText falhou:', e);
  }
}
// Expõe no window para onclick inline
window.copyText = copyText;
window.resetarPersonagem = function() { return resetarPersonagem(); };
window.salvarCliente = function() { return salvarCliente(); };
window.registrarPersonagemBS = function() { return registrarPersonagemBS(); };

const VIEW_CONFIG = {
  'radar-social':  { title: 'Radar Social',       subtitle: 'Inteligencia de concorrentes em redes sociais' },
  conteudo:        { title: 'Criar Conteudo',      subtitle: 'Calendario editorial e legendas para a Dra. Roseli' },
  salvas:          { title: 'Analises Salvas',     subtitle: 'Seus perfis analisados' },
  configuracoes:   { title: 'Configuracoes',       subtitle: 'Preferencias e integracoes' },
};

// ---------- STATE ----------
const state = {
  profiles: [],
  filter: 'all',
  view: 'radar-social',
  selectedProfile: null,
  isAnalyzing: false,
  selectedPlatform: 'instagram',
};

// =============================================
// INIT
// =============================================

document.addEventListener('DOMContentLoaded', function() {
  initTheme();
  loadProfiles();
  setupNavigation();
  setupModals();
  setupFilters();
  setupDetailPanel();
  setupContentStudio();
  setupBrandSetup();
  renderMetrics();
  renderProfiles();
  checkHealth();
});

// =============================================
// THEME TOGGLE (dark ↔ light)
// =============================================

function initTheme() {
  var saved = localStorage.getItem('fm_theme');
  var isDark = saved ? saved === 'dark' : true; // dark por padrao
  applyTheme(isDark);

  var btn = document.getElementById('topbar-theme');
  if (btn) {
    btn.addEventListener('click', function() {
      var currentlyLight = document.documentElement.getAttribute('data-theme') === 'light';
      applyTheme(currentlyLight); // toggle
    });
  }
}

function applyTheme(dark) {
  if (dark) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  localStorage.setItem('fm_theme', dark ? 'dark' : 'light');

  // Atualiza ícones do botão
  var moon = document.querySelector('.icon-moon');
  var sun  = document.querySelector('.icon-sun');
  if (moon) moon.style.display = dark ? '' : 'none';
  if (sun)  sun.style.display  = dark ? 'none' : '';
}

// =============================================
// HEALTH CHECK
// =============================================

async function checkHealth() {
  var statusEl = document.getElementById('sidebar-status');
  var configStatus = document.getElementById('config-apify-status');
  try {
    var res = await fetch('/api/health');
    var data = await res.json();
    if (data.status === 'ok') {
      if (data.apify) {
        statusEl.innerHTML = '<div class="status-dot status-ok"></div><span>Conectado (Apify)</span>';
        if (configStatus) configStatus.innerHTML = '<span class="status-dot status-ok"></span><span>Apify configurado — scraping real ativo</span>';
      } else {
        statusEl.innerHTML = '<div class="status-dot status-warn"></div><span>Modo Claude</span>';
        if (configStatus) configStatus.innerHTML = '<span class="status-dot status-warn"></span><span>Sem Apify — usando analise inteligente Claude</span>';
      }
    }
  } catch (e) {
    statusEl.innerHTML = '<div class="status-dot status-err"></div><span>Sem conexao</span>';
  }
}

// =============================================
// NAVIGATION
// =============================================

function setupNavigation() {
  document.querySelectorAll('[data-view]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      switchView(el.dataset.view);
    });
  });
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll('[data-view]').forEach(function(el) {
    el.classList.toggle('active', el.dataset.view === view);
  });
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  var target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  var config = VIEW_CONFIG[view] || VIEW_CONFIG['radar-social'];
  document.getElementById('page-title').textContent = config.title;
  document.getElementById('page-subtitle').textContent = config.subtitle;

  // Mostrar/esconder metricas e topbar actions conforme a view
  var metricsGrid = document.getElementById('metrics-grid');
  var topbarActions = document.querySelector('.topbar-actions');
  if (view === 'radar-social') {
    metricsGrid.style.display = '';
    topbarActions.style.display = '';
  } else if (view === 'conteudo') {
    metricsGrid.style.display = 'none';
    topbarActions.style.display = 'none';
  } else {
    metricsGrid.style.display = 'none';
    topbarActions.style.display = 'none';
  }

  if (view === 'salvas') renderSalvas();
  if (view === 'radar-social') renderProfiles();
}

// =============================================
// ANALISES SALVAS
// =============================================

function renderSalvas() {
  var profiles = state.profiles; // fonte de verdade: estado em memória
  var grid = document.getElementById('salvas-grid');
  var empty = document.getElementById('salvas-empty');

  if (!grid) return;

  if (profiles.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = profiles.map(renderProfileCard).join('');

  grid.querySelectorAll('[data-delete-id]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteProfile(btn.dataset.deleteId);
    });
  });

  grid.querySelectorAll('[data-detail-id]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openDetail(btn.dataset.detailId);
    });
  });
}

// =============================================
// MODALS
// =============================================

function setupModals() {
  // Analyze profile button
  document.getElementById('btn-analyze-profile').addEventListener('click', handleAnalyzeProfile);
  document.getElementById('profile-username').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') handleAnalyzeProfile();
  });

  // Open modal buttons
  document.getElementById('topbar-nova').addEventListener('click', function() { openModal('modal-profile'); });
  document.getElementById('empty-cta').addEventListener('click', function() { openModal('modal-profile'); });

  // Export
  document.getElementById('topbar-export').addEventListener('click', exportCSV);

  // Platform selector
  document.querySelectorAll('.platform-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.platform-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.selectedPlatform = btn.dataset.platform;
    });
  });

  // Close buttons
  document.querySelectorAll('[data-close]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!state.isAnalyzing) closeModal(btn.dataset.close);
    });
  });

  // Click outside
  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay && !state.isAnalyzing) closeModal(overlay.id);
    });
  });
}

function openModal(id) {
  var modal = document.getElementById(id);
  modal.classList.add('open');
  hideModalError(id);
  setTimeout(function() {
    var input = modal.querySelector('input, textarea');
    if (input) input.focus();
  }, 150);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// =============================================
// ANALYZE PROFILE
// =============================================

async function handleAnalyzeProfile() {
  if (state.isAnalyzing) return;

  var usernameInput = document.getElementById('profile-username');
  var extraInput = document.getElementById('profile-extra');
  var raw = usernameInput.value.trim();

  if (!raw) {
    showModalError('modal-profile', 'Insira o username ou URL do perfil.');
    return;
  }

  // Extrair username de URL se necessario
  var username = extractUsername(raw);
  var platform = state.selectedPlatform;
  var manualData = extraInput.value.trim() || undefined;

  hideModalError('modal-profile');
  setModalLoading('modal-profile', true, 'Analisando...');

  try {
    var res = await fetch('/api/social/analyze-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: platform, username: username, manualData: manualData }),
    });

    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao analisar perfil.');

    addProfile(data.analysis, data.meta);
    closeModal('modal-profile');
    usernameInput.value = '';
    extraInput.value = '';
    showToast('@' + username + ' adicionado ao radar', 'success');
    if (state.view !== 'radar-social') switchView('radar-social');
  } catch (err) {
    showModalError('modal-profile', err.message);
  } finally {
    setModalLoading('modal-profile', false, 'Analisar');
  }
}

function extractUsername(raw) {
  // Remove URL parts: https://instagram.com/username/ -> username
  var cleaned = raw.replace(/^https?:\/\//, '');
  cleaned = cleaned.replace(/^(www\.)?(instagram\.com|linkedin\.com)(\/in)?\//, '');
  cleaned = cleaned.replace(/\/.*$/, '');
  cleaned = cleaned.replace(/^@/, '');
  return cleaned.trim();
}

// =============================================
// PROFILES MANAGEMENT
// =============================================

function loadProfiles() {
  try {
    var saved = localStorage.getItem('ds_social_profiles');
    var parsed = saved ? JSON.parse(saved) : [];
    state.profiles = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[FeedMax] loadProfiles parse error:', e);
    state.profiles = [];
  }
}

// Flag explícita que autoriza saveProfiles a gravar array vazio.
// Só é setada em operações legítimas (deleteProfile removendo o último perfil).
// Qualquer outra tentativa de gravar [] por cima de dados existentes é bloqueada.
var _allowEmptySave = false;

function saveProfiles() {
  try {
    // GUARDA DEFENSIVA: impede sobrescrever localStorage não-vazio com []
    // quando ninguém setou o flag explícito. Esse é o fail-safe contra
    // qualquer caminho de código (conhecido ou não) que chame saveProfiles
    // com state.profiles zerado sem passar pelo deleteProfile.
    if (state.profiles.length === 0 && !_allowEmptySave) {
      var existing = localStorage.getItem('ds_social_profiles');
      if (existing) {
        try {
          var prev = JSON.parse(existing);
          if (Array.isArray(prev) && prev.length > 0) {
            console.error(
              '[FeedMax] BLOQUEADO: saveProfiles chamado com array vazio ' +
              'enquanto localStorage tinha ' + prev.length + ' perfil(s). ' +
              'Restaurando estado a partir do localStorage.'
            );
            console.trace('[FeedMax] stack trace da chamada bloqueada');
            state.profiles = prev;
            renderMetrics();
            renderProfiles();
            return;
          }
        } catch (_) { /* se o parse falhar, continua e sobrescreve */ }
      }
    }
    localStorage.setItem('ds_social_profiles', JSON.stringify(state.profiles));
  } catch (e) {
    console.warn('[FeedMax] localStorage cheio:', e);
  } finally {
    _allowEmptySave = false; // reset sempre após tentativa de save
  }
}

function addProfile(analysis, meta) {
  var entry = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    analysis: analysis,
    meta: meta,
    savedAt: new Date().toISOString(),
  };
  state.profiles.unshift(entry);
  saveProfiles();
  renderMetrics();
  renderProfiles();
}

var _lastDeletedProfile = null;
var _undoClearTimer = null;

function deleteProfile(id) {
  var removed = state.profiles.find(function(p) { return p.id === id; });
  if (!removed) return;

  // 1. Remove do estado e persiste IMEDIATAMENTE no localStorage
  state.profiles = state.profiles.filter(function(p) { return p.id !== id; });
  // Autoriza save vazio (caso tenha removido o último perfil)
  _allowEmptySave = true;
  saveProfiles();
  renderMetrics();
  renderProfiles();

  // 2. Guarda em memória só para o undo (sem save diferido)
  _lastDeletedProfile = removed;
  clearTimeout(_undoClearTimer);
  _undoClearTimer = setTimeout(function() { _lastDeletedProfile = null; }, 5000);

  showUndoToast('Perfil removido do radar', function() {
    if (!_lastDeletedProfile) return;
    clearTimeout(_undoClearTimer);
    state.profiles.unshift(_lastDeletedProfile);
    _lastDeletedProfile = null;
    saveProfiles();
    renderMetrics();
    renderProfiles();
    showToast('Acao desfeita', 'success');
  });
}

// =============================================
// METRICS
// =============================================

function renderMetrics() {
  var total = state.profiles.length;
  var ig = state.profiles.filter(function(p) { return (p.meta?.platform || p.analysis?.perfil?.plataforma) === 'instagram'; }).length;
  var li = state.profiles.filter(function(p) { return (p.meta?.platform || p.analysis?.perfil?.plataforma) === 'linkedin'; }).length;

  var scores = state.profiles.map(function(p) { return p.analysis?.perfil?.nota_geral || 0; }).filter(function(s) { return s > 0; });
  var avg = scores.length > 0 ? Math.round(scores.reduce(function(a, b) { return a + b; }, 0) / scores.length) : '--';

  document.getElementById('metric-total').textContent = total;
  document.getElementById('metric-instagram').textContent = ig;
  document.getElementById('metric-linkedin').textContent = li;
  document.getElementById('metric-avg-score').textContent = avg;
}

// =============================================
// FILTERS
// =============================================

function setupFilters() {
  document.querySelectorAll('.filter-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      state.filter = tab.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      renderProfiles();
    });
  });
}

function getFilteredProfiles() {
  if (state.filter === 'all') return state.profiles;
  return state.profiles.filter(function(p) {
    return (p.meta?.platform || p.analysis?.perfil?.plataforma) === state.filter;
  });
}

// =============================================
// RENDER PROFILES
// =============================================

function renderProfiles() {
  // Segurança: se o estado está vazio mas o localStorage tem dados, restaura.
  if (state.profiles.length === 0) {
    try {
      var _raw = localStorage.getItem('ds_social_profiles');
      if (_raw) {
        var _arr = JSON.parse(_raw);
        if (Array.isArray(_arr) && _arr.length > 0) {
          console.warn('[FeedMax] renderProfiles: estado vazio, restaurando ' + _arr.length + ' perfil(s) do localStorage.');
          state.profiles = _arr;
        }
      }
    } catch (_e) { /* mantém vazio se parse falhar */ }
  }

  var profiles = getFilteredProfiles();
  var grid = document.getElementById('profiles-grid');
  var empty = document.getElementById('empty-state');
  var countEl = document.getElementById('profiles-count');

  // Se o filtro ativo não bate com nenhum perfil, mas há perfis no estado,
  // reseta para "Todos" em vez de mostrar grid vazio de forma confusa.
  if (profiles.length === 0 && state.profiles.length > 0) {
    state.filter = 'all';
    document.querySelectorAll('.filter-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.filter === 'all');
    });
    profiles = state.profiles;
  }

  countEl.textContent = profiles.length + ' perfi' + (profiles.length !== 1 ? 's' : 'l');

  if (profiles.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = profiles.map(renderProfileCard).join('');

  grid.querySelectorAll('[data-delete-id]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteProfile(btn.dataset.deleteId);
    });
  });

  grid.querySelectorAll('[data-detail-id]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openDetail(btn.dataset.detailId);
    });
  });
}

function renderProfileCard(entry) {
  var a = entry.analysis || {};
  var p = a.perfil || {};
  var c = a.conteudo || {};
  var e = a.engajamento || {};
  var plat = p.plataforma || entry.meta?.platform || 'instagram';
  var score = p.nota_geral || 0;
  var level = score >= 70 ? 'alto' : score >= 40 ? 'medio' : 'baixo';
  var levelLabel = level === 'alto' ? 'Forte' : level === 'medio' ? 'Medio' : 'Fraco';
  var username = p.username || '@' + (entry.meta?.username || '?');
  var initials = username.replace('@', '').slice(0, 2).toUpperCase();
  var date = formatDate(entry.savedAt);
  var nicho = p.nicho || p.bio_resumo || '';
  var temas = (c.temas_principais || []).slice(0, 3).join(', ');
  var engLabel = e.nivel || level;

  var platClass = plat === 'linkedin' ? 'linkedin' : 'instagram';
  var tempClass = level === 'alto' ? 'quente' : level === 'medio' ? 'morno' : 'frio';

  return '<div class="lead-card temp-' + tempClass + '">' +
    '<button class="card-delete" data-delete-id="' + entry.id + '" title="Remover perfil">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
    '</button>' +
    '<div class="card-body">' +
      '<div class="card-top-row">' +
        '<div class="avatar avatar-' + tempClass + '">' + escapeHtml(initials) + '</div>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<span class="platform-tag platform-' + platClass + '">' + escapeHtml(plat) + '</span>' +
          '<span class="score-badge badge-' + tempClass + '">' +
            '<span class="score-number">' + score + '</span>' +
            '<span class="score-label">' + levelLabel + '</span>' +
          '</span>' +
        '</div>' +
      '</div>' +
      '<div class="card-info">' +
        '<h3 class="company-name" title="' + escapeHtml(username) + '">' + escapeHtml(username) + '</h3>' +
        '<p class="company-sector">' + escapeHtml(nicho) + '</p>' +
      '</div>' +
      '<p class="lead-insight">' + escapeHtml(temas ? 'Temas: ' + temas : (a.estrategia_recomendada || '').slice(0, 120)) + '</p>' +
    '</div>' +
    '<div class="card-footer">' +
      '<span class="analysis-date">' + date + '</span>' +
      '<button class="btn-approach" data-detail-id="' + entry.id + '">Ver analise &rarr;</button>' +
    '</div>' +
  '</div>';
}

// =============================================
// DETAIL PANEL
// =============================================

function setupDetailPanel() {
  document.getElementById('panel-overlay').addEventListener('click', closeDetail);
  document.getElementById('panel-close').addEventListener('click', closeDetail);
  document.getElementById('panel-close-btn2').addEventListener('click', closeDetail);
  document.getElementById('panel-copy').addEventListener('click', function(e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    try {
      if (!state.selectedProfile) return;
      var text = JSON.stringify(state.selectedProfile.analysis, null, 2);
      copyToClipboard(text, 'Analise copiada');
    } catch (err) {
      console.error('[FeedMax] Erro no panel-copy handler:', err);
      showToast('Erro ao copiar analise', 'error');
    }
  });
}

function openDetail(profileId) {
  var entry = state.profiles.find(function(p) { return p.id === profileId; });
  if (!entry) return;

  state.selectedProfile = entry;
  var a = entry.analysis;
  var p = a.perfil || {};
  var c = a.conteudo || {};
  var e = a.engajamento || {};
  var plat = p.plataforma || 'instagram';
  var score = p.nota_geral || 0;
  var level = score >= 70 ? 'alto' : score >= 40 ? 'medio' : 'baixo';
  var tempClass = level === 'alto' ? 'quente' : level === 'medio' ? 'morno' : 'frio';

  var avatarEl = document.getElementById('panel-avatar');
  var username = p.username || '@?';
  avatarEl.textContent = username.replace('@', '').slice(0, 2).toUpperCase();
  avatarEl.className = 'panel-avatar avatar-' + tempClass;

  document.getElementById('panel-username').textContent = username;
  document.getElementById('panel-platform').textContent = plat + (p.seguidores_estimados ? ' | ' + p.seguidores_estimados + ' seguidores' : '');
  document.getElementById('panel-score').textContent = score;
  document.getElementById('panel-engagement-label').textContent = 'Engajamento: ' + (e.nivel || level);

  var scoreBar = document.getElementById('panel-score-bar');
  scoreBar.className = 'panel-score-bar score-bar-' + tempClass;

  // Build body
  var html = '';

  // Tom de voz
  if (c.tom_de_voz) {
    html += '<div class="panel-section"><h4 class="panel-section-title">Tom de voz</h4>';
    html += '<p style="font-size:13.5px;color:var(--text-2);line-height:1.5">' + escapeHtml(c.tom_de_voz) + '</p></div>';
  }

  // Temas principais
  if (c.temas_principais && c.temas_principais.length > 0) {
    html += '<div class="panel-section"><h4 class="panel-section-title">Temas principais</h4>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    c.temas_principais.forEach(function(t) {
      html += '<span class="hashtag">' + escapeHtml(t) + '</span>';
    });
    html += '</div></div>';
  }

  // Pontos fortes
  if (c.pontos_fortes && c.pontos_fortes.length > 0) {
    html += '<div class="panel-section"><h4 class="panel-section-title">Pontos fortes</h4>';
    html += '<ul class="panel-dores">';
    c.pontos_fortes.forEach(function(pf) {
      html += '<li>' + escapeHtml(pf) + '</li>';
    });
    html += '</ul></div>';
  }

  // Pontos fracos
  if (c.pontos_fracos && c.pontos_fracos.length > 0) {
    html += '<div class="panel-section"><h4 class="panel-section-title">Pontos fracos</h4>';
    html += '<ul class="panel-dores">';
    c.pontos_fracos.forEach(function(pf) {
      html += '<li>' + escapeHtml(pf) + '</li>';
    });
    html += '</ul></div>';
  }

  // Oportunidades
  if (a.oportunidades && a.oportunidades.length > 0) {
    html += '<div class="panel-section"><h4 class="panel-section-title">Oportunidades para a Dra. Roseli</h4>';
    html += '<ul class="panel-dores">';
    a.oportunidades.forEach(function(op) {
      html += '<li>' + escapeHtml(op) + '</li>';
    });
    html += '</ul></div>';
  }

  // Estrategia recomendada
  if (a.estrategia_recomendada) {
    html += '<div class="panel-section"><h4 class="panel-section-title">Estrategia recomendada</h4>';
    html += '<p style="font-size:13.5px;color:var(--text-2);line-height:1.7">' + escapeHtml(a.estrategia_recomendada) + '</p></div>';
  }

  // Hashtags
  if (c.hashtags_recorrentes && c.hashtags_recorrentes.length > 0) {
    html += '<div class="panel-section"><h4 class="panel-section-title">Hashtags recorrentes</h4>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    c.hashtags_recorrentes.forEach(function(h) {
      html += '<span class="hashtag">' + escapeHtml(h) + '</span>';
    });
    html += '</div></div>';
  }

  // Engajamento detalhes
  if (e.observacoes) {
    html += '<div class="panel-section"><h4 class="panel-section-title">Engajamento</h4>';
    html += '<p style="font-size:13.5px;color:var(--text-2);line-height:1.5">';
    if (e.taxa_estimada) html += '<strong>Taxa estimada:</strong> ' + escapeHtml(e.taxa_estimada) + '<br>';
    html += escapeHtml(e.observacoes) + '</p></div>';
  }

  document.getElementById('panel-body').innerHTML = html;

  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('panel-overlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  var panel   = document.getElementById('detail-panel');
  var overlay = document.getElementById('panel-overlay');
  panel.classList.remove('open');
  document.body.style.overflow = '';
  state.selectedProfile = null;
  // Mantém o overlay bloqueando cliques até o painel terminar de deslizar (280ms).
  // Sem isso, o grid fica clicável durante a transição e um toque rápido
  // pode acertar um filter-tab ou botão de delete — zerando os perfis na tela.
  var done = false;
  function _removeOverlay() {
    if (done) return;
    done = true;
    overlay.classList.remove('visible');
    panel.removeEventListener('transitionend', _removeOverlay);
  }
  panel.addEventListener('transitionend', _removeOverlay);
  setTimeout(_removeOverlay, 350); // fallback caso transitionend não dispare
}

// =============================================
// CSV EXPORT
// =============================================

function exportCSV() {
  if (state.profiles.length === 0) {
    showToast('Nenhum perfil para exportar', 'warning');
    return;
  }

  var headers = ['username', 'plataforma', 'nicho', 'score', 'engajamento', 'temas', 'data'];
  var rows = state.profiles.map(function(entry) {
    var a = entry.analysis || {};
    var p = a.perfil || {};
    var c = a.conteudo || {};
    var e = a.engajamento || {};
    return [
      p.username || '',
      p.plataforma || '',
      p.nicho || '',
      p.nota_geral || 0,
      e.nivel || '',
      (c.temas_principais || []).join('; '),
      formatDate(entry.savedAt),
    ].map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
  });

  var csv = [headers.join(',')].concat(rows).join('\r\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'datascout-social-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(state.profiles.length + ' perfis exportados', 'success');
}

// =============================================
// CONTENT STUDIO (mantido do original)
// =============================================

var studioState = {
  activeTab: 'calendario',
  isGenerating: false,
  lastCalendar: null,
  lastCaption: null,
};

function setupContentStudio() {
  document.querySelectorAll('.studio-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      studioState.activeTab = tab.dataset.tab;
      document.querySelectorAll('.studio-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.tab === studioState.activeTab);
      });
      document.querySelectorAll('.studio-panel').forEach(function(p) {
        p.classList.toggle('active', p.id === 'studio-' + studioState.activeTab);
      });
    });
  });

  var btnCal = document.getElementById('btn-gerar-cal');
  if (btnCal) btnCal.addEventListener('click', generateCalendar);

  var btnCap = document.getElementById('btn-gerar-cap');
  if (btnCap) btnCap.addEventListener('click', generateCaption);

  // Restaurar resultados salvos do localStorage
  restoreStudioResults();
}

// ---------- PERSISTENCIA DO CONTENT STUDIO ----------

function saveStudioCalendar(calendar) {
  try {
    localStorage.setItem('ds_studio_calendar', JSON.stringify({
      calendar: calendar,
      savedAt: new Date().toISOString(),
    }));
    studioState.lastCalendar = calendar;
  } catch (e) { console.warn('Erro ao salvar calendario:', e); }
}

function saveStudioCaption(caption, meta) {
  try {
    localStorage.setItem('ds_studio_caption', JSON.stringify({
      caption: caption,
      meta: meta,
      savedAt: new Date().toISOString(),
    }));
    studioState.lastCaption = { caption: caption, meta: meta };
  } catch (e) { console.warn('Erro ao salvar legenda:', e); }
}

function restoreStudioResults() {
  // Restaurar calendario
  try {
    var calData = localStorage.getItem('ds_studio_calendar');
    if (calData) {
      var parsed = JSON.parse(calData);
      if (parsed.calendar) {
        studioState.lastCalendar = parsed.calendar;
        renderCalendar(parsed.calendar);
        var savedDate = parsed.savedAt ? formatDate(parsed.savedAt) : '';
        var results = document.getElementById('cal-results');
        if (results && savedDate) {
          results.insertAdjacentHTML('afterbegin',
            '<div class="studio-restored-badge" style="display:flex;align-items:center;gap:6px;padding:8px 12px;margin-bottom:12px;background:rgba(79,99,210,0.08);border:1px solid rgba(79,99,210,0.15);border-radius:8px;font-size:12px;color:var(--text-3)">' +
            '<span style="color:var(--accent)">&#9679;</span> Calendario restaurado (gerado em ' + savedDate + ')' +
            '</div>'
          );
        }
      }
    }
  } catch (e) { console.warn('Erro ao restaurar calendario:', e); }

  // Restaurar legenda
  try {
    var capData = localStorage.getItem('ds_studio_caption');
    if (capData) {
      var parsed2 = JSON.parse(capData);
      if (parsed2.caption) {
        studioState.lastCaption = parsed2;
        renderCaption(parsed2.caption, parsed2.meta);
        var savedDate2 = parsed2.savedAt ? formatDate(parsed2.savedAt) : '';
        var results2 = document.getElementById('cap-results');
        if (results2 && savedDate2) {
          results2.insertAdjacentHTML('afterbegin',
            '<div class="studio-restored-badge" style="display:flex;align-items:center;gap:6px;padding:8px 12px;margin-bottom:12px;background:rgba(79,99,210,0.08);border:1px solid rgba(79,99,210,0.15);border-radius:8px;font-size:12px;color:var(--text-3)">' +
            '<span style="color:var(--accent)">&#9679;</span> Legenda restaurada (gerada em ' + savedDate2 + ')' +
            '</div>'
          );
        }
      }
    }
  } catch (e) { console.warn('Erro ao restaurar legenda:', e); }
}

async function generateCalendar() {
  if (studioState.isGenerating) return;
  studioState.isGenerating = true;

  var month = document.getElementById('cal-month').value;
  var year = document.getElementById('cal-year').value;
  var focus = document.getElementById('cal-focus').value.trim();
  var btn = document.getElementById('btn-gerar-cal');
  var results = document.getElementById('cal-results');

  btn.disabled = true;
  btn.textContent = 'Gerando...';
  results.innerHTML = '<div class="studio-loading"><div class="studio-spinner"></div><p>Gerando calendario editorial com Claude...</p></div>';

  try {
    var res = await fetch('/api/content/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: month, year: year, focus: focus || undefined }),
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar calendario.');
    saveStudioCalendar(data.calendar);
    renderCalendar(data.calendar);
    showToast('Calendario gerado com sucesso', 'success');
  } catch (err) {
    results.innerHTML = '<div class="studio-error">' + escapeHtml(err.message) + '</div>';
    showToast(err.message, 'error');
  } finally {
    studioState.isGenerating = false;
    btn.disabled = false;
    btn.textContent = 'Gerar Calendario';
  }
}

function renderCalendar(calendar) {
  var results = document.getElementById('cal-results');
  if (!calendar || !calendar.posts || calendar.posts.length === 0) {
    results.innerHTML = '<div class="studio-error">Nenhum post gerado.</div>';
    return;
  }

  var html = '<div class="cal-summary">';
  html += '<span class="cal-month-label">' + escapeHtml(calendar.mes_ano || '') + '</span>';
  html += '<span class="cal-strategy">' + escapeHtml(calendar.resumo_estrategico || '') + '</span>';
  html += '</div>';
  html += '<div class="cal-posts">';

  calendar.posts.forEach(function(post) {
    html += '<div class="cal-post-card">';
    html += '<div class="cal-post-header">';
    html += '<span class="cal-post-num">#' + (post.numero || '') + '</span>';
    html += '<span class="cal-post-day">' + escapeHtml(post.dia_sugerido || '') + '</span>';
    html += '<span class="cal-post-pilar pilar-' + slugify(post.pilar || '') + '">' + escapeHtml(post.pilar || '') + '</span>';
    html += '<span class="cal-post-fmt">' + escapeHtml(post.formato || '') + '</span>';
    html += '</div>';
    html += '<h4 class="cal-post-tema">' + escapeHtml(post.tema || '') + '</h4>';
    html += '<p class="cal-post-hook">"' + escapeHtml(post.hook || '') + '"</p>';
    html += '<p class="cal-post-dev">' + escapeHtml(post.desenvolvimento || '') + '</p>';
    html += '<div class="cal-post-footer">';
    html += '<span class="cal-post-cta">CTA: ' + escapeHtml(post.cta || '') + '</span>';
    html += '</div>';
    var postEncoded = encodeURIComponent(JSON.stringify(post));
    html += '<div class="cal-post-actions">';
    html += '<button class="btn btn-primary btn-sm" data-launch="carousel" data-post="' + postEncoded + '">Criar Carrossel</button>';
    html += '<button class="btn btn-secondary btn-sm" data-launch="post" data-post="' + postEncoded + '">Criar Post</button>';
    html += '<button class="btn btn-freepik btn-sm" data-launch="freepik" data-post="' + postEncoded + '">Gerar para Freepik</button>';
    html += '</div>';
    html += '</div>';
  });

  html += '</div>';
  results.innerHTML = html;

  results.querySelectorAll('[data-launch]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.dataset.launch === 'freepik') {
        openFreepikModal(decodeURIComponent(btn.dataset.post));
      } else {
        launchEditor(btn.dataset.launch, decodeURIComponent(btn.dataset.post));
      }
    });
  });
}

async function generateCaption() {
  if (studioState.isGenerating) return;
  studioState.isGenerating = true;

  var tema = document.getElementById('cap-tema').value.trim();
  var formato = document.getElementById('cap-formato').value;
  var plataforma = document.getElementById('cap-plataforma').value;
  var btn = document.getElementById('btn-gerar-cap');
  var results = document.getElementById('cap-results');

  if (!tema) {
    showToast('Informe o tema do post', 'warning');
    studioState.isGenerating = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Gerando...';
  results.innerHTML = '<div class="studio-loading"><div class="studio-spinner"></div><p>Gerando legenda com Claude...</p></div>';

  try {
    var res = await fetch('/api/content/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tema: tema, formato: formato, plataforma: plataforma }),
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar legenda.');
    saveStudioCaption(data.caption, data.meta);
    renderCaption(data.caption, data.meta);
    showToast('Legenda gerada com sucesso', 'success');
  } catch (err) {
    results.innerHTML = '<div class="studio-error">' + escapeHtml(err.message) + '</div>';
    showToast(err.message, 'error');
  } finally {
    studioState.isGenerating = false;
    btn.disabled = false;
    btn.textContent = 'Gerar Legenda';
  }
}

function renderCaption(caption, meta) {
  var results = document.getElementById('cap-results');
  var html = '<div class="cap-card">';
  html += '<div class="cap-section"><span class="cap-label">LEGENDA</span>';
  html += '<div class="cap-text">' + escapeHtml(caption.legenda || '').replace(/\n/g, '<br>') + '</div>';
  html += '<button class="btn btn-secondary btn-sm" onclick="copyText(\'' + escapeForOnclick(caption.legenda || '') + '\')">Copiar legenda</button>';
  html += '</div>';
  html += '<div class="cap-section"><span class="cap-label">CTA</span>';
  html += '<div class="cap-text">' + escapeHtml(caption.cta || '') + '</div></div>';
  html += '<div class="cap-section"><span class="cap-label">HASHTAGS</span>';
  html += '<div class="cap-hashtags">' + (caption.hashtags || []).map(function(h) { return '<span class="hashtag">' + escapeHtml(h) + '</span>'; }).join('') + '</div></div>';
  if (caption.notas_producao) {
    html += '<div class="cap-section"><span class="cap-label">PRODUCAO</span>';
    html += '<div class="cap-text cap-notes">' + escapeHtml(caption.notas_producao) + '</div></div>';
  }
  html += '</div>';
  results.innerHTML = html;
}

function launchEditor(type, postJson) {
  var post;
  try { post = JSON.parse(postJson); } catch (e) { post = {}; }

  if (type === 'carousel') {
    expandToCarousel(post);
    return;
  }

  var content = {
    tema: post.tema || '',
    hook: post.hook || '',
    desenvolvimento: post.desenvolvimento || '',
    cta: post.cta || '',
    hashtags: post.hashtags || [],
    formato: post.formato || '',
    pilar: post.pilar || '',
    fromDataScout: true,
    timestamp: Date.now(),
  };
  localStorage.setItem('ds_editor_content', JSON.stringify(content));
  window.open('/static_post_editor.html', '_blank');
}

// Loading overlay
function showCarouselLoadingOverlay(tema) {
  var existing = document.getElementById('ds-carousel-overlay');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'ds-carousel-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,17,23,0.88);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;backdrop-filter:blur(6px)';
  overlay.innerHTML = '<div style="width:48px;height:48px;border:3px solid rgba(79,99,210,0.2);border-top-color:var(--accent);border-radius:50%;animation:spin 0.9s linear infinite"></div>' +
    '<div style="text-align:center">' +
    '<div style="font-size:15px;font-weight:600;color:#F5F0E8;margin-bottom:6px">Gerando roteiro do carrossel...</div>' +
    '<div style="font-size:12px;color:rgba(245,240,232,0.45);max-width:280px;line-height:1.5">' + escapeHtml(tema) + '</div>' +
    '</div>' +
    '<div style="font-size:11px;color:rgba(245,240,232,0.3)">Claude esta escrevendo os 7 slides</div>';
  document.body.appendChild(overlay);
}

function hideCarouselLoadingOverlay() {
  var overlay = document.getElementById('ds-carousel-overlay');
  if (overlay) overlay.remove();
}

async function expandToCarousel(post) {
  showCarouselLoadingOverlay(post.tema || 'Gerando carrossel...');
  try {
    var res = await fetch('/api/content/expand-carousel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tema: post.tema || '',
        hook: post.hook || '',
        desenvolvimento: post.desenvolvimento || '',
        cta: post.cta || '',
        pilar: post.pilar || '',
        formato: post.formato || '',
      }),
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar carrossel.');
    localStorage.setItem('ds_carousel_full', JSON.stringify({
      carousel: data.carousel,
      timestamp: Date.now(),
      fromDataScout: true,
    }));
    hideCarouselLoadingOverlay();
    showToast('Carrossel gerado! Abrindo editor...', 'success');
    window.open('/carousel_editor.html', '_blank');
  } catch (err) {
    hideCarouselLoadingOverlay();
    showToast('Erro ao gerar carrossel: ' + err.message, 'error');
  }
}

// =============================================
// UTILITIES
// =============================================

function setModalLoading(modalId, loading, label) {
  state.isAnalyzing = loading;
  var modal = document.getElementById(modalId);
  var btn = modal.querySelector('.btn-primary');
  var span = btn ? btn.querySelector('span') : null;
  if (loading) {
    btn.disabled = true;
    btn.classList.add('loading');
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    if (span && label) span.textContent = label;
  }
}

function showModalError(modalId, message) {
  var el = document.querySelector('#' + modalId + ' .modal-error');
  if (el) { el.textContent = message; el.classList.remove('hidden'); }
}

function hideModalError(modalId) {
  var el = document.querySelector('#' + modalId + ' .modal-error');
  if (el) el.classList.add('hidden');
}

var _toastTimer = null;
function showToast(message, type) {
  type = type || 'info';
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast toast-' + type + ' visible';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { toast.className = 'toast'; toast.innerHTML = ''; }, 3200);
}

function showUndoToast(message, onUndo) {
  var toast = document.getElementById('toast');
  toast.innerHTML = escapeHtml(message) +
    '<button id="toast-undo-btn" style="margin-left:14px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);color:inherit;padding:3px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">Desfazer</button>';
  toast.className = 'toast toast-info visible';
  clearTimeout(_toastTimer);
  var btn = document.getElementById('toast-undo-btn');
  if (btn) {
    btn.addEventListener('click', function() {
      clearTimeout(_toastTimer);
      toast.className = 'toast';
      toast.innerHTML = '';
      onUndo();
    });
  }
  _toastTimer = setTimeout(function() { toast.className = 'toast'; toast.innerHTML = ''; }, 5000);
}

// =============================================
// BRAND SETUP — Configuracoes do cliente
// =============================================

var _bsPhotosB64 = [];

function setupBrandSetup() {
  if (document.getElementById('view-configuracoes')) {
    carregarDadosCliente();
  }
}

async function carregarDadosCliente() {
  try {
    var res = await fetch('/api/client');
    var client = await res.json();
    preencherFormulario(client);
    atualizarStatusPersonagem(client);
  } catch (e) {
    console.warn('[BrandSetup] Nao foi possivel carregar dados do cliente:', e.message);
  }
}

function preencherFormulario(client) {
  var fields = { 'bs-nome': client.nome, 'bs-especialidade': client.especialidade, 'bs-cidade': client.cidade, 'bs-instagram': client.instagram };
  Object.keys(fields).forEach(function(id) {
    var el = document.getElementById(id);
    if (el && fields[id]) el.value = fields[id];
  });

  // Identidade visual — preenche campos e sincroniza color pickers
  var iv = client.identidade_visual || {};
  var ivFields = {
    'bs-iv-bg-escuro':    iv.bg_escuro    || '',
    'bs-iv-bg-claro':     iv.bg_claro     || '',
    'bs-iv-acento':       iv.acento       || '',
    'bs-iv-texto':        iv.texto        || '',
    'bs-iv-muted':        iv.muted        || '',
    'bs-iv-fonte-titulo': iv.fonte_titulo || '',
    'bs-iv-fonte-corpo':  iv.fonte_corpo  || '',
    'bs-iv-mood':         iv.mood         || '',
    'bs-iv-negativo':     iv.negativo     || '',
  };
  Object.keys(ivFields).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = ivFields[id];
    // Sincroniza o color picker correspondente
    var picker = document.getElementById(id + '-picker');
    if (picker && /^#[0-9A-Fa-f]{6}$/.test(ivFields[id])) {
      picker.value = ivFields[id];
    }
  });

  // Conecta color pickers aos inputs de texto (sincronização bidirecional)
  ['bs-iv-bg-escuro', 'bs-iv-bg-claro', 'bs-iv-acento', 'bs-iv-texto', 'bs-iv-muted'].forEach(function(id) {
    var picker = document.getElementById(id + '-picker');
    var input  = document.getElementById(id);
    if (!picker || !input) return;
    // picker → texto
    picker.addEventListener('input', function() { input.value = picker.value.toUpperCase(); });
    // texto → picker (só se hex válido)
    input.addEventListener('input', function() {
      if (/^#[0-9A-Fa-f]{6}$/.test(input.value)) picker.value = input.value;
    });
  });
}

function atualizarStatusPersonagem(client) {
  var bar   = document.getElementById('brand-status-bar');
  var text  = document.getElementById('brand-status-text');
  var reset = document.getElementById('brand-reset-btn');
  var loraSection = document.getElementById('brand-lora-section');
  if (!bar) return;

  if (client.loraId) {
    bar.innerHTML = '<span class="status-dot status-ok"></span><span>Personagem registrado — ' + escapeHtml(client.nome || 'Cliente') + '</span><button class="btn-link" onclick="resetarPersonagem()">Resetar</button>';
    if (loraSection) loraSection.style.display = 'none';
  } else if (client.nome) {
    bar.innerHTML = '<span class="status-dot status-warn"></span><span>Dados salvos — personagem ainda nao registrado</span>';
    if (loraSection) loraSection.style.display = 'block';
  } else {
    bar.innerHTML = '<span class="status-dot status-warn"></span><span>Nenhum cliente cadastrado</span>';
    if (loraSection) loraSection.style.display = 'none';
  }
}

async function salvarCliente() {
  var btn = document.getElementById('btn-salvar-cliente');
  var nome = (document.getElementById('bs-nome') || {}).value || '';
  if (!nome.trim()) { showToast('Informe o nome do cliente', 'warning'); return; }

  btn.disabled = true;
  btn.textContent = 'Salvando...';
  try {
    var res = await fetch('/api/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome:          (document.getElementById('bs-nome') || {}).value || '',
        especialidade: (document.getElementById('bs-especialidade') || {}).value || '',
        cidade:        (document.getElementById('bs-cidade') || {}).value || '',
        instagram:     (document.getElementById('bs-instagram') || {}).value || '',
        identidade_visual: {
          bg_escuro:    (document.getElementById('bs-iv-bg-escuro')    || {}).value || '',
          bg_claro:     (document.getElementById('bs-iv-bg-claro')     || {}).value || '',
          acento:       (document.getElementById('bs-iv-acento')       || {}).value || '',
          texto:        (document.getElementById('bs-iv-texto')        || {}).value || '',
          muted:        (document.getElementById('bs-iv-muted')        || {}).value || '',
          fonte_titulo: (document.getElementById('bs-iv-fonte-titulo') || {}).value || '',
          fonte_corpo:  (document.getElementById('bs-iv-fonte-corpo')  || {}).value || '',
          mood:         (document.getElementById('bs-iv-mood')         || {}).value || '',
          negativo:     (document.getElementById('bs-iv-negativo')     || {}).value || '',
        },
      }),
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
    showToast('Dados do cliente salvos', 'success');
    atualizarStatusPersonagem(data.client);
    var loraSection = document.getElementById('brand-lora-section');
    if (loraSection) loraSection.style.display = 'block';
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar dados do cliente';
  }
}

function processarFotosBS(input) {
  var files = Array.from(input.files);
  if (files.length < 8) { showToast('Minimo de 8 fotos necessarias', 'warning'); return; }
  if (files.length > 20) { showToast('Maximo de 20 fotos', 'warning'); return; }

  var zone  = document.getElementById('bs-upload-zone');
  var label = document.getElementById('bs-upload-label');
  var count = document.getElementById('bs-photos-count');
  var btn   = document.getElementById('btn-registrar-personagem');

  _bsPhotosB64 = [];
  var loaded = 0;

  files.forEach(function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      _bsPhotosB64.push(e.target.result.split(',')[1]);
      loaded++;
      if (loaded === files.length) {
        if (zone) zone.classList.add('has-files');
        if (label) label.textContent = files.length + ' fotos selecionadas';
        if (count) count.textContent = files.length + ' foto' + (files.length > 1 ? 's' : '') + ' prontas para upload';
        if (btn) btn.style.display = 'inline-flex';
        showToast(files.length + ' fotos carregadas', 'success');
      }
    };
    reader.readAsDataURL(file);
  });
}

async function registrarPersonagemBS() {
  if (_bsPhotosB64.length < 8) { showToast('Selecione as fotos primeiro', 'warning'); return; }

  var btn      = document.getElementById('btn-registrar-personagem');
  var progress = document.getElementById('bs-lora-progress');
  var bar      = document.getElementById('bs-lora-bar');
  var status   = document.getElementById('bs-lora-status');

  btn.disabled = true;
  if (progress) progress.style.display = 'block';
  if (status)   status.textContent = 'Enviando fotos...';
  if (bar)      bar.style.width = '10%';

  try {
    // 1. Upload das fotos
    var uploadRes = await fetch('/api/freepik/upload-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: _bsPhotosB64 }),
    });
    var uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error || 'Erro no upload');

    if (bar) bar.style.width = '40%';
    if (status) status.textContent = 'Registrando personagem no Freepik...';

    // 2. Registrar LoRA
    var loraRes = await fetch('/api/freepik/register-lora', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: uploadData.session_id }),
    });
    var loraData = await loraRes.json();
    if (!loraRes.ok) throw new Error(loraData.error || 'Erro ao registrar');

    if (bar) bar.style.width = '70%';
    if (status) status.textContent = 'Aguardando conclusao do treinamento...';

    // 3. Poll status
    var loraId = await pollLoraStatus(loraData.task_id || loraData.id, bar, status);

    // 4. Salvar no backend
    await fetch('/api/client/lora', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loraId: loraId }),
    });

    if (bar) bar.style.width = '100%';
    if (status) status.textContent = 'Personagem registrado com sucesso!';
    showToast('Personagem registrado no Freepik', 'success');

    setTimeout(function() {
      carregarDadosCliente();
      _bsPhotosB64 = [];
    }, 1500);
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
    if (status) status.textContent = 'Erro: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

async function pollLoraStatus(taskId, barEl, statusEl, attempts) {
  attempts = attempts || 0;
  if (attempts > 60) throw new Error('Timeout: treinamento demorou mais que 5 minutos');

  var res  = await fetch('/api/freepik/check-lora-status?task_id=' + encodeURIComponent(taskId));
  var data = await res.json();

  if (data.status === 'COMPLETED' || data.status === 'completed') {
    return data.lora_id || data.id || taskId;
  }
  if (data.status === 'FAILED' || data.status === 'failed') {
    throw new Error('Treinamento falhou no Freepik');
  }

  var pct = Math.min(70 + attempts * 0.5, 95);
  if (barEl) barEl.style.width = pct + '%';
  if (statusEl) statusEl.textContent = 'Treinando... (' + Math.round(attempts * 5 / 60) + 'min)';

  await new Promise(function(r){ setTimeout(r, 5000); });
  return pollLoraStatus(taskId, barEl, statusEl, attempts + 1);
}

async function resetarPersonagem() {
  if (!confirm('Remover o personagem registrado? Voce precisara registrar novamente para gerar imagens.')) return;
  try {
    await fetch('/api/client/lora', { method: 'DELETE' });
    showToast('Personagem removido', 'info');
    carregarDadosCliente();
  } catch (e) {
    showToast('Erro ao resetar: ' + e.message, 'error');
  }
}

// =============================================
// MODAL FREEPIK PACKAGE [DATASCOUT]
// =============================================

var _fpPkgPost        = null;  // post atual
var _fpPkgPersonagem  = false; // toggle: com ou sem personagem
var _fpPkgHasLora     = false; // se o cliente tem loraId cadastrado

function openFreepikModal(postJson) {
  var post;
  try { post = JSON.parse(postJson); } catch (e) { post = {}; }
  _fpPkgPost = post;

  // Verifica loraId via API antes de abrir
  fetch('/api/client').then(function(r) { return r.json(); }).then(function(client) {
    _fpPkgHasLora    = !!(client.loraId && client.loraId.trim());
    _fpPkgPersonagem = false; // default: sem personagem

    // Configura toggle
    var btnSem = document.getElementById('fp-btn-sem');
    var btnCom = document.getElementById('fp-btn-com');
    var hint   = document.getElementById('fp-pkg-lora-hint');

    btnSem.classList.add('active');
    btnCom.classList.remove('active');

    if (_fpPkgHasLora) {
      btnCom.disabled = false;
      hint.textContent = 'Personagem registrado — ' + (client.nome || 'cliente') + ' · ID: ' + client.loraId.slice(0, 8) + '...';
      hint.style.color = 'var(--accent)';
    } else {
      btnCom.disabled = true;
      hint.textContent = 'Nenhum personagem registrado. Cadastre o LoRA em Configurações para usar esta opção.';
      hint.style.color = 'var(--text-3)';
    }

    // Mostra tema
    document.getElementById('fp-pkg-tema-label').textContent = post.tema || '—';

    // Reseta estado para config
    fpPkgShowState('config');

    // Abre modal
    document.getElementById('modal-freepik-pkg').classList.add('open');
  }).catch(function() {
    _fpPkgHasLora = false;
    document.getElementById('fp-pkg-tema-label').textContent = post.tema || '—';
    fpPkgShowState('config');
    document.getElementById('modal-freepik-pkg').classList.add('open');
  });
}

function fpPkgSetPersonagem(usar) {
  _fpPkgPersonagem = usar && _fpPkgHasLora;
  document.getElementById('fp-btn-sem').classList.toggle('active', !_fpPkgPersonagem);
  document.getElementById('fp-btn-com').classList.toggle('active',  _fpPkgPersonagem);
}

function fpPkgShowState(state) {
  // Painéis
  document.getElementById('fp-pkg-config').style.display  = state === 'config'  ? '' : 'none';
  document.getElementById('fp-pkg-loading').style.display = state === 'loading' ? '' : 'none';
  document.getElementById('fp-pkg-result').style.display  = state === 'result'  ? '' : 'none';
  // Footers
  document.getElementById('fp-pkg-footer-config').style.display = state === 'config' ? 'flex' : 'none';
  document.getElementById('fp-pkg-footer-result').style.display = state === 'result' ? 'flex' : 'none';
}

async function fpPkgGerar() {
  if (!_fpPkgPost) return;

  var errorEl = document.getElementById('fp-pkg-error');
  errorEl.classList.add('hidden');

  fpPkgShowState('loading');

  var post = _fpPkgPost;
  try {
    var res = await fetch('/api/content/generate-carousel-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tema:          post.tema          || '',
        hook:          post.hook          || '',
        desenvolvimento: post.desenvolvimento || '',
        cta:           post.cta           || '',
        pilar:         post.pilar         || '',
        usePersonagem: _fpPkgPersonagem,
      }),
    });

    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar pacote.');

    document.getElementById('fp-pkg-output').value = data.package;
    fpPkgShowState('result');
  } catch (err) {
    fpPkgShowState('config');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

function fpPkgReset() {
  fpPkgShowState('config');
  document.getElementById('fp-pkg-output').value = '';
}

function fpPkgCopiar() {
  var text = document.getElementById('fp-pkg-output').value;
  copyToClipboard(text, 'Pacote copiado — cole no Claude Cowork');
}

function fpPkgFechar() {
  document.getElementById('modal-freepik-pkg').classList.remove('open');
  _fpPkgPost = null;
}

// Wiring dos botões de fechar
document.addEventListener('DOMContentLoaded', function() {
  var overlay = document.getElementById('modal-freepik-pkg');
  document.getElementById('fp-pkg-close').addEventListener('click', fpPkgFechar);
  document.getElementById('fp-pkg-close2').addEventListener('click', fpPkgFechar);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) fpPkgFechar();
  });
});
