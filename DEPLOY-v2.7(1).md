# Site v2.7 — Deploy instructions
# Commit message: v2.7: Materials Timeline, Resources action layer, Graphic 01 retired, nav updated

## What's in this package

Five files to REPLACE in root of repo, one file to ADD:

| File | Action | Notes |
|---|---|---|
| index.html | REPLACE | Updated docs table, five doors (was four), Timeline in nav |
| companions.html | REPLACE | Graphic 01 retired with explanation, Graphic 03 added |
| resources.html | REPLACE | "Where findings go" section added — 5 subsections, ~20 sourced entries |
| revision-history.html | REPLACE | v2.7 row added at top of table |
| sitemap.xml | REPLACE | materials-timeline.html added |
| materials-timeline.html | ADD | New file — interactive chart, drop in root alongside other HTML files |

---

## Nav change — applies to ALL pages not in this package

Every other HTML file on the site (codex.html, calculator.html, corrected-ledger/index.html,
about.html, feedback.html, legal.html, methodology.html, pages/behind-the-curtain.html)
needs one line added to the masthead nav.

Find:
```html
<li><a href="/calculator.html">Calculator</a></li>
```

Add immediately after:
```html
<li><a href="/materials-timeline.html">Timeline</a></li>
```

That's the only change needed to those files.

---

## Deploy order

1. Upload all six files to GitHub via web editor
2. Confirm Cloudflare Pages auto-deploys (usually 30–60 seconds)
3. Verify:
   - https://fullboundarycarbon.org/materials-timeline.html loads and chart renders
   - https://fullboundarycarbon.org/companions.html shows Graphic 01 retirement notice
   - https://fullboundarycarbon.org/resources.html — scroll to "Where findings go" section
   - https://fullboundarycarbon.org/revision-history.html — v2.7 row at top
   - Nav on homepage shows Timeline between Calculator and Resources
4. Update remaining pages (codex.html, about.html, etc.) with nav change above

---

## Graphic 01 retirement note (already in companions.html)

For reference — the text used in the placeholder:

"The static vertical-format document previously published under this heading has been
withdrawn. The format did not represent the relationship between material prices, policy
events, and the biological harvest window with sufficient resolution for a document of
this standard — the five-track layout compressed the data to the point where the
relationships it was intended to make visible were not, in practice, legible.

The interactive timeline (Companion Graphic No. 03, below) supersedes it."

---

## What v2.7 adds to the site's footprint

Resources page now has five off-ramp subsections:
- 6 legislative contacts (US Senate/House Agriculture, NZ Parliament, EU ENVI)
- 4 regulatory comment channels (Regulations.gov, Federal Register, NZ EPA, EC)
- 4 legal organisations (ClientEarth, Earthjustice, Ecojustice, CarbonPlan)
- 5 journalism outlets (Carbon Brief, Inside Climate News, ProPublica, Guardian, GIJN)
- 3 academic channels (Nature, ScienceDirect, Healthy Materials Lab)

Every entry is sourced. Every relevance note ties back to a specific DRL document or finding.
