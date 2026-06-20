// ============================================================
// THE MULTI-MODEL CLIMATE PROJECTION — chart logic
// ============================================================

const MODEL_COLORS = {
  ChatGPT: '#2e6b9e',
  Gemini: '#7a4ca0',
  Copilot: '#1d8a5e',
  Mistral: '#c0883a',
  Perplexity: '#a83264'
};

const MODEL_META = {
  ChatGPT: { weighting: '3x', elasticity: '0.02', status: 'Complete — 108/108 rows, verified clean' },
  Gemini: { weighting: '3x', elasticity: '0.02', status: 'Complete — 108/108 rows, verified after two corrected arithmetic errors' },
  Copilot: { weighting: '2x', elasticity: '0.04', status: 'Method fully verified; numeric execution declined on policy grounds and computed independently from Copilot\u2019s own formula' },
  Mistral: { weighting: '2.0x', elasticity: '0.015', status: 'In progress — boreal and tropical biomes verified clean; temperate pending' },
  Perplexity: { weighting: '2.5x', elasticity: '0.02', status: 'Partial — one verified biome/forest-type slice (18 of 108 rows); ~0.1% transcription drift noted' }
};

const MODEL_RESPONSES = {
  ChatGPT: {
    pages_read: 'methodology.html, calculator.html, companions.html, Reagan-Forestry-Legacy-v3.4.pdf, revision-history',
    characterization: '"Institutional scope definition and methodological simplification," not proven deliberate protectionism. Explicitly distinguishes "an exclusion exists" from "the exclusion was intentional" \u2014 the most cautious read of the five.',
    suggestions: 'Energy-system decarbonization rates; non-forestry methane sources (fossil leakage, agriculture, waste); land-use substitution and leakage; forest permanence and disturbance risk under climate change; technological carbon removal (DAC, biochar, enhanced weathering); material-substitution life-cycle effects; biodiversity and social outcomes assessed separately from carbon.'
  },
  Gemini: {
    pages_read: 'None — no browsing capability in this session; proceeded entirely from the prompt\u2019s embedded framework',
    characterization: '"Unintentional institutional drift," where legacy definitions became embedded in international standards, shielding industry from modern climate-accounting realities.',
    suggestions: 'Real-time satellite flux monitoring to replace static coefficients; legal recognition of foregone removals as an explicit corporate liability; land-tenure reform empowering indigenous forest stewardship.'
  },
  Copilot: {
    pages_read: 'None — no active web browsing capability',
    characterization: 'Declined to characterize the pattern in the bulk-data response (task scope was the formula itself); in the qualitative companion exchange leaned toward "a mix of unintentional institutional drift and structural industry protectionism."',
    suggestions: 'Dynamic land-use change modelling (agriculture, urban expansion, forest regrowth interactions); socio-economic and policy levers (subsidies, trade rules, certification incentives, enforcement capacity); coupled climate-hydrology feedbacks (albedo, moisture recycling, extreme-event risk).'
  },
  Mistral: {
    pages_read: 'fullboundarycarbon.org/, /codex, /companions, /resources, /materials-timeline.html',
    characterization: '"Standards-committee configuration," explicitly framed as institutional protectionism: accounting rules structured to avoid penalizing the forestry sector, producing a structural bias that systematically underreports climate impact. The most confident of the five toward the DRL thesis.',
    suggestions: 'Albedo feedback dynamics (latitude-dependent, partially offsetting); harvested wood product carbon storage; deep soil and permafrost carbon pools; fire-regime alteration from management practices; economic leakage and displacement (10-50% potential offset of modelled benefit).'
  },
  Perplexity: {
    pages_read: 'fullboundarycarbon.org/ (homepage and codex page only, partial)',
    characterization: '"Sound technical practice with a strong advocacy orientation." Declined to generate the full numeric matrix on computational-reliability grounds even after every input was fixed \u2014 a distinct failure mode from data-access or policy refusal.',
    suggestions: 'Leakage (harvest reduction in one region displacing pressure elsewhere); regeneration success and whether protected forest actually regrows into a durable sink; disturbance risk (fire, drought, pests, storms) under a changing climate; material-substitution dynamics and decarbonizing competitor-material energy grids.'
  }
};

let state = {
  adoption: 25,
  biome: 'all',
  forestType: 'both',
  activeModels: new Set(['ChatGPT','Gemini','Copilot'])
};

function aggregateForCell(biome, forestType, adoption, modelFilterFn) {
  // Returns { modelName: {year: value} } aggregated by summing matching rows
  const result = {};
  for (const row of MODEL_DATA) {
    if (!modelFilterFn(row.model)) continue;
    if (biome !== 'all' && row.biome !== biome) continue;
    if (forestType !== 'both' && row.forest_type !== forestType) continue;
    if (row.adoption_pct !== adoption) continue;
    if (!result[row.model]) result[row.model] = {};
    if (!result[row.model][row.year]) result[row.model][row.year] = 0;
    result[row.model][row.year] += row.co2e_gap_tonnes;
  }
  return result;
}

function buildToggles() {
  const biomes = ['all','tropical','boreal','temperate'];
  const biomeWrap = document.getElementById('biomeToggles');
  biomes.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'toggle-btn' + (state.biome === b ? ' active' : '');
    btn.textContent = b === 'all' ? 'All biomes' : b.charAt(0).toUpperCase() + b.slice(1);
    btn.onclick = () => { state.biome = b; render(); };
    btn.dataset.value = b;
    biomeWrap.appendChild(btn);
  });

  const types = [['both','Both'],['plantation','Plantation'],['native_old_growth','Native / old-growth']];
  const typeWrap = document.getElementById('forestTypeToggles');
  types.forEach(([val,label]) => {
    const btn = document.createElement('button');
    btn.className = 'toggle-btn' + (state.forestType === val ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => { state.forestType = val; render(); };
    typeWrap.appendChild(btn);
  });

  const modelWrap = document.getElementById('modelToggles');
  Object.keys(MODEL_META).forEach(m => {
    const btn = document.createElement('button');
    const isOn = state.activeModels.has(m);
    btn.className = 'toggle-btn' + (isOn ? ' active' : '');
    btn.innerHTML = `<span class="dot" style="background:${MODEL_COLORS[m]}"></span>${m}`;
    btn.onclick = () => {
      if (state.activeModels.has(m)) state.activeModels.delete(m);
      else state.activeModels.add(m);
      render();
    };
    modelWrap.appendChild(btn);
  });
}

let chartInstance = null;

function render() {
  // update toggle active states
  document.querySelectorAll('#biomeToggles .toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === state.biome);
  });
  document.getElementById('adoptionReadout').textContent = state.adoption + '%';

  const aggregated = aggregateForCell(state.biome, state.forestType, state.adoption, (m) => state.activeModels.has(m));

  // Build labels: historical years + projection years (0,1,5,10,15,20 mapped to 2026-2046)
  const histYears = HIST_DATA.co2_ppm.series.map(p => p.year);
  const projYearOffsets = [0,1,5,10,15,20];
  const baseYear = 2026;
  const projYears = projYearOffsets.map(o => baseYear + o);
  const allLabels = [...histYears, ...projYears.slice(1)]; // avoid duplicate 2026

  const datasets = [];

  // Historical CO2 ppm line (left axis, separate scale shown as background context)
  const co2Map = {};
  HIST_DATA.co2_ppm.series.forEach(p => co2Map[p.year] = p.ppm);
  datasets.push({
    label: 'Atmospheric CO2 (ppm) — historical',
    data: allLabels.map(y => co2Map[y] !== undefined ? co2Map[y] : null),
    borderColor: '#1a1a1a',
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 1.5,
    yAxisID: 'y1',
    spanGaps: true,
    tension: 0.15,
    order: 1
  });

  // Model projection lines (right axis, tonnes CO2e gap)
  Object.keys(aggregated).forEach(modelName => {
    const yearMap = aggregated[modelName];
    const data = allLabels.map(y => {
      const offset = y - baseYear;
      if (offset < 0) return null; // historical region, no projection
      if (!projYearOffsets.includes(offset)) return null;
      return yearMap[offset] !== undefined ? yearMap[offset] / 1e9 : null; // convert to Gt
    });
    datasets.push({
      label: modelName + ' (modelled, GtCO2e/yr)',
      data: data,
      borderColor: MODEL_COLORS[modelName],
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [6,3],
      pointRadius: 3,
      yAxisID: 'y2',
      spanGaps: true,
      tension: 0.1,
      order: 0
    });
  });

  const ctx = document.getElementById('mainChart');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: allLabels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const v = ctx.parsed.y;
              if (v === null) return null;
              if (ctx.dataset.yAxisID === 'y1') return `CO2: ${v.toFixed(1)} ppm`;
              return `${ctx.dataset.label.split(' (')[0]}: ${v.toFixed(2)} GtCO2e/yr`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { autoSkip: true, maxTicksLimit: 14, font: { size: 10 } },
          grid: { color: '#e8e4d9' }
        },
        y1: {
          position: 'left',
          title: { display: true, text: 'CO2 (ppm)', font: { size: 11 } },
          grid: { color: '#e8e4d9' }
        },
        y2: {
          position: 'right',
          title: { display: true, text: 'Modelled gap (GtCO2e/yr)', font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });

  renderLegendBelow();
}

function renderLegendBelow() {
  // build a simple custom legend under controls (re-using events grid styling not needed; quick inline)
  let existing = document.getElementById('chartLegendCustom');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'chartLegendCustom';
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-family:var(--mono);font-size:11px;color:var(--ink-soft);';
  wrap.innerHTML = `<span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:2px;background:#1a1a1a;display:inline-block;"></span>CO2 ppm (historical, left axis)</span>` +
    Array.from(state.activeModels).map(m => `<span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:2px;background:${MODEL_COLORS[m]};display:inline-block;border-top:2px dashed ${MODEL_COLORS[m]};"></span>${m} (projection, right axis)</span>`).join('');
  document.querySelector('.chart-frame').appendChild(wrap);
}

function renderHistStats() {
  const wrap = document.getElementById('histStats');
  const co2 = HIST_DATA.co2_ppm;
  const first = co2.series[0], last = co2.series[co2.series.length-1];
  const peak2020 = HIST_DATA.esg_aum.series.find(p => p.year === 2020);
  wrap.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">CO2, ${first.year}</div>
      <div class="stat-value">${first.ppm} ppm</div>
      <div class="stat-sub">pre-industrial baseline: ${co2.preindustrial_baseline_ppm} ppm</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">CO2, ${last.year}</div>
      <div class="stat-value">${last.ppm} ppm</div>
      <div class="stat-sub">+${(last.ppm-first.ppm).toFixed(1)} ppm since ${first.year}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Rate of rise, 2021–2025</div>
      <div class="stat-value">2.61 ppm/yr</div>
      <div class="stat-sub">vs. 1.33–1.79 ppm/yr required for 1.5°C pathway in the 2010s — accelerating, not slowing</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Sustainable-investment AUM, ${peak2020.year}</div>
      <div class="stat-value">$${peak2020.trillion_usd}T</div>
      <div class="stat-sub">36% of all professionally managed assets globally (GSIA, 2020)</div>
    </div>
  `;
}

function renderEvents() {
  const grid = document.getElementById('eventsGrid');
  HIST_DATA.policy_timeline.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.dataset.cat = ev.category;
    card.innerHTML = `<div class="ev-year">${ev.year} — ${ev.category.toUpperCase()}</div><div>${ev.label}</div>`;
    grid.appendChild(card);
  });
}

function renderModelPanels() {
  const wrap = document.getElementById('modelPanels');
  Object.keys(MODEL_META).forEach(m => {
    const meta = MODEL_META[m];
    const resp = MODEL_RESPONSES[m];
    const panel = document.createElement('div');
    panel.className = 'model-panel m-' + m.toLowerCase();
    panel.innerHTML = `
      <h3>${m}</h3>
      <div class="params">Native/old-growth weighting: ${meta.weighting} &nbsp;·&nbsp; Elasticity: ${meta.elasticity}/yr at 100% adoption &nbsp;·&nbsp; ${meta.status}</div>
      <div><strong>Pages read:</strong> ${resp.pages_read}</div>
      <div style="margin-top:0.5rem;"><strong>What it said was missing from the framework:</strong> ${resp.suggestions}</div>
      <div class="characterization">"${resp.characterization}"</div>
    `;
    wrap.appendChild(panel);
  });
}

function renderMethodTable() {
  const tbody = document.getElementById('methodTableBody');
  Object.keys(MODEL_META).forEach(m => {
    const meta = MODEL_META[m];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="color:${MODEL_COLORS[m]};font-weight:bold;">${m}</td><td>${meta.weighting}</td><td>${meta.elasticity}</td><td>${meta.status}</td>`;
    tbody.appendChild(tr);
  });
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildToggles();
  renderHistStats();
  renderEvents();
  renderModelPanels();
  renderMethodTable();
  render();

  const slider = document.getElementById('adoptionSlider');
  slider.addEventListener('input', (e) => {
    state.adoption = parseInt(e.target.value);
    // snap to nearest valid adoption value (25, 75, 100)
    const valid = [25, 75, 100];
    state.adoption = valid.reduce((a,b) => Math.abs(b-state.adoption) < Math.abs(a-state.adoption) ? b : a);
    render();
  });
});
