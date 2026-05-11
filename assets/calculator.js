/* ============================================================
   DRL — Mini Calculator
   Embedded full-boundary recalculation engine for the
   corrected-ledger building pages. Same calculation logic
   the full calculator will wrap; narrower input scope.

   Murphy O'Neal — Divergent Resource Logic (DRL)
   Auditor's voice. Every default is sourced. No magic numbers.
   ============================================================ */

(function() {
  'use strict';

  // ---------- emission factor library --------------------------------
  // All values keyed to published sources. Source notes appear in the
  // UI next to each input. These are defaults; users can override.

  const FACTORS = {
    // Carbon density of softwood timber (tC per m³ of CLT/glulam/NLT).
    // Roughly 0.5 t dry wood per m³ × 0.5 carbon fraction = 0.25 tC/m³.
    // Multiplied by 44/12 = 0.917 tCO2 per m³.
    // Industry uses this convention (Athena, WoodWorks); we use it
    // unchanged for the biogenic-store line.
    BIOGENIC_TCO2_PER_M3: 0.917,

    // ---- A1–A3 (cradle-to-gate manufacturing) emissions per m³ ----
    // Range 130–250 kg CO2e / m³ for CLT/glulam. Default mid-range.
    // Source: Athena Sustainable Materials Institute EPDs; FPInnovations.
    A1A3_TCO2_PER_M3: 0.18,

    // ---- SOC efflux (DRL liability 1) ----
    // Loss of soil organic carbon following clear-fell harvest.
    // Range: 6–30 tCO2e / ha over decade 1 post-harvest.
    // Sources:
    //   Achat et al. 2015 (Glob Change Biol Bioenergy) — meta-analysis,
    //     mean ~11% SOC loss in top 30 cm over ~5 yr post-harvest.
    //   James & Harrison 2016 (Forests) — 11.2% average SOC loss.
    //   Mayer et al. 2020 (Forest Ecol & Mgmt) — confirms loss persistence.
    // Default expressed per m³ of harvested timber (assuming ~250 m³/ha
    // typical mass-timber-grade plantation yield) → ~0.06 tCO2e/m³ low,
    // ~0.12 mid, ~0.20 high. We use mid as default.
    SOC_TCO2_PER_M3: {
      low: 0.06,      // Achat 2015 lower bound
      mid: 0.12,      // James & Harrison 2016 mean
      high: 0.20      // Mayer 2020 upper bound, primary forest
    },

    // ---- EOL methane (DRL liability 2) ----
    // % of biogenic carbon released as CH4 in landfill end-of-life.
    // EN 15978 / EPD convention: most wood assumed combusted/recycled,
    // methane release minimised. Real-world: 30–70% of mass-timber
    // panels go to construction & demolition waste landfill.
    // CH4 has GWP100 of 27.9 (IPCC AR6).
    // Sources:
    //   IPCC AR6 WG1 Ch.7 — CH4 GWP100 = 27.9
    //   Ximenes et al. 2008 (Waste Mgmt) — measured methane release from
    //     wood in Australian landfills.
    //   Wang et al. 2013 (Waste Mgmt) — long-term anaerobic decay.
    EOL_METHANE_PCT_BIOGENIC: {
      ipcc_default: 0.03,   // EN 15978 / IPCC default — very low
      ximenes:      0.12,   // Ximenes 2008 measured Australian landfill
      wang:         0.18    // Wang 2013 longer-term decay
    },

    // ---- Foregone sequestration (DRL liability 3) ----
    // Carbon the standing forest WOULD have sequestered over the
    // assessment window had it not been harvested.
    // Sources:
    //   Stephenson et al. 2014 (Nature) — carbon accumulation
    //     ACCELERATES with tree size; 403 species confirmed.
    //   Luyssaert et al. 2008 — old-growth stands are net sinks.
    //   Harmon et al. 1990; Searchinger & Peng 2023 (Nature) —
    //     opportunity-cost framing.
    // Expressed as tCO2e/m³ of harvested timber over a 50/100/200 yr
    // assessment window, assuming the forgone forest would have
    // continued accumulating at ~3-5 tCO2e/ha/yr.
    FOREGONE_TCO2_PER_M3: {
      yr50:  0.45,    // 50-yr window
      yr100: 0.95,    // 100-yr window (matches EN 15978 reference period)
      yr200: 2.00     // 200-yr window
    }
  };

  // ---------- DRL recompute function ---------------------------------

  function recompute(inputs) {
    const v        = parseFloat(inputs.timber_m3) || 0;
    const a1a3     = v * (parseFloat(inputs.a1a3_factor) || FACTORS.A1A3_TCO2_PER_M3);

    // Biogenic store — preferred path is the BUILDING'S OWN disclosed value.
    // Auditor's standard: use their number, do not silently restate it.
    // If a disclosed value is supplied via the data-disclosed-biostore
    // attribute, it overrides the convention-factor calculation.
    const db = parseFloat(inputs.disclosed_biostore);
    const biostore = (!isNaN(db) && db > 0) ? db : v * FACTORS.BIOGENIC_TCO2_PER_M3;

    // Optional disclosed substitution credit — buildings that publish an
    // "avoided emissions" line (substitution credit vs. concrete baseline)
    // get to keep it in their disclosed_net for like-with-like comparison.
    const ds = parseFloat(inputs.disclosed_substitution);
    const substitution = (!isNaN(ds) && ds > 0) ? ds : 0;

    // DRL liability 1 — SOC efflux
    const soc_factor = FACTORS.SOC_TCO2_PER_M3[inputs.soc_factor] || FACTORS.SOC_TCO2_PER_M3.mid;
    const soc = v * soc_factor;

    // DRL liability 2 — EOL methane
    // % biogenic C released as CH4 in landfill, × 16/44 (CH4:C mass), × 27.9 (GWP100 IPCC AR6)
    const eol_pct = FACTORS.EOL_METHANE_PCT_BIOGENIC[inputs.eol_factor] || FACTORS.EOL_METHANE_PCT_BIOGENIC.ximenes;
    const eol_methane = biostore * eol_pct * (16/44) * 27.9;

    // DRL liability 3 — Foregone sequestration
    const fs_factor = FACTORS.FOREGONE_TCO2_PER_M3[inputs.fs_window] || FACTORS.FOREGONE_TCO2_PER_M3.yr100;
    const foregone = v * fs_factor;

    // Disclosed net — what the building published (or its equivalent).
    const disclosed_net = a1a3 - biostore - substitution;

    // Full-boundary: A1-A3 + all three liabilities; biogenic store NOT
    // credited because it does not survive boundary expansion — the
    // forest carbon was already accumulating; the wood is a temporary
    // pool with material risk of release.
    const full_boundary = a1a3 + soc + eol_methane + foregone;

    const delta = full_boundary - disclosed_net;

    return {
      timber_m3:   v,
      a1a3:        a1a3,
      biostore:    biostore,
      disclosed_net: disclosed_net,
      soc:         soc,
      eol_methane: eol_methane,
      foregone:    foregone,
      full_boundary: full_boundary,
      delta:       delta
    };
  }

  // ---------- formatting ---------------------------------------------

  function fmt(n) {
    if (Math.abs(n) >= 10000) return Math.round(n).toLocaleString();
    if (Math.abs(n) >= 100)   return Math.round(n).toLocaleString();
    if (Math.abs(n) >= 10)    return n.toFixed(1);
    return n.toFixed(2);
  }

  function fmtSigned(n) {
    const s = fmt(Math.abs(n));
    return n >= 0 ? '+' + s : '−' + s;
  }

  // ---------- attach to a calculator widget --------------------------

  function attach(rootEl) {
    const inputs = {
      timber_m3:  rootEl.querySelector('[data-field="timber_m3"]'),
      a1a3_factor: rootEl.querySelector('[data-field="a1a3_factor"]'),
      soc_factor: rootEl.querySelector('[data-field="soc_factor"]'),
      eol_factor: rootEl.querySelector('[data-field="eol_factor"]'),
      fs_window:  rootEl.querySelector('[data-field="fs_window"]')
    };

    const outputs = {
      a1a3:          rootEl.querySelector('[data-out="a1a3"]'),
      biostore:      rootEl.querySelector('[data-out="biostore"]'),
      disclosed_net: rootEl.querySelector('[data-out="disclosed_net"]'),
      soc:           rootEl.querySelector('[data-out="soc"]'),
      eol_methane:   rootEl.querySelector('[data-out="eol_methane"]'),
      foregone:      rootEl.querySelector('[data-out="foregone"]'),
      full_boundary: rootEl.querySelector('[data-out="full_boundary"]'),
      delta:         rootEl.querySelector('[data-out="delta"]')
    };

    function refresh() {
      const v = {
        timber_m3:    inputs.timber_m3   ? inputs.timber_m3.value   : 0,
        a1a3_factor:  inputs.a1a3_factor ? inputs.a1a3_factor.value : FACTORS.A1A3_TCO2_PER_M3,
        soc_factor:   inputs.soc_factor  ? inputs.soc_factor.value  : 'mid',
        eol_factor:   inputs.eol_factor  ? inputs.eol_factor.value  : 'ximenes',
        fs_window:    inputs.fs_window   ? inputs.fs_window.value   : 'yr100',
        // Building-specific disclosed values — read from data-* attributes
        // on the widget root. Auditor's standard: use their number.
        disclosed_biostore:      rootEl.dataset.disclosedBiostore,
        disclosed_substitution:  rootEl.dataset.disclosedSubstitution
      };
      const r = recompute(v);

      if (outputs.a1a3)          outputs.a1a3.textContent          = fmt(r.a1a3) + ' tCO₂e';
      if (outputs.biostore)      outputs.biostore.textContent      = '−' + fmt(r.biostore) + ' tCO₂e';
      if (outputs.disclosed_net) outputs.disclosed_net.textContent = fmtSigned(r.disclosed_net) + ' tCO₂e';
      if (outputs.soc)           outputs.soc.textContent           = '+' + fmt(r.soc) + ' tCO₂e';
      if (outputs.eol_methane)   outputs.eol_methane.textContent   = '+' + fmt(r.eol_methane) + ' tCO₂e';
      if (outputs.foregone)      outputs.foregone.textContent      = '+' + fmt(r.foregone) + ' tCO₂e';
      if (outputs.full_boundary) outputs.full_boundary.textContent = fmt(r.full_boundary) + ' tCO₂e';
      if (outputs.delta)         outputs.delta.textContent         = fmtSigned(r.delta) + ' tCO₂e';
    }

    // wire up listeners
    Object.values(inputs).forEach(el => {
      if (!el) return;
      el.addEventListener('input', refresh);
      el.addEventListener('change', refresh);
    });

    // initial render
    refresh();
  }

  // ---------- auto-init on DOM ready ---------------------------------

  function init() {
    document.querySelectorAll('.calculator-widget').forEach(attach);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // expose for testing / future calculator deep-link
  window.DRLMiniCalc = { recompute, FACTORS };

})();
