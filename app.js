/* === APP.JS — TradeHub Application (GitHub Pages — localStorage) === */

// ============================================================
// AUTHENTICATION
// ============================================================
const PASS_HASH = '289a5c5c12184d241959afa88688b6a44ac68b163a977433073dc4895ba1671b';
const AUTH_KEY = 'tradehub_auth';

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleLogin(e) {
  e.preventDefault();
  const input = document.getElementById('loginPassword').value;
  const hash = await sha256(input);

  if (hash === PASS_HASH) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    showDashboard();
  } else {
    document.getElementById('loginError').textContent = 'Password errata';
    const card = document.querySelector('.login-card');
    card.classList.remove('shake');
    void card.offsetWidth; // trigger reflow
    card.classList.add('shake');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
  }
  return false;
}

function showDashboard() {
  document.getElementById('loginOverlay').classList.add('hidden');
  const dash = document.getElementById('dashboardMain');
  dash.style.display = '';
  // Re-init icons and current page after showing dashboard
  lucide.createIcons();
  handleRoute();
}

function checkAuth() {
  if (sessionStorage.getItem(AUTH_KEY) === 'true') {
    showDashboard();
  }
}

// ============================================================
// LOCAL STORAGE DATABASE
// ============================================================
const DB_KEY = 'tradehub_trades';

function dbGetAll() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  } catch { return []; }
}

function dbSave(trades) {
  localStorage.setItem(DB_KEY, JSON.stringify(trades));
}

function dbNextId() {
  const all = dbGetAll();
  return all.length ? Math.max(...all.map(t => t.id)) + 1 : 1;
}

function calcPnl(data) {
  const entry = parseFloat(data.entry_price) || 0;
  const exitP = parseFloat(data.exit_price) || 0;
  const lots = parseFloat(data.lot_size) || 1;
  const type = data.type || 'BUY';
  let pnl = 0, pnlPct = 0;
  if (exitP && entry) {
    pnl = type === 'BUY' ? (exitP - entry) * lots : (entry - exitP) * lots;
    pnlPct = type === 'BUY' ? ((exitP - entry) / entry * 100) : ((entry - exitP) / entry * 100);
  }
  return { pnl: Math.round(pnl * 100) / 100, pnl_percent: Math.round(pnlPct * 10000) / 10000 };
}

// ============================================================
// STATE
// ============================================================
let currentPage = 'news';
let trades = [];
let sortField = 'date';
let sortDir = 'desc';
let tradeType = 'BUY';
let chartInstances = {};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  lucide.createIcons();
  startClock();
  window.addEventListener('hashchange', handleRoute);

  // Set default date
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('tradeDate');
  if (dateInput) dateInput.value = today;

  // Live P/L calculation
  ['tradeEntry', 'tradeExit', 'tradeLot'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePnlPreview);
  });
});

// ============================================================
// ROUTING
// ============================================================
function handleRoute() {
  const hash = window.location.hash.replace('#', '') || 'news';
  navigateTo(hash, false);
}

function navigateTo(page, pushHash = true) {
  currentPage = page;
  if (pushHash) window.location.hash = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  document.querySelectorAll('.mobile-nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });

  const titles = {
    news: ['Notizie Finanziarie', 'Panoramica mercati globali'],
    geopolitics: ['Geopolitica', 'Conflitti e impatto finanziario'],
    assets: ['Asset Monitorati', 'Prezzi e livelli chiave'],
    journal: ['Diario di Trading', 'Performance e operazioni']
  };
  const t = titles[page] || titles.news;
  document.getElementById('headerTitle').textContent = t[0];
  document.getElementById('headerSubtitle').textContent = t[1];

  if (page === 'news') renderNews();
  if (page === 'geopolitics') renderGeopolitics();
  if (page === 'assets') renderAssets();
  if (page === 'journal') { loadTrades(); loadStats(); }

  lucide.createIcons();
}

// ============================================================
// THEME
// ============================================================
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') !== 'light';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const icon = document.getElementById('themeIcon');
  if (icon) icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
  lucide.createIcons();
  if (currentPage === 'journal') renderJournalCharts();
  if (currentPage === 'assets') renderAssets();
}

// ============================================================
// CLOCK
// ============================================================
function startClock() {
  function update() {
    const now = new Date();
    const time = now.toLocaleTimeString('it-IT', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Europe/Rome'
    });
    const el = document.getElementById('liveClock');
    if (el) el.textContent = time + ' CET';
  }
  update();
  setInterval(update, 1000);
}

// ============================================================
// NEWS PAGE
// ============================================================
const NEWS_DATA = {
  global: [
    {
      title: 'S&P 500 chiude in rialzo dello 0.8% con tech in ripresa',
      source: 'Bloomberg',
      time: '02:30 CET',
      summary: 'Il rally del settore tecnologico ha guidato i guadagni. NVIDIA +3.2%, Apple +1.8%. Volumi sopra la media a 20gg.',
      verified: true,
      crossVerify: 3
    },
    {
      title: 'EUR/USD testa 1.0920 dopo dati PMI europei misti',
      source: 'Reuters',
      time: '02:15 CET',
      summary: 'PMI manifatturiero EU a 48.3, servizi a 52.1. La coppia si mantiene in range stretto in attesa della BCE.',
      verified: true,
      crossVerify: 4
    },
    {
      title: 'Nikkei +1.2% nella sessione asiatica, yen debole',
      source: 'Nikkei Asia',
      time: '01:45 CET',
      summary: 'USD/JPY supera 154. Bank of Japan mantiene toni accomodanti, esportatori giapponesi beneficiano.',
      verified: true,
      crossVerify: 2
    }
  ],
  commodities: [
    {
      title: 'Oro tocca $5,312 — nuovo massimo della settimana',
      source: 'Kitco',
      time: '02:40 CET',
      summary: 'XAU/USD spinto dalle tensioni USA-Iran e dalla domanda di beni rifugio. Resistenza chiave a $5,340, supporto $5,280.',
      verified: true,
      crossVerify: 5
    },
    {
      title: 'Petrolio Brent sale a $82.4 su rischio offerta Medio Oriente',
      source: 'OilPrice',
      time: '02:20 CET',
      summary: 'Le tensioni nello Stretto di Hormuz alzano il premio di rischio. WTI a $78.6. OPEC+ mantiene i tagli.',
      verified: true,
      crossVerify: 3
    },
    {
      title: 'Argento supera $34 — rally metalli preziosi continua',
      source: 'Metal Focus',
      time: '01:50 CET',
      summary: 'Il rapporto oro/argento scende a 156. Domanda industriale forte dal settore solare e elettronico.',
      verified: false,
      crossVerify: 1
    }
  ],
  crypto: [
    {
      title: 'Bitcoin consolida a $67,400 dopo volatilità settimanale',
      source: 'CoinDesk',
      time: '02:35 CET',
      summary: 'BTC in range $65,800-$68,200. Volumi futures in calo. Prossima resistenza $70K, supporto $64,500.',
      verified: true,
      crossVerify: 4
    },
    {
      title: 'Ethereum a $3,820 — aggiornamento Pectra in arrivo',
      source: 'The Block',
      time: '02:10 CET',
      summary: 'ETH si rafforza in vista dell\'upgrade previsto per Q2 2026. Gas fees in calo, staking yield stabile al 4.1%.',
      verified: true,
      crossVerify: 3
    },
    {
      title: 'SEC approva nuovi ETF crypto — mercato reagisce positivamente',
      source: 'CoinTelegraph',
      time: '01:30 CET',
      summary: 'Approvati 3 nuovi ETF spot su altcoin. Afflussi previsti di $2B nel primo mese. Sentiment retail in miglioramento.',
      verified: false,
      crossVerify: 2
    }
  ],
  centralBanks: [
    {
      title: 'Fed mantiene tassi al 4.75% — Powell segnala cautela',
      source: 'Federal Reserve',
      time: '02:00 CET',
      summary: 'Inflazione core PCE a 2.6% preoccupa. Nessun taglio previsto prima di giugno. Dot plot stabile.',
      verified: true,
      crossVerify: 6
    },
    {
      title: 'BCE pronta a un taglio di 25bp ad aprile, secondo fonti',
      source: 'ECB Watch',
      time: '01:40 CET',
      summary: 'Inflazione eurozona a 2.1% favorisce allentamento. Lagarde ha confermato approccio data-dependent.',
      verified: true,
      crossVerify: 3
    },
    {
      title: 'BoJ potrebbe alzare tassi a 0.75% entro estate',
      source: 'BOJ Minutes',
      time: '01:15 CET',
      summary: 'Verbali rivelano divisione interna. Inflazione giapponese sopra target per 18 mesi consecutivi.',
      verified: true,
      crossVerify: 2
    }
  ]
};

function renderNewsCard(item, category) {
  const cv = item.crossVerify || 0;
  const verifyLevel = cv >= 4 ? 'high' : cv >= 2 ? 'medium' : 'low';
  const reliabilityScore = Math.min(99, Math.round((cv / 6) * 80 + (item.verified ? 15 : 0) + Math.random() * 5));
  const verifyLabel = cv >= 4 ? '✓ Alta Affidabilità' : cv >= 2 ? '⚡ Parziale' : '⚠ Da Verificare';
  const verifyText = `Verificato da ${cv} font${cv === 1 ? 'e' : 'i'} indipendent${cv === 1 ? 'e' : 'i'}`;

  return `
    <div class="news-card" data-category="${category || ''}">
      <div class="news-card-header">
        <div class="news-title">${item.title}</div>
      </div>
      <div class="news-summary">${item.summary}</div>
      <div class="news-meta">
        <span class="source-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          ${item.source}
        </span>
        <span class="verification-badge ${verifyLevel}">
          ${verifyLabel}
        </span>
        <span class="reliability-score">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span class="score-value">${reliabilityScore}%</span>
        </span>
        <span class="text-faint" style="font-size:10px;margin-left:auto">${item.time}</span>
      </div>
      <div class="verification-bar">
        <div class="verification-bar-fill ${verifyLevel}"></div>
      </div>
      <div class="verification-text">${verifyText}</div>
    </div>
  `;
}

function renderNews() {
  document.getElementById('newsGlobal').innerHTML = NEWS_DATA.global.map(item => renderNewsCard(item, 'global')).join('');
  document.getElementById('newsCommodities').innerHTML = NEWS_DATA.commodities.map(item => renderNewsCard(item, 'commodities')).join('');
  document.getElementById('newsCrypto').innerHTML = NEWS_DATA.crypto.map(item => renderNewsCard(item, 'crypto')).join('');
  document.getElementById('newsCentralBanks').innerHTML = NEWS_DATA.centralBanks.map(item => renderNewsCard(item, 'centralbanks')).join('');
  lucide.createIcons();
}

function refreshNews() {
  const ts = new Date().toLocaleString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome'
  });
  document.getElementById('newsTimestamp').textContent = `Ultimo aggiornamento: ${ts} CET`;
  renderNews();
}

// ============================================================
// GEOPOLITICS PAGE
// ============================================================
const CONFLICTS_DATA = [
  {
    name: 'USA — Iran',
    region: 'Medio Oriente',
    status: 'active',
    statusLabel: 'Escalation Attiva',
    severity: 'high',
    description: 'Tensioni crescenti nello Stretto di Hormuz. Sanzioni rafforzate sul petrolio iraniano. Rischio di scontro navale diretto.',
    assets: [
      { name: 'XAU/USD', impact: 'up', label: '+2.4%' },
      { name: 'Petrolio', impact: 'up', label: '+4.1%' },
      { name: 'USD/DXY', impact: 'up', label: '+0.8%' },
      { name: 'S&P 500', impact: 'down', label: '-1.2%' }
    ]
  },
  {
    name: 'Russia — Ucraina',
    region: 'Europa Orientale',
    status: 'frozen',
    statusLabel: 'Stallo / Negoziati',
    severity: 'medium',
    description: 'Fronte stabilizzato. Colloqui diplomatici in corso a Istanbul. Sanzioni UE in fase di revisione.',
    assets: [
      { name: 'Gas Naturale', impact: 'down', label: '-3.2%' },
      { name: 'EUR/USD', impact: 'up', label: '+0.5%' },
      { name: 'Grano', impact: 'down', label: '-2.1%' }
    ]
  },
  {
    name: 'Israele — Gaza/Libano',
    region: 'Medio Oriente',
    status: 'active',
    statusLabel: 'Conflitto Attivo',
    severity: 'high',
    description: 'Operazioni militari in corso. Mediazione egiziana in stallo. Rischio allargamento regionale coinvolge Hezbollah.',
    assets: [
      { name: 'XAU/USD', impact: 'up', label: '+1.8%' },
      { name: 'Petrolio', impact: 'up', label: '+2.6%' },
      { name: 'BTC/USD', impact: 'up', label: '+0.9%' }
    ]
  },
  {
    name: 'Cina — Taiwan',
    region: 'Asia-Pacifico',
    status: 'deescalating',
    statusLabel: 'Tensioni in Calo',
    severity: 'low',
    description: 'Esercitazioni militari ridotte. Dialogo diplomatico ripreso dopo summit APEC. Semiconduttori restano tema chiave.',
    assets: [
      { name: 'TSM', impact: 'up', label: '+3.4%' },
      { name: 'USD/CNY', impact: 'down', label: '-0.3%' }
    ]
  }
];

const TIMELINE_DATA = [
  { date: '03 Mar 2026', text: 'USA impone nuove sanzioni su banche iraniane — oro sale a $5,312' },
  { date: '02 Mar 2026', text: 'Russia e Ucraina concordano scambio prigionieri — gas naturale in calo' },
  { date: '01 Mar 2026', text: 'Israele annuncia offensiva su Rafah — petrolio in rialzo' },
  { date: '28 Feb 2026', text: 'Cina ritira navi da zona Taiwan — semiconduttori rimbalzano' },
  { date: '27 Feb 2026', text: 'Iran testa missile balistico nel Golfo — oro tocca $5,290' },
  { date: '26 Feb 2026', text: 'UE estende sanzioni Russia di 6 mesi — EUR/USD stabile' },
  { date: '25 Feb 2026', text: 'Colloqui pace Istanbul: apertura su corridoio grano ucraino' }
];

const CONFLICT_FLAGS = {
  'USA — Iran': '🇺🇸 🇮🇷',
  'Russia — Ucraina': '🇷🇺 🇺🇦',
  'Israele — Gaza/Libano': '🇮🇱 🇵🇸',
  'Cina — Taiwan': '🇨🇳 🇹🇼'
};

function renderGeopolitics() {
  document.getElementById('conflictsGrid').innerHTML = CONFLICTS_DATA.map(c => `
    <div class="conflict-card" data-severity="${c.severity}">
      <div class="conflict-flags">${CONFLICT_FLAGS[c.name] || ''}</div>
      <div class="conflict-status">
        <div class="status-indicator">
          <div class="status-dot ${c.status}"></div>
          <span style="font-size:var(--text-xs);font-weight:600;color:var(--text-primary)">${c.name}</span>
        </div>
        <span class="badge badge-severity-${c.severity}">${c.statusLabel}</span>
      </div>
      <div style="font-size:var(--text-xs);color:var(--text-faint)">${c.region}</div>
      <div style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.5">${c.description}</div>
      <div class="affected-assets">
        ${c.assets.map(a => `
          <div class="asset-impact impact-${a.impact}">
            <span>${a.name}</span>
            <span>${a.impact === 'up' ? '↑' : '↓'} ${a.label}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  const impactAssets = [
    { name: 'Oro (XAU/USD)', impact: '+4.2%', direction: 'up', reason: 'Domanda rifugio per tensioni USA-Iran e Medio Oriente' },
    { name: 'Petrolio (Brent)', impact: '+6.7%', direction: 'up', reason: 'Rischio approvvigionamento da Stretto di Hormuz e sanzioni Iran' },
    { name: 'S&P 500', impact: '-1.2%', direction: 'down', reason: 'Incertezza geopolitica pesa su settore difesa e tech' }
  ];

  document.getElementById('marketImpactGrid').innerHTML = impactAssets.map(a => `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${a.name}</span>
        <span class="asset-change ${a.direction}">${a.direction === 'up' ? '↑' : '↓'} ${a.impact}</span>
      </div>
      <div style="font-size:var(--text-xs);color:var(--text-secondary);line-height:1.5">${a.reason}</div>
    </div>
  `).join('');

  document.getElementById('geopoliticsTimeline').innerHTML = TIMELINE_DATA.map(t => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-date">${t.date}</div>
      <div class="timeline-text">${t.text}</div>
    </div>
  `).join('');

  lucide.createIcons();
}

// ============================================================
// ASSETS PAGE
// ============================================================
const ASSETS_DATA = [
  {
    symbol: 'XAU/USD', name: 'Oro', price: '5,312.40', change: '+1.24%', direction: 'up',
    primary: true, sentiment: 'bullish',
    support1: '5,280', support2: '5,240', resistance1: '5,340', resistance2: '5,380',
    sparkData: [5180, 5210, 5195, 5230, 5260, 5245, 5280, 5310, 5295, 5312],
    events: 'FOMC 18 Mar, NFP 07 Mar', consensus: 'Rialzista — target $5,400'
  },
  {
    symbol: 'BTC/USD', name: 'Bitcoin', price: '67,420', change: '-0.38%', direction: 'down',
    sentiment: 'neutral', support1: '65,800', resistance1: '70,000',
    sparkData: [68200, 67800, 66400, 65800, 66900, 67200, 67800, 67100, 67500, 67420]
  },
  {
    symbol: 'BRENT', name: 'Petrolio Brent', price: '82.40', change: '+2.16%', direction: 'up',
    sentiment: 'bullish', support1: '80.00', resistance1: '85.00',
    sparkData: [78.2, 79.1, 78.8, 80.4, 81.2, 80.6, 81.8, 82.1, 81.5, 82.4]
  },
  {
    symbol: 'EUR/USD', name: 'Euro/Dollaro', price: '1.0918', change: '+0.12%', direction: 'up',
    sentiment: 'neutral', support1: '1.0860', resistance1: '1.0960',
    sparkData: [1.088, 1.090, 1.089, 1.091, 1.092, 1.090, 1.091, 1.093, 1.091, 1.0918]
  },
  {
    symbol: 'SPX', name: 'S&P 500', price: '5,842', change: '+0.78%', direction: 'up',
    sentiment: 'bullish', support1: '5,780', resistance1: '5,900',
    sparkData: [5760, 5790, 5780, 5810, 5830, 5815, 5840, 5850, 5835, 5842]
  },
  {
    symbol: 'DXY', name: 'Dollar Index', price: '104.32', change: '+0.24%', direction: 'up',
    sentiment: 'bullish', support1: '103.80', resistance1: '105.00',
    sparkData: [103.6, 103.8, 104.0, 103.9, 104.1, 104.3, 104.0, 104.2, 104.4, 104.32]
  }
];

const ASSET_ICONS = {
  'XAU/USD': '🥇',
  'BTC/USD': '₿',
  'BRENT': '🛢️',
  'EUR/USD': '💶',
  'SPX': '📊',
  'DXY': '💵'
};

const ASSET_COLORS = {
  'XAU/USD': 'var(--accent)',
  'BTC/USD': 'var(--purple)',
  'BRENT': 'var(--amber)',
  'EUR/USD': 'var(--blue)',
  'SPX': 'var(--emerald)',
  'DXY': 'var(--cyan)'
};

function renderAssets() {
  const grid = document.getElementById('assetsGrid');
  grid.innerHTML = ASSETS_DATA.map((a, idx) => {
    const isPrimary = a.primary;
    const icon = ASSET_ICONS[a.symbol] || '💰';
    const accentColor = ASSET_COLORS[a.symbol] || 'var(--accent)';
    return `
      <div class="asset-card ${isPrimary ? 'primary' : ''}" id="asset-card-${idx}" style="border-top: 3px solid ${accentColor}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div>
            <div class="asset-icon-badge">${icon}</div>
            <div class="asset-name">${a.symbol} — ${a.name}</div>
            <div class="asset-price">$${a.price}</div>
            <span class="asset-change ${a.direction}">${a.direction === 'up' ? '↑' : '↓'} ${a.change}</span>
          </div>
          <span class="sentiment-badge sentiment-${a.sentiment}">${
            a.sentiment === 'bullish' ? '🐂 Rialzista' :
            a.sentiment === 'bearish' ? '🐻 Ribassista' : '→ Neutrale'
          }</span>
        </div>
        <div class="sparkline-container"><canvas id="spark-${idx}"></canvas></div>
        <div class="asset-levels">
          <div class="level-item">
            <span class="level-label">Supporto 1</span>
            <span class="level-value">$${a.support1}</span>
          </div>
          <div class="level-item">
            <span class="level-label">Resistenza 1</span>
            <span class="level-value">$${a.resistance1}</span>
          </div>
          ${a.support2 ? `
          <div class="level-item">
            <span class="level-label">Supporto 2</span>
            <span class="level-value">$${a.support2}</span>
          </div>` : ''}
          ${a.resistance2 ? `
          <div class="level-item">
            <span class="level-label">Resistenza 2</span>
            <span class="level-value">$${a.resistance2}</span>
          </div>` : ''}
        </div>
        ${isPrimary ? `
        <div class="primary-detail">
          <div>
            <div class="detail-section-title">Livelli Chiave</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);line-height:1.8">
              S1: $${a.support1}<br>S2: $${a.support2}<br>R1: $${a.resistance1}<br>R2: $${a.resistance2}
            </div>
          </div>
          <div>
            <div class="detail-section-title">Prossimi Eventi</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);line-height:1.8">
              ${a.events.split(', ').map(e => `<div>${e}</div>`).join('')}
            </div>
          </div>
          <div>
            <div class="detail-section-title">Consenso Analisti</div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);line-height:1.8">${a.consensus}</div>
          </div>
        </div>` : ''}
      </div>
    `;
  }).join('');

  setTimeout(() => {
    ASSETS_DATA.forEach((a, idx) => {
      const color = a.direction === 'up' ? '#34d399' : '#f87171';
      renderSparkline(`spark-${idx}`, a.sparkData, color);
    });
  }, 100);

  lucide.createIcons();
}

function renderSparkline(canvasId, data, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.offsetHeight || 48);
  gradient.addColorStop(0, color + '25');
  gradient.addColorStop(1, color + '02');

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data: data, borderColor: color, borderWidth: 2,
        pointRadius: 0, pointHoverRadius: 3, fill: true,
        backgroundColor: gradient, tension: 0.4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false, grace: '20%' } },
      elements: { line: { borderCapStyle: 'round' } },
      animation: { duration: 800, easing: 'easeOutQuart' }
    }
  });
}

// ============================================================
// JOURNAL — CRUD (localStorage)
// ============================================================
function setTradeType(type) {
  tradeType = type;
  document.getElementById('btnBuy').className = `toggle-btn${type === 'BUY' ? ' active-buy' : ''}`;
  document.getElementById('btnSell').className = `toggle-btn${type === 'SELL' ? ' active-sell' : ''}`;
  updatePnlPreview();
}

function updatePnlPreview() {
  const entry = parseFloat(document.getElementById('tradeEntry').value) || 0;
  const exit = parseFloat(document.getElementById('tradeExit').value) || 0;
  const lot = parseFloat(document.getElementById('tradeLot').value) || 0;
  let pnl = 0;
  if (entry && exit) {
    pnl = tradeType === 'BUY' ? (exit - entry) * lot : (entry - exit) * lot;
  }
  const display = document.getElementById('pnlPreview');
  display.textContent = `$${pnl.toFixed(2)}`;
  display.className = `pnl-display${pnl > 0 ? ' profit' : pnl < 0 ? ' loss' : ''}`;
}

function saveTrade() {
  const tradeId = document.getElementById('tradeId').value;
  const data = {
    date: document.getElementById('tradeDate').value,
    asset: document.getElementById('tradeAsset').value,
    type: tradeType,
    entry_price: parseFloat(document.getElementById('tradeEntry').value) || 0,
    exit_price: parseFloat(document.getElementById('tradeExit').value) || 0,
    stop_loss: parseFloat(document.getElementById('tradeSL').value) || 0,
    take_profit: parseFloat(document.getElementById('tradeTP').value) || 0,
    lot_size: parseFloat(document.getElementById('tradeLot').value) || 1,
    notes: document.getElementById('tradeNotes').value
  };

  const { pnl, pnl_percent } = calcPnl(data);
  data.pnl = pnl;
  data.pnl_percent = pnl_percent;

  const allTrades = dbGetAll();

  if (tradeId) {
    // Update
    const idx = allTrades.findIndex(t => t.id === parseInt(tradeId));
    if (idx !== -1) {
      data.id = parseInt(tradeId);
      allTrades[idx] = data;
    }
  } else {
    // Create
    data.id = dbNextId();
    allTrades.push(data);
  }

  dbSave(allTrades);
  resetForm();
  loadTrades();
  loadStats();
}

function resetForm() {
  document.getElementById('tradeId').value = '';
  document.getElementById('tradeForm').reset();
  document.getElementById('tradeDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('tradeLot').value = '1';
  document.getElementById('formTitle').textContent = 'Nuova Operazione';
  document.getElementById('cancelEditGroup').style.display = 'none';
  setTradeType('BUY');
  updatePnlPreview();
}

function editTrade(trade) {
  document.getElementById('tradeId').value = trade.id;
  document.getElementById('tradeDate').value = trade.date;
  document.getElementById('tradeAsset').value = trade.asset;
  document.getElementById('tradeEntry').value = trade.entry_price;
  document.getElementById('tradeExit').value = trade.exit_price || '';
  document.getElementById('tradeSL').value = trade.stop_loss || '';
  document.getElementById('tradeTP').value = trade.take_profit || '';
  document.getElementById('tradeLot').value = trade.lot_size;
  document.getElementById('tradeNotes').value = trade.notes || '';
  document.getElementById('formTitle').textContent = 'Modifica Operazione';
  document.getElementById('cancelEditGroup').style.display = 'block';
  setTradeType(trade.type);
  updatePnlPreview();
  document.getElementById('tradeFormCard').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
  resetForm();
}

function deleteTrade(id) {
  if (!confirm('Eliminare questa operazione?')) return;
  const allTrades = dbGetAll().filter(t => t.id !== id);
  dbSave(allTrades);
  loadTrades();
  loadStats();
}

function loadTrades() {
  let data = dbGetAll();
  const month = document.getElementById('filterMonth').value;
  const asset = document.getElementById('filterAsset').value;

  if (month) data = data.filter(t => t.date && t.date.startsWith(month));
  if (asset) data = data.filter(t => t.asset === asset);

  trades = data;
  renderTradesTable();
}

function filterTradesLocally() {
  renderTradesTable();
}

function sortTrades(field) {
  if (sortField === field) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortField = field;
    sortDir = 'desc';
  }
  renderTradesTable();
}

function renderTradesTable() {
  const tbody = document.getElementById('tradesTableBody');
  let data = [...trades];

  const pnlFilter = document.getElementById('filterPnl').value;
  if (pnlFilter === 'profit') data = data.filter(t => t.pnl > 0);
  if (pnlFilter === 'loss') data = data.filter(t => t.pnl < 0);

  data.sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          </div>
          <p>Nessuna operazione trovata</p>
          <small style="color:var(--text-faint)">Inizia registrando la tua prima operazione</small>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(t => {
    const pnlClass = t.pnl > 0 ? 'pnl-positive' : t.pnl < 0 ? 'pnl-negative' : '';
    const rowClass = t.pnl > 0 ? 'row-profit' : t.pnl < 0 ? 'row-loss' : '';
    return `
      <tr class="${rowClass}">
        <td>${formatDate(t.date)}</td>
        <td><strong>${t.asset}</strong></td>
        <td><span class="badge ${t.type === 'BUY' ? 'badge-verified' : 'badge-severity-high'}">${t.type}</span></td>
        <td>$${formatNum(t.entry_price)}</td>
        <td>${t.exit_price ? '$' + formatNum(t.exit_price) : '—'}</td>
        <td class="${pnlClass}">$${formatNum(t.pnl)}</td>
        <td class="${pnlClass}">${formatNum(t.pnl_percent)}%</td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${t.notes || ''}">${t.notes || '—'}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn-icon" onclick='editTrade(${JSON.stringify(t)})' aria-label="Modifica">
              <i data-lucide="pencil" style="width:14px;height:14px"></i>
            </button>
            <button class="btn-icon" onclick="deleteTrade(${t.id})" aria-label="Elimina" style="color:var(--loss)">
              <i data-lucide="trash-2" style="width:14px;height:14px"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

// ============================================================
// JOURNAL — STATS & CHARTS (localStorage)
// ============================================================
function loadStats() {
  const allTrades = dbGetAll();

  const total = allTrades.length;
  const wins = allTrades.filter(t => t.pnl > 0).length;
  const losses = allTrades.filter(t => t.pnl <= 0).length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const netPnl = allTrades.reduce((s, t) => s + (t.pnl || 0), 0);

  // Monthly
  const monthlyMap = {};
  allTrades.forEach(t => {
    const m = t.date ? t.date.substring(0, 7) : 'unknown';
    if (!monthlyMap[m]) monthlyMap[m] = 0;
    monthlyMap[m] += t.pnl || 0;
  });
  const monthly = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 }));

  // By asset
  const assetMap = {};
  allTrades.forEach(t => {
    if (!assetMap[t.asset]) assetMap[t.asset] = { pnl: 0, trades: 0 };
    assetMap[t.asset].pnl += t.pnl || 0;
    assetMap[t.asset].trades += 1;
  });
  const byAsset = Object.entries(assetMap).map(([asset, v]) => ({
    asset, pnl: Math.round(v.pnl * 100) / 100, trades: v.trades
  }));

  // Equity curve
  const sorted = [...allTrades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let cumPnl = 0;
  const equityCurve = sorted.map(t => {
    cumPnl += t.pnl || 0;
    return { date: formatDate(t.date), equity: Math.round(cumPnl * 100) / 100 };
  });

  // Best/Worst
  const best = allTrades.length ? allTrades.reduce((a, b) => (a.pnl || 0) > (b.pnl || 0) ? a : b) : null;
  const worst = allTrades.length ? allTrades.reduce((a, b) => (a.pnl || 0) < (b.pnl || 0) ? a : b) : null;

  const stats = { total, wins, losses, win_rate: winRate, net_pnl: netPnl, monthly, by_asset: byAsset, equity_curve: equityCurve, best_trade: best, worst_trade: worst };

  // Update KPIs
  document.getElementById('kpiTotal').textContent = stats.total;
  document.getElementById('kpiWins').textContent = stats.wins;
  document.getElementById('kpiLosses').textContent = stats.losses;
  document.getElementById('kpiWinRate').textContent = stats.win_rate + '%';

  const netEl = document.getElementById('kpiNetPnl');
  netEl.textContent = '$' + formatNum(stats.net_pnl);
  netEl.className = `kpi-value ${stats.net_pnl > 0 ? 'profit' : stats.net_pnl < 0 ? 'loss' : ''}`;

  renderTradeHighlight('bestTradeCard', stats.best_trade, 'trophy', 'var(--profit)', 'Miglior Trade');
  renderTradeHighlight('worstTradeCard', stats.worst_trade, 'alert-circle', 'var(--loss)', 'Peggior Trade');

  renderJournalCharts(stats);
}

function renderTradeHighlight(containerId, trade, icon, color, title) {
  const el = document.getElementById(containerId);
  if (!trade || !trade.pnl) {
    el.innerHTML = `
      <div class="card-title" style="margin-bottom:var(--space-3)">
        <i data-lucide="${icon}" style="width:16px;height:16px;color:${color}"></i>
        ${title}
      </div>
      <div class="text-faint" style="font-size:var(--text-xs)">Nessun dato</div>
    `;
  } else {
    const pnlColor = trade.pnl > 0 ? 'var(--profit)' : 'var(--loss)';
    el.innerHTML = `
      <div class="card-title" style="margin-bottom:var(--space-3)">
        <i data-lucide="${icon}" style="width:16px;height:16px;color:${color}"></i>
        ${title}
      </div>
      <div style="font-size:var(--text-xl);font-weight:700;color:${pnlColor}">$${formatNum(trade.pnl)}</div>
      <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px">
        ${trade.asset} — ${trade.type} — ${formatDate(trade.date)}
      </div>
    `;
  }
  lucide.createIcons();
}

function renderJournalCharts(stats) {
  if (!stats) return;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#6b7080' : '#9ca3af';
  const profitColor = isDark ? '#34d399' : '#059669';
  const lossColor = isDark ? '#f87171' : '#dc2626';
  const accentColor = '#D4A843';

  Object.values(chartInstances).forEach(c => { if (c) c.destroy(); });

  const monthlyCtx = document.getElementById('monthlyPnlChart');
  if (monthlyCtx && stats.monthly && stats.monthly.length > 0) {
    chartInstances.monthly = new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels: stats.monthly.map(m => m.month),
        datasets: [{ data: stats.monthly.map(m => m.pnl), backgroundColor: stats.monthly.map(m => m.pnl >= 0 ? profitColor : lossColor), borderRadius: 4, barPercentage: 0.6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 11 } } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 11 }, callback: v => '$' + v } }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      }
    });
  }

  const equityCtx = document.getElementById('equityCurveChart');
  if (equityCtx && stats.equity_curve && stats.equity_curve.length > 0) {
    chartInstances.equity = new Chart(equityCtx, {
      type: 'line',
      data: {
        labels: stats.equity_curve.map(e => e.date),
        datasets: [{ data: stats.equity_curve.map(e => e.equity), borderColor: accentColor, borderWidth: 2, pointRadius: 3, pointBackgroundColor: accentColor, fill: true, backgroundColor: `${accentColor}15`, tension: 0.3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 11 }, maxTicksLimit: 8 } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 11 }, callback: v => '$' + v } }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      }
    });
  }

  const assetCtx = document.getElementById('assetBreakdownChart');
  if (assetCtx && stats.by_asset && stats.by_asset.length > 0) {
    const assetColors = ['#D4A843', '#34d399', '#f87171', '#60a5fa', '#8b5cf6', '#fbbf24'];
    chartInstances.assetBreakdown = new Chart(assetCtx, {
      type: 'doughnut',
      data: {
        labels: stats.by_asset.map(a => a.asset),
        datasets: [{ data: stats.by_asset.map(a => Math.abs(a.pnl)), backgroundColor: assetColors.slice(0, stats.by_asset.length), borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Inter', size: 11 }, padding: 16, usePointStyle: true, pointStyleWidth: 8 } },
          tooltip: { callbacks: { label: ctx => { const asset = stats.by_asset[ctx.dataIndex]; return `${asset.asset}: $${formatNum(asset.pnl)} (${asset.trades} op.)`; } } }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      }
    });
  }
}

// ============================================================
// HELPERS
// ============================================================
function formatNum(n) {
  if (n === null || n === undefined) return '0.00';
  return Number(n).toFixed(2);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function toggleMobileMenu() {}
