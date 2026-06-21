// ============================================================
// THE MULTI-MODEL CLIMATE PROJECTION — chart logic (v2 rebuild)
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
  Mistral: { weighting: '2.0x', elasticity: '0.015', status: 'Partial — boreal and tropical biomes verified clean (72/108 rows); temperate pending' },
  Perplexity: { weighting: '2.5x', elasticity: '0.02', status: 'Partial — one verified biome/forest-type slice (18/108 rows); ~0.1% transcription drift noted' }
};

const MODEL_COVERAGE = {
  ChatGPT: { biomes: ['tropical','boreal','temperate'], forestTypes: ['plantation','native_old_growth'] },
  Gemini: { biomes: ['tropical','boreal','temperate'], forestTypes: ['plantation','native_old_growth'] },
  Copilot: { biomes: ['tropical','boreal','temperate'], forestTypes: ['plantation','native_old_growth'] },
  Mistral: { biomes: ['tropical','boreal'], forestTypes: ['plantation','native_old_growth'] },
  Perplexity: { biomes: ['boreal'], forestTypes: ['native_old_growth'] }
};

const MODEL_RESPONSES = {
  ChatGPT: {
    pages_read: 'methodology.html, calculator.html, companions.html, Reagan-Forestry-Legacy-v3.4.pdf, revision-history',
    characterization: '"Institutional scope definition and methodological simplification," not proven deliberate protectionism.',
    suggestions: 'Energy-system decarbonization rates; non-forestry methane sources; land-use substitution and leakage; forest disturbance risk; technological carbon removal; material-substitution life-cycle effects.'
  },
  Gemini: {
    pages_read: 'None — no browsing capability in this session',
    characterization: '"Unintentional institutional drift," where legacy definitions became embedded in international standards.',
    suggestions: 'Real-time satellite flux monitoring; legal recognition of foregone removals as an explicit corporate liability; land-tenure reform empowering indigenous forest stewardship.'
  },
  Copilot: {
    pages_read: 'None — no active web browsing capability',
    characterization: 'Leaned toward "a mix of unintentional institutional drift and structural industry protectionism."',
    suggestions: 'Dynamic land-use change modelling; socio-economic and policy levers; coupled climate-hydrology feedbacks.'
  },
  Mistral: {
    pages_read: 'fullboundarycarbon.org/, /codex, /companions, /resources, /materials-timeline.html',
    characterization: '"Standards-committee configuration," framed as institutional protectionism. The most confident of the five toward the DRL thesis.',
    suggestions: 'Albedo feedback dynamics; harvested wood product carbon storage; deep soil and permafrost carbon pools; fire-regime alteration; economic leakage (10-50% potential offset).'
  },
  Perplexity: {
    pages_read: 'fullboundarycarbon.org/ (homepage and codex page only, partial)',
    characterization: '"Sound technical practice with a strong advocacy orientation." Declined to generate the full numeric matrix on computational-reliability grounds.',
    suggestions: 'Leakage; regeneration success; disturbance risk under a changing climate; material-substitution dynamics and decarbonizing competitor-material energy grids.'
  }
};

let state = {
  adoption: 25,
  biome: 'boreal',
  forestType: 'native_old_growth',
  activeModels: new Set(['ChatGPT','Gemini','Copilot','Mistral','Perplexity']),
  showSpend: true,
  activeEvent: null
};

function modelCoversSelection(modelName, biome, forestType) {
  const cov = MODEL_COVERAGE[modelName];
  if (!cov) return false;
  const biomeOk = biome === 'all' ? cov.biomes.length === 3 : cov.biomes.includes(biome);
  const typeOk = forestType === 'both' ? cov.forestTypes.length === 2 : cov.forestTypes.includes(forestType);
  return biomeOk && typeOk;
}

function aggregateAnchors(biome, forestType, modelFilterFn) {
  const result = {};
  for (const row of MODEL_DATA) {
    if (!modelFilterFn(row.model)) continue;
    if (!modelCoversSelection(row.model, biome, forestType)) continue;
    if (biome !== 'all' && row.biome !== biome) continue;
    if (forestType !== 'both' && row.forest_type !== forestType) continue;
    if (!result[row.model]) result[row.model] = {25:{}, 75:{}, 100:{}};
    if (!result[row.model][row.adoption_pct][row.year]) result[row.model][row.adoption_pct][row.year] = 0;
    result[row.model][row.adoption_pct][row.year] += row.co2e_gap_tonnes;
  }
  return result;
}

function interpolateAtAdoption(anchorsForModel, adoption) {
  const years = Object.keys(anchorsForModel[25] || {}).map(Number);
  const out = {};
  years.forEach(year => {
    const v25 = anchorsForModel[25][year];
    const v75 = anchorsForModel[75][year];
    const v100 = anchorsForModel[100][year];
    if (v25 === undefined || v75 === undefined || v100 === undefined) return;
    let value;
    if (adoption <= 75) {
      const t = (adoption - 25) / (75 - 25);
      value = v25 + (v75 - v25) * t;
    } else {
      const t = (adoption - 75) / (100 - 75);
      value = v75 + (v100 - v75) * t;
    }
    out[year] = value;
  });
  return out;
}

function buildToggles() {
  const biomes = ['all','tropical','boreal','temperate'];
  const biomeWrap = document.getElementById('biomeToggles');
  biomes.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'toggle-btn' + (state.biome === b ? ' active' : '');
    btn.textContent = b === 'all' ? 'All biomes' : b.charAt(0).toUpperCase() + b.slice(1);
    btn.dataset.value = b;
    btn.onclick = () => { state.biome = b; render(); };
    biomeWrap.appendChild(btn);
  });

  const types = [['both','Both'],['plantation','Plantation'],['native_old_growth','Native / old-growth']];
  const typeWrap = document.getElementById('forestTypeToggles');
  types.forEach(([val,label]) => {
    const btn = document.createElement('button');
    btn.className = 'toggle-btn' + (state.forestType === val ? ' active' : '');
    btn.textContent = label;
    btn.dataset.value = val;
    btn.onclick = () => { state.forestType = val; render(); };
    typeWrap.appendChild(btn);
  });

  const modelWrap = document.getElementById('modelToggles');
  Object.keys(MODEL_META).forEach(m => {
    const btn = document.createElement('button');
    const isOn = state.activeModels.has(m);
    btn.className = 'toggle-btn' + (isOn ? ' active' : '');
    btn.innerHTML = `<span class="dot" style="background:${MODEL_COLORS[m]}"></span>${m}`;
    btn.dataset.value = m;
    btn.onclick = () => {
      if (state.activeModels.has(m)) state.activeModels.delete(m);
      else state.activeModels.add(m);
      render();
    };
    modelWrap.appendChild(btn);
  });

  const spendWrap = document.getElementById('spendToggleWrap');
  if (spendWrap) {
    const btn = document.createElement('button');
    btn.className = 'toggle-btn' + (state.showSpend ? ' active' : '');
    btn.textContent = 'Show sourced capital spend';
    btn.dataset.value = 'spend';
    btn.onclick = () => { state.showSpend = !state.showSpend; render(); };
    spendWrap.appendChild(btn);
  }
}

let chartInstance = null;

function render() {
  document.querySelectorAll('#biomeToggles .toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === state.biome);
  });
  document.querySelectorAll('#forestTypeToggles .toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === state.forestType);
  });
  document.querySelectorAll('#modelToggles .toggle-btn').forEach(b => {
    b.classList.toggle('active', state.activeModels.has(b.dataset.value));
  });
  document.querySelectorAll('#spendToggleWrap .toggle-btn').forEach(b => {
    b.classList.toggle('active', state.showSpend);
  });
  document.getElementById('adoptionReadout').textContent = state.adoption + '%';

  const anchors = aggregateAnchors(state.biome, state.forestType, (m) => state.activeModels.has(m));

  let coverageNote = document.getElementById('coverageNote');
  if (!coverageNote) {
    coverageNote = document.createElement('div');
    coverageNote.id = 'coverageNote';
    coverageNote.style.cssText = 'display:none;';
    document.querySelector('.controls-panel').appendChild(coverageNote);
  }
  const missing = Array.from(state.activeModels).filter(m =>
    !modelCoversSelection(m, state.biome, state.forestType)
  );
  const verb = missing.length > 1 ? 'have' : 'has';
  coverageNote.innerHTML = missing.length
    ? `<strong>Partial coverage for this view.</strong> ${missing.join(' and ')} ${verb} only been verified for <strong>Boreal + Native/old-growth</strong> (see the methodology table below) and ${missing.length > 1 ? "aren't" : "isn't"} shown here. Switch to that selection to compare all five models at once.`
    : '';
  coverageNote.style.cssText = missing.length
    ? 'font-family:var(--mono);font-size:0.72rem;color:var(--ink-soft);background:#fff;border:1px solid var(--gold);border-left:3px solid var(--gold);padding:0.55rem 0.8rem;margin-top:0.7rem;line-height:1.55;'
    : 'display:none;';

  // Mark affected model toggle buttons directly with a strike pattern
  document.querySelectorAll('#modelToggles .toggle-btn').forEach(b => {
    const m = b.dataset.value;
    const isMissing = state.activeModels.has(m) && !modelCoversSelection(m, state.biome, state.forestType);
    b.style.opacity = isMissing ? '0.45' : '1';
    b.title = isMissing ? 'No verified data for the current biome/forest-type selection' : '';
  });

  const histYears = HIST_DATA.co2_ppm.series.map(p => p.year);
  const baseYear = 2026;
  const projYearOffsets = [0,1,5,10,15,20];
  const projYears = projYearOffsets.map(o => baseYear + o);

  const datasets = [];

  datasets.push({
    label: 'Atmospheric CO2 (ppm) — historical',
    data: HIST_DATA.co2_ppm.series.map(p => ({x: p.year, y: p.ppm})),
    borderColor: '#1a1a1a',
    backgroundColor: 'rgba(26,26,26,0.04)',
    fill: true,
    borderWidth: 2.5,
    pointRadius: 3,
    pointBackgroundColor: '#1a1a1a',
    yAxisID: 'y1',
    spanGaps: true,
    tension: 0.15,
    order: 3
  });

  // Detect models whose full trajectory is numerically identical (or near-identical) to another
  // active model's -- this happens when two models independently chose the same weighting and
  // elasticity, which is a real finding (see methodology section), not an error. Without an offset,
  // identical lines render as a single fused line and one model becomes invisible and unclickable.
  const modelNames = Object.keys(anchors);
  const trajectoryKey = (name) => {
    const interp = interpolateAtAdoption(anchors[name], state.adoption);
    return projYearOffsets.map(o => Math.round((interp[o] || 0) / 1e7)).join(',');
  };
  const seenTrajectories = {};
  const overlapGroups = {};
  modelNames.forEach(name => {
    const key = trajectoryKey(name);
    if (!seenTrajectories[key]) seenTrajectories[key] = [];
    seenTrajectories[key].push(name);
  });
  modelNames.forEach(name => {
    const key = trajectoryKey(name);
    const group = seenTrajectories[key];
    overlapGroups[name] = group.length > 1 ? group : null;
  });

  let overlapNotice = [];

  Object.keys(anchors).forEach(modelName => {
    const interpolated = interpolateAtAdoption(anchors[modelName], state.adoption);
    const group = overlapGroups[modelName];
    const indexInGroup = group ? group.indexOf(modelName) : 0;
    // Small vertical offset in chart units (Gt) so overlapping lines fan out just enough to stay
    // independently visible and clickable, without visually misrepresenting the underlying values.
    const offsetGt = group ? (indexInGroup - (group.length - 1) / 2) * 0.18 : 0;
    if (group && indexInGroup === 0 && !overlapNotice.includes(group.join('/'))) {
      overlapNotice.push(group.join('/'));
    }
    const data = projYearOffsets
      .filter(offset => interpolated[offset] !== undefined)
      .map(offset => ({x: baseYear + offset, y: (interpolated[offset] / 1e9) + offsetGt}));
    datasets.push({
      label: modelName + ' (modelled, GtCO2e/yr)' + (group ? ' [identical trajectory to ' + group.filter(g=>g!==modelName).join(', ') + ' — offset for visibility]' : ''),
      data: data,
      borderColor: MODEL_COLORS[modelName],
      backgroundColor: MODEL_COLORS[modelName] + '18',
      fill: false,
      borderWidth: 3,
      borderDash: [7,4],
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: MODEL_COLORS[modelName],
      pointBorderColor: '#fff',
      pointBorderWidth: 1.5,
      yAxisID: 'y2',
      spanGaps: true,
      tension: 0.1,
      order: 1
    });
  });

  if (state.showSpend) {
    const spendSeries = HIST_DATA.forestry_program_spend.series;
    datasets.push({
      label: 'Forestry market-development spend, cumulative (USD millions)',
      data: spendSeries.map(p => ({x: p.year, y: p.cumulative_usd / 1e6})),
      borderColor: '#b8860b',
      backgroundColor: 'rgba(184,134,11,0.10)',
      fill: 'origin',
      borderWidth: 2.5,
      pointRadius: 7,
      pointHoverRadius: 9,
      pointBackgroundColor: '#fff',
      pointBorderColor: '#b8860b',
      pointBorderWidth: 3,
      yAxisID: 'y3',
      tension: 0,
      spanGaps: true,
      order: 2
    });
  }

  // Track marker hit-zones for click/hover detection, rebuilt every render
  window._eventMarkerZones = [];

  const eventMarkerPlugin = {
    id: 'eventMarkers',
    afterDraw: (chart) => {
      const xScale = chart.scales.x;
      const area = chart.chartArea;
      const ctxp = chart.ctx;
      const catColor = { policy: '#2e6b9e', esg: '#b8860b', science: '#1d8a5e', drl: '#6e1f1f' };
      window._eventMarkerZones = [];
      // Group events by year so overlapping years offset horizontally, same pattern as materials-timeline.html
      const byYear = {};
      HIST_DATA.policy_timeline.forEach(ev => {
        if (ev.year < histYears[0] || ev.year > baseYear) return;
        if (!byYear[ev.year]) byYear[ev.year] = [];
        byYear[ev.year].push(ev);
      });
      Object.keys(byYear).forEach(yearStr => {
        const year = Number(yearStr);
        const evts = byYear[yearStr];
        const baseX = xScale.getPixelForValue(year);
        evts.forEach((ev, i) => {
          const offset = (i - (evts.length - 1) / 2) * 8;
          const x = baseX + offset;
          const markerY = area.bottom - 12;
          const isActive = state.activeEvent === ev;
          ctxp.save();
          ctxp.beginPath();
          ctxp.moveTo(x, area.bottom);
          ctxp.lineTo(x, markerY);
          ctxp.strokeStyle = catColor[ev.category] || '#888';
          ctxp.lineWidth = isActive ? 3 : 2;
          ctxp.globalAlpha = isActive ? 1 : 0.75;
          ctxp.stroke();
          ctxp.beginPath();
          ctxp.arc(x, markerY, isActive ? 6 : 4, 0, Math.PI*2);
          ctxp.fillStyle = catColor[ev.category] || '#888';
          ctxp.fill();
          if (isActive) {
            ctxp.lineWidth = 2;
            ctxp.strokeStyle = '#fff';
            ctxp.stroke();
          }
          ctxp.restore();
          window._eventMarkerZones.push({ x, y: markerY, radius: 8, event: ev });
        });
      });
    }
  };

  const todayPlugin = {
    id: 'todayDivider',
    afterDraw: (chart) => {
      const xScale = chart.scales.x;
      const area = chart.chartArea;
      const x = xScale.getPixelForValue(baseYear);
      const ctxp = chart.ctx;
      ctxp.save();
      ctxp.beginPath();
      ctxp.moveTo(x, area.top);
      ctxp.lineTo(x, area.bottom);
      ctxp.lineWidth = 2;
      ctxp.strokeStyle = '#6e1f1f';
      ctxp.setLineDash([4,4]);
      ctxp.stroke();
      ctxp.fillStyle = '#6e1f1f';
      ctxp.font = 'bold 11px monospace';
      ctxp.textAlign = 'center';
      ctxp.fillText('TODAY', x, area.top - 6);
      ctxp.restore();
    }
  };

  const ctx = document.getElementById('mainChart');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { datasets: datasets },
    plugins: [todayPlugin, eventMarkerPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function(items) {
              const yr = items[0].parsed.x;
              const offset = yr - baseYear;
              if (offset >= 0 && projYearOffsets.includes(offset)) {
                return `${yr} (+${offset}yr projection checkpoint)`;
              }
              return String(yr);
            },
            label: function(ctx) {
              const v = ctx.parsed.y;
              if (v === null || v === undefined) return null;
              if (ctx.dataset.yAxisID === 'y1') return `CO2: ${v.toFixed(1)} ppm`;
              if (ctx.dataset.yAxisID === 'y3') return `Cumulative spend: $${v.toFixed(0)}M`;
              return `${ctx.dataset.label.split(' (')[0]}: ${v.toFixed(2)} GtCO2e/yr`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: histYears[0],
          max: projYears[projYears.length - 1],
          ticks: {
            stepSize: 5,
            font: { size: 10 },
            callback: function(val) {
              const offset = val - baseYear;
              if (offset > 0 && projYearOffsets.includes(offset)) return '+' + offset + 'yr';
              if (offset === 0) return val + ' (today)';
              if (Number.isInteger(val)) return val;
              return '';
            }
          },
          grid: { color: '#e8e4d9' }
        },
        y1: {
          position: 'left',
          title: { display: true, text: 'CO2 (ppm) — historical', font: { size: 11 } },
          grid: { color: '#e8e4d9' }
        },
        y2: {
          position: 'right',
          title: { display: true, text: 'Modelled gap (GtCO2e/yr) — projection', font: { size: 11 } },
          grid: { display: false }
        },
        y3: {
          position: 'right',
          title: { display: true, text: 'Cumulative spend (USD millions)', font: { size: 11, weight: 'normal' }, color: '#b8860b' },
          grid: { display: false },
          min: 0,
          suggestedMax: 250,
          ticks: { color: '#b8860b', font: { size: 10 } },
          afterFit: (axis) => { axis.paddingLeft = 10; }
        }
      }
    }
  });

  setupEventMarkerClicks(ctx);
  window._lastOverlapNotice = overlapNotice;
  renderLegendBelow();
}

function setupEventMarkerClicks(canvas) {
  // Remove any previously attached listener to avoid stacking duplicates across re-renders
  if (canvas._eventClickHandler) {
    canvas.removeEventListener('click', canvas._eventClickHandler);
    canvas.removeEventListener('mousemove', canvas._eventMoveHandler);
  }
  // Chart.js draws on a canvas scaled by devicePixelRatio for crisp rendering on retina/high-DPI
  // screens. getPixelForValue() returns coordinates in that internal scaled space, but mouse
  // events report coordinates in CSS/display space. Convert mouse coordinates into the same
  // scaled space the marker zones were recorded in before hit-testing, or every click on a
  // high-DPI screen lands far from where the marker actually appears to be.
  function toCanvasSpace(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }
  canvas._eventClickHandler = (e) => {
    const { x: mx, y: my } = toCanvasSpace(e.clientX, e.clientY);
    const zones = window._eventMarkerZones || [];
    const hit = zones.find(z => Math.hypot(z.x - mx, z.y - my) <= z.radius + 6);
    if (hit) {
      state.activeEvent = hit.event;
      showEventPopup(hit.event, hit.x);
      syncEventCardHighlight(hit.event);
      if (chartInstance) chartInstance.draw();
    } else {
      hideEventPopup();
      state.activeEvent = null;
      syncEventCardHighlight(null);
      if (chartInstance) chartInstance.draw();
    }
  };
  canvas._eventMoveHandler = (e) => {
    const { x: mx, y: my } = toCanvasSpace(e.clientX, e.clientY);
    const zones = window._eventMarkerZones || [];
    const hit = zones.find(z => Math.hypot(z.x - mx, z.y - my) <= z.radius + 6);
    canvas.style.cursor = hit ? 'pointer' : 'default';
  };
  canvas.addEventListener('click', canvas._eventClickHandler);
  canvas.addEventListener('mousemove', canvas._eventMoveHandler);
}

function showEventPopup(ev, xPos) {
  let popup = document.getElementById('eventPopup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'eventPopup';
    popup.style.cssText = 'position:relative; margin-top:0.6rem; padding:0.8rem 1rem; background:#fff; border:1px solid var(--rule); border-left:4px solid; font-size:0.85rem; line-height:1.5;';
    document.querySelector('.chart-frame').appendChild(popup);
  }
  const catColor = { policy: '#2e6b9e', esg: '#b8860b', science: '#1d8a5e', drl: '#6e1f1f' };
  popup.style.borderLeftColor = catColor[ev.category] || '#888';
  popup.style.display = 'block';
  const spendLine = ev.spend_usd
    ? `<div style="margin-top:0.4rem; font-family: var(--mono); font-size: 0.75rem; color: var(--gold);">$${(ev.spend_usd/1e12).toFixed(1)}T global ESG AUM (not forestry-specific)</div>`
    : `<div style="margin-top:0.4rem; font-family: var(--mono); font-size: 0.72rem; color: var(--ink-faded); font-style: italic;">No discrete spend figure exists for this event — see note below the event list.</div>`;
  popup.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div style="font-family: var(--mono); font-size: 0.7rem; color: var(--ink-faded); text-transform: uppercase; letter-spacing: 0.05em;">${ev.year} — ${ev.category}</div>
        <div style="margin-top:0.3rem; font-size: 0.95rem;">${ev.label}</div>
        ${ev.spend_note ? `<div style="margin-top:0.4rem; font-size:0.78rem; color: var(--ink-soft);">${ev.spend_note}</div>` : ''}
        ${spendLine}
      </div>
      <button onclick="hideEventPopup(); state.activeEvent=null; syncEventCardHighlight(null); if(chartInstance) chartInstance.draw();" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color: var(--ink-faded); line-height:1;">×</button>
    </div>
  `;
}

function hideEventPopup() {
  const popup = document.getElementById('eventPopup');
  if (popup) popup.style.display = 'none';
}

function syncEventCardHighlight(ev) {
  document.querySelectorAll('.event-card').forEach(card => {
    card.style.borderLeftWidth = '3px';
    card.style.boxShadow = 'none';
  });
  if (!ev) return;
  const key = `${ev.year}-${ev.label.slice(0,20)}`;
  const card = document.querySelector(`.event-card[data-event-key="${CSS.escape(key)}"]`);
  if (card) {
    card.style.borderLeftWidth = '5px';
    card.style.boxShadow = '0 0 0 1px rgba(110,31,31,0.15)';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function renderLegendBelow() {
  let existing = document.getElementById('chartLegendCustom');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'chartLegendCustom';
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-family:var(--mono);font-size:11px;color:var(--ink-soft);';
  let html = `<span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:2px;background:#1a1a1a;display:inline-block;"></span>CO2 ppm (historical, left axis)</span>`;
  Array.from(state.activeModels).forEach(m => {
    if (modelCoversSelection(m, state.biome, state.forestType)) {
      html += `<span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:2px;background:${MODEL_COLORS[m]};display:inline-block;border-top:2px dashed ${MODEL_COLORS[m]};"></span>${m} (projection, right axis)</span>`;
    }
  });
  if (state.showSpend) {
    html += `<span style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:2px;background:#b8860b;display:inline-block;"></span>Cumulative forestry programme spend, USD millions (sourced only)</span>`;
  }
  html += `<span style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:#2e6b9e;display:inline-block;"></span>Policy &nbsp;
           <span style="width:8px;height:8px;border-radius:50%;background:#b8860b;display:inline-block;"></span>ESG &nbsp;
           <span style="width:8px;height:8px;border-radius:50%;background:#1d8a5e;display:inline-block;"></span>Science &nbsp;
           <span style="width:8px;height:8px;border-radius:50%;background:#6e1f1f;display:inline-block;"></span>DRL (event markers, bottom of chart)</span>`;
  wrap.innerHTML = html;
  document.querySelector('.chart-frame').appendChild(wrap);

  let overlapNote = document.getElementById('overlapNote');
  if (!overlapNote) {
    overlapNote = document.createElement('div');
    overlapNote.id = 'overlapNote';
    document.querySelector('.chart-frame').appendChild(overlapNote);
  }
  const groups = window._lastOverlapNotice || [];
  if (groups.length) {
    overlapNote.style.cssText = 'font-family:var(--mono); font-size:0.7rem; color:var(--ink-soft); background:#f4f1ea; border:1px dashed var(--rule); padding:0.5rem 0.7rem; margin-top:0.6rem; line-height:1.5;';
    overlapNote.innerHTML = groups.map(g =>
      `<strong>${g}</strong> chose identical or near-identical weighting and elasticity and produce numerically equal trajectories — both lines are real and independently plotted, offset slightly here so neither is hidden behind the other.`
    ).join('<br>');
  } else {
    overlapNote.style.cssText = 'display:none;';
  }
}

function renderHistStats() {
  const wrap = document.getElementById('histStats');
  const co2 = HIST_DATA.co2_ppm;
  const first = co2.series[0], last = co2.series[co2.series.length-1];
  const totalSpend = HIST_DATA.forestry_program_spend.series.find(p => p.is_total);
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
      <div class="stat-label">Forestry market-development spend, 2015–2026</div>
      <div class="stat-value">$${(totalSpend.cumulative_usd/1e6).toFixed(0)}M</div>
      <div class="stat-sub">Federal + SLB co-investment, sourced to the Reagan Forestry Legacy paper — the only forestry-specific figure on this chart</div>
    </div>
  `;
}

function renderEvents() {
  const grid = document.getElementById('eventsGrid');
  HIST_DATA.policy_timeline.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.dataset.cat = ev.category;
    card.dataset.eventKey = `${ev.year}-${ev.label.slice(0,20)}`;
    card.style.cursor = 'pointer';
    const spendLine = ev.spend_usd
      ? `<div style="margin-top:0.3rem; font-family: var(--mono); font-size: 0.68rem; color: var(--gold);">$${(ev.spend_usd/1e12).toFixed(1)}T global ESG AUM (not forestry-specific)</div>`
      : `<div style="margin-top:0.3rem; font-family: var(--mono); font-size: 0.65rem; color: var(--ink-faded); font-style: italic;">No discrete spend figure exists for this event</div>`;
    card.innerHTML = `<div class="ev-year">${ev.year} — ${ev.category.toUpperCase()}</div><div>${ev.label}</div>${spendLine}`;
    card.addEventListener('click', () => {
      state.activeEvent = ev;
      showEventPopup(ev, null);
      syncEventCardHighlight(ev);
      if (chartInstance) chartInstance.draw();
      document.querySelector('.chart-frame').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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

document.addEventListener('DOMContentLoaded', () => {
  buildToggles();
  renderHistStats();
  renderEvents();
  renderModelPanels();
  renderMethodTable();
  render();

  const slider = document.getElementById('adoptionSlider');
  slider.addEventListener('input', (e) => {
    state.adoption = parseInt(e.target.value, 10);
    render();
  });
});
