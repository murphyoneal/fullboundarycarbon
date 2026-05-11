"""
DRL — Reproduction Sheet generator.

Produces, for each populated ledger building, two artifacts:
  1. A PDF — the audit working papers, formatted for legal review
  2. A CSV — the raw inputs, factors, and outputs

The PDF is the load-bearing defensive document. If a building owner,
architect, or certification body disputes the corrected number, the
PDF is the response. It shows every input, every emission factor,
every citation, every arithmetic step.

Auditor's voice. Murphy O'Neal. No hedging. Verifiable.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
import csv
import os

# Brand palette — mirrors site CSS
INK         = colors.HexColor("#1a1714")
INK_SOFT    = colors.HexColor("#3a342d")
INK_FADED   = colors.HexColor("#6b6256")
PAPER_WARM  = colors.HexColor("#ebe6dc")
RULE        = colors.HexColor("#b8ad99")
RULE_FAINT  = colors.HexColor("#d4c9b3")
OXBLOOD     = colors.HexColor("#6b1d1d")

# -------------------------------------------------------------------
# Building data registry
# -------------------------------------------------------------------

BUILDINGS = {
    "brock-commons": {
        "id":        "brock-commons",
        "title":     "Brock Commons Tallwood House",
        "subtitle":  "An 18-storey hybrid mass timber student residence, University of British Columbia",
        "location":  "Vancouver, British Columbia, Canada",
        "completed": "August 2017",
        "use":       "Student residence (404 beds)",
        "gfa_m2":    15120,
        "storeys":   18,
        "owner":     "University of British Columbia",
        "architect": "Acton Ostry Architects Inc.",
        "structural":"Fast + Epp",
        "lca_practitioner": "Athena Sustainable Materials Institute (Matt Bowick, author)",
        "lca_standard":     "EN 15978:2011, 100-year reference study period",
        "certification":    "LEED Gold",
        "wood_supplier":    "Structurlam Products",
        "wood_origin":      "British Columbia interior softwood, long-rotation managed forest",
        "public_sources": [
            ("Athena EBD (Bowick 2018)",
             "https://www.naturallywood.com/wp-content/uploads/Tallwood_House_Environmental_Declaration_20180608.pdf"),
            ("Canadian Wood Council case study",
             "https://cwc.ca/wp-content/uploads/2018/04/CS-BrockCommon.Study_.8.pdf"),
        ],
        "disclosed": {
            "timber_m3":           2233,
            "biogenic_stored":     1753,    # tCO2e (CWC)
            "substitution_avoided":679,     # tCO2e (CWC)
            "total_wood_benefit":  2432,    # tCO2e (CWC)
            "wholebldg_gwp_100yr": 29900,   # tCO2e (Athena)
            "per_m2_gwp":          1977,    # kg CO2e/m2 (derived)
        },
        "boundary_quotes": [
            ("On excluded module B1",
             "B1: there is currently insufficient consensus in terms of methodology and data to practically quantify these effects for all products used in the building.",
             "Athena EBD, p. 13"),
            ("On end-of-waste allocation",
             "This assessment assumes that once the material is either [1] separated for recycling, reuse, or energy recovery purposes or [2] disposed of (i.e. either via landfill or incineration), it has reached its end-of-waste state.",
             "Athena EBD, p. 14"),
        ],
        "recompute_inputs": {
            "timber_m3":              2233,
            "a1a3_factor":            0.18,
            "biogenic_factor":        0.917,
            "disclosed_biostore":     1753,   # CWC case study, building's own number
            "disclosed_substitution": 679,    # CWC case study substitution credit
            "soc_band":               "mid",
            "soc_factor":             0.12,
            "eol_band":               "ximenes",
            "eol_pct":                0.12,
            "fs_band":                "yr100",
            "fs_factor":              0.95,
        },
        "notes": [
            "Biogenic-storage line uses the EN 15978 convention factor of 0.917 tCO2e per m3 of softwood timber, which corresponds to ~0.25 tC stored per m3 multiplied by 44/12 to convert C to CO2e.",
            "End-of-life methane line uses 12% of biogenic carbon released as CH4 in landfill (Ximenes 2008 measured value), multiplied by 16/44 to convert C mass to CH4 mass, then by IPCC AR6 GWP100 of 27.9.",
            "Foregone-sequestration window is set to 100 years to match the EN 15978 reference study period of the source EBD. This is a methodological choice that can be challenged; the calculator allows 50-yr and 200-yr alternatives.",
            "SOC efflux factor of 0.12 tCO2e per m3 harvested timber is mid-range from James & Harrison 2016 meta-analysis (11% average SOC loss in top 30 cm), normalised to typical BC interior plantation yield of ~250 m3/ha.",
        ]
    },
    "t3-minneapolis": {
        "id":        "t3-minneapolis",
        "title":     "T3 Minneapolis",
        "subtitle":  "Seven-storey nail-laminated timber office and retail building, North Loop",
        "location":  "Minneapolis, Minnesota, United States",
        "completed": "September 2016",
        "use":       "Office and retail",
        "gfa_m2":    20440,
        "storeys":   7,
        "owner":     "Hines (developer)",
        "architect": "Michael Green Architecture (design); DLR Group (architect of record)",
        "structural":"Magnusson Klemencic Associates",
        "lca_practitioner": "No EN 15978 LCA published. Carbon figures derive from the WoodWorks / Canadian Wood Council Carbon Calculator.",
        "lca_standard":     "No whole-building LCA standard applied to disclosed figures.",
        "certification":    "LEED Gold",
        "wood_supplier":    "StructureCraft Builders Inc. (design assist + build)",
        "wood_origin":      "British Columbia interior, mountain pine beetle-killed salvage",
        "public_sources": [
            ("MGA T3 project page",  "https://mg-architecture.ca/project/t3-minneapolis/"),
            ("Architizer T3 profile","https://architizer.com/projects/minneapolis-t3/"),
            ("Dezeen 2016 article",  "https://www.dezeen.com/2016/12/02/michael-green-architecture-t3-largest-mass-timber-building-usa-minneapolis-minnesota/"),
            ("WoodWorks award gallery","https://www.woodworks.org/award-gallery/t3-minneapolis/"),
        ],
        "disclosed": {
            "timber_m3":           3600,
            "biogenic_stored":     3646,    # tCO2e (MGA / WoodWorks calc)
            "substitution_avoided":1411,    # tCO2e (MGA / WoodWorks calc)
            "total_wood_benefit":  5057,    # tCO2e (sum)
            "wholebldg_gwp_100yr": None,
            "per_m2_gwp":          None,
        },
        "boundary_quotes": [
            ("On the source of the disclosed figures",
             "T3 stores 3,646 metric tons of carbon dioxide. According to the WoodWorks Wood Calculator tool's Carbon Summary: using wood to construct T3 generates environmental benefits that are equivalent to taking 966 cars off the road for a year. By using wood, T3 avoided 1,411 metric tons of carbon dioxide emissions.",
             "Michael Green Architecture project page; Architizer profile"),
        ],
        "recompute_inputs": {
            "timber_m3":              3600,
            "a1a3_factor":            0.18,
            "biogenic_factor":        0.917,
            "disclosed_biostore":     3646,   # MGA / WoodWorks calculator
            "disclosed_substitution": 1411,   # MGA / WoodWorks substitution credit
            "soc_band":               "mid",
            "soc_factor":             0.12,
            "eol_band":               "ximenes",
            "eol_pct":                0.12,
            "fs_band":                "yr50",
            "fs_factor":              0.45,
        },
        "notes": [
            "This building does not have a published EN 15978 or ISO 14040/44 whole-building life cycle assessment. The disclosed figures derive from the Canadian Wood Council / WoodWorks Wood Calculator, which is a vendor screening tool, not an EN 15978 LCA. The Reproduction Sheet treats the calculator output as the disclosed value and recomputes against it.",
            "Foregone-sequestration window is set to 50 years (low band) rather than 100 to reflect that the harvested trees were mountain pine beetle-killed and would, absent salvage, have decomposed and released their carbon. This is a calibration that lowers the foregone-sequestration line; for live-harvest timber it would be set higher.",
            "End-of-life methane line uses 12% of biogenic carbon released as CH4 in landfill (Ximenes 2008), times 16/44 (CH4:C mass), times 27.9 (IPCC AR6 GWP100). Applied to the disclosed biogenic-store value of 3,646 tCO2e converted to carbon mass.",
            "Substitution credit of 1,411 tCO2e is preserved as disclosed for the disclosed-net line. It is not separately deducted from the recomputed full-boundary total because the recomputed total addresses wood-attributable lines only and is then compared to the same scope.",
        ]
    },
}

# Shared emission factor library — same numbers as the JS calculator
FACTORS_DOC = [
    ("Biogenic storage", "0.917 tCO2e per m3",
     "EN 15978 convention: ~0.25 tC/m3 softwood timber x 44/12 to CO2e."),
    ("A1-A3 manufacturing", "0.13 to 0.25 tCO2e per m3, default 0.18",
     "Athena Sustainable Materials Institute EPDs; FPInnovations data."),
    ("SOC efflux — Low",  "0.06 tCO2e per m3", "Achat et al. 2015, Forest Ecology and Management."),
    ("SOC efflux — Mid",  "0.12 tCO2e per m3", "James & Harrison 2016, Forests (meta-analysis: 11% SOC loss)."),
    ("SOC efflux — High", "0.20 tCO2e per m3", "Mayer et al. 2020, Forest Ecology and Management."),
    ("EOL methane — IPCC default", "3% of biogenic C as CH4", "EN 15978 default; very low landfill diversion."),
    ("EOL methane — Ximenes",      "12% of biogenic C as CH4", "Ximenes et al. 2008, Carbon Balance and Management."),
    ("EOL methane — Wang",          "18% of biogenic C as CH4", "Wang et al. 2013, Waste Management (long-term decay)."),
    ("CH4 conversion to CO2e",      "x 16/44 (mass) x 27.9 (GWP100)", "IPCC AR6 WG1 Ch.7 Table 7.15."),
    ("Foregone seq — 50 yr",  "0.45 tCO2e per m3", "Stephenson 2014; reduced for beetle-kill salvage."),
    ("Foregone seq — 100 yr", "0.95 tCO2e per m3", "Stephenson 2014, Nature; Luyssaert 2008."),
    ("Foregone seq — 200 yr", "2.00 tCO2e per m3", "Long-rotation full-cycle estimate."),
]


# -------------------------------------------------------------------
# Recomputation engine — must produce identical numbers to the
# JavaScript widget on the building pages.
# -------------------------------------------------------------------

def recompute(inputs):
    """Identical math to assets/calculator.js.

    If `disclosed_biostore` is supplied in inputs, it overrides the
    convention-factor biogenic-storage calculation. Auditor's standard:
    use the building's own disclosed value as the baseline.
    """
    v = inputs["timber_m3"]
    a1a3 = v * inputs["a1a3_factor"]

    # Biogenic store — prefer disclosed value if present.
    disclosed_biostore = inputs.get("disclosed_biostore")
    if disclosed_biostore is not None and disclosed_biostore > 0:
        biostore = disclosed_biostore
    else:
        biostore = v * inputs["biogenic_factor"]

    # Optional substitution credit — preserved if disclosed.
    substitution = inputs.get("disclosed_substitution") or 0

    disclosed_net = a1a3 - biostore - substitution

    soc = v * inputs["soc_factor"]

    # methane: biostore * pct * (16/44) * 27.9
    eol_methane = biostore * inputs["eol_pct"] * (16/44) * 27.9

    foregone = v * inputs["fs_factor"]

    full_boundary = a1a3 + soc + eol_methane + foregone
    delta = full_boundary - disclosed_net

    return {
        "timber_m3":     v,
        "a1a3":          a1a3,
        "biostore":      biostore,
        "substitution":  substitution,
        "disclosed_net": disclosed_net,
        "soc":           soc,
        "eol_methane":   eol_methane,
        "foregone":      foregone,
        "full_boundary": full_boundary,
        "delta":         delta,
    }


# -------------------------------------------------------------------
# PDF builder
# -------------------------------------------------------------------

def make_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="DRLTitle",
        parent=styles["Title"],
        fontName="Times-Bold",
        fontSize=22,
        leading=26,
        spaceAfter=4,
        textColor=INK,
        alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name="DRLSubtitle",
        parent=styles["Normal"],
        fontName="Times-Italic",
        fontSize=12,
        leading=15,
        spaceAfter=12,
        textColor=INK_SOFT,
    ))
    styles.add(ParagraphStyle(
        name="DRLKicker",
        parent=styles["Normal"],
        fontName="Courier-Bold",
        fontSize=8,
        leading=10,
        spaceAfter=4,
        textColor=OXBLOOD,
    ))
    styles.add(ParagraphStyle(
        name="DRLH2",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=14,
        leading=17,
        spaceBefore=14,
        spaceAfter=6,
        textColor=INK,
    ))
    styles.add(ParagraphStyle(
        name="DRLH3",
        parent=styles["Heading3"],
        fontName="Times-BoldItalic",
        fontSize=11,
        leading=14,
        spaceBefore=10,
        spaceAfter=4,
        textColor=INK_SOFT,
    ))
    styles.add(ParagraphStyle(
        name="DRLBody",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=10,
        leading=13.5,
        spaceAfter=6,
        textColor=INK,
        alignment=TA_JUSTIFY,
    ))
    styles.add(ParagraphStyle(
        name="DRLQuote",
        parent=styles["Normal"],
        fontName="Times-Italic",
        fontSize=10,
        leading=13.5,
        leftIndent=18,
        rightIndent=18,
        spaceBefore=6,
        spaceAfter=6,
        textColor=INK_SOFT,
        borderColor=OXBLOOD,
        borderWidth=0,
        borderPadding=0,
    ))
    styles.add(ParagraphStyle(
        name="DRLAttrib",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=8,
        leading=10,
        leftIndent=18,
        spaceAfter=8,
        textColor=INK_FADED,
    ))
    styles.add(ParagraphStyle(
        name="DRLMono",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=8.5,
        leading=11,
        textColor=INK_SOFT,
    ))
    styles.add(ParagraphStyle(
        name="DRLFootnote",
        parent=styles["Normal"],
        fontName="Times-Italic",
        fontSize=9,
        leading=11.5,
        textColor=INK_FADED,
        spaceAfter=4,
    ))
    return styles


def page_decoration(canv, doc):
    canv.saveState()
    # Top rule
    canv.setStrokeColor(RULE)
    canv.setLineWidth(0.5)
    canv.line(0.75 * inch, letter[1] - 0.55 * inch,
              letter[0] - 0.75 * inch, letter[1] - 0.55 * inch)

    # Top label
    canv.setFont("Courier-Bold", 8)
    canv.setFillColor(OXBLOOD)
    canv.drawString(0.75 * inch, letter[1] - 0.45 * inch,
                    "DRL — REPRODUCTION SHEET")
    canv.setFillColor(INK_FADED)
    canv.drawRightString(letter[0] - 0.75 * inch, letter[1] - 0.45 * inch,
                         "DIVERGENT RESOURCE LOGIC — FULL-BOUNDARY ACCOUNTING")

    # Footer
    canv.setStrokeColor(RULE)
    canv.line(0.75 * inch, 0.65 * inch,
              letter[0] - 0.75 * inch, 0.65 * inch)
    canv.setFont("Courier", 7.5)
    canv.setFillColor(INK_FADED)
    canv.drawString(0.75 * inch, 0.45 * inch,
                    "Auditor: Murphy O'Neal  |  These are audit working papers, intended to be verifiable line-by-line.")
    canv.drawRightString(letter[0] - 0.75 * inch, 0.45 * inch,
                         f"Page {canv.getPageNumber()}")
    canv.restoreState()


def fmt(n):
    if n is None: return "—"
    if abs(n) >= 100: return f"{int(round(n)):,}"
    if abs(n) >= 10:  return f"{n:.1f}"
    return f"{n:.2f}"


def fmt_signed(n):
    if n is None: return "—"
    s = fmt(abs(n))
    return ("+" if n >= 0 else "−") + s


def build_pdf(building, output_path):
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        leftMargin=0.75*inch, rightMargin=0.75*inch,
        topMargin=0.85*inch, bottomMargin=0.8*inch,
        title=f"DRL Reproduction Sheet — {building['title']}",
        author="Murphy O'Neal",
        subject="Full-boundary carbon recomputation",
    )

    s = make_styles()
    story = []

    # ---- 1. Title block ----
    story.append(Paragraph("REPRODUCTION SHEET", s["DRLKicker"]))
    story.append(Paragraph(building["title"], s["DRLTitle"]))
    story.append(Paragraph(building["subtitle"], s["DRLSubtitle"]))

    meta_data = [
        ["Location", building["location"]],
        ["Completed", building["completed"]],
        ["Use", building["use"]],
        ["Gross floor area", f"{building['gfa_m2']:,} m²"],
        ["Storeys", str(building["storeys"])],
        ["Owner / developer", building["owner"]],
        ["Architect", building["architect"]],
        ["Structural engineer", building["structural"]],
        ["LCA practitioner", building["lca_practitioner"]],
        ["LCA standard applied", building["lca_standard"]],
        ["Certification", building["certification"]],
        ["Wood supplier", building["wood_supplier"]],
        ["Wood origin / forest type", building["wood_origin"]],
    ]
    meta_tbl = Table(meta_data, colWidths=[1.8*inch, 4.8*inch])
    meta_tbl.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (0,-1), "Courier-Bold"),
        ("FONTSIZE",      (0,0), (0,-1), 7.5),
        ("TEXTCOLOR",     (0,0), (0,-1), INK_FADED),
        ("FONTNAME",      (1,0), (1,-1), "Times-Roman"),
        ("FONTSIZE",      (1,0), (1,-1), 10),
        ("TEXTCOLOR",     (1,0), (1,-1), INK),
        ("ALIGN",         (0,0), (0,-1), "LEFT"),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("LINEBELOW",     (0,0), (-1,-2), 0.25, RULE_FAINT),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 0.1*inch))
    story.append(HRFlowable(width="100%", thickness=0.75, color=RULE, spaceBefore=4, spaceAfter=10))

    # ---- 2. Public sources ----
    story.append(Paragraph("§ 1 — PUBLIC SOURCES", s["DRLKicker"]))
    story.append(Paragraph("Disclosure source documents", s["DRLH2"]))
    for label, url in building["public_sources"]:
        story.append(Paragraph(f"• <b>{label}</b><br/><font name='Courier' size='8' color='#6b1d1d'>{url}</font>", s["DRLBody"]))

    story.append(Spacer(1, 0.1*inch))

    # ---- 3. Disclosed figures ----
    story.append(Paragraph("§ 2 — DISCLOSED FIGURES", s["DRLKicker"]))
    story.append(Paragraph("What was published", s["DRLH2"]))

    d = building["disclosed"]
    rows = [["Item", "Value", "Unit"]]
    if d.get("timber_m3"):
        rows.append(["Timber volume (CLT + glulam + NLT)", f"{d['timber_m3']:,}", "m³"])
    if d.get("biogenic_stored"):
        rows.append(["Carbon stored in wood (biogenic)", f"{d['biogenic_stored']:,}", "tCO₂e"])
    if d.get("substitution_avoided"):
        rows.append(["Substitution credit (avoided emissions)", f"{d['substitution_avoided']:,}", "tCO₂e"])
    if d.get("total_wood_benefit"):
        rows.append(["Total disclosed wood 'carbon benefit'", f"{d['total_wood_benefit']:,}", "tCO₂e"])
    if d.get("wholebldg_gwp_100yr"):
        rows.append(["Whole-building 100-yr GWP", f"{d['wholebldg_gwp_100yr']:,}", "tCO₂e"])
    if d.get("per_m2_gwp"):
        rows.append(["Whole-building per GFA", f"{d['per_m2_gwp']:,}", "kg CO₂e/m²"])

    disc_tbl = Table(rows, colWidths=[3.8*inch, 1.4*inch, 1.0*inch], hAlign="LEFT")
    disc_tbl.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (-1,0), "Courier-Bold"),
        ("FONTSIZE",      (0,0), (-1,0), 7.5),
        ("TEXTCOLOR",     (0,0), (-1,0), INK_FADED),
        ("LINEBELOW",     (0,0), (-1,0), 1.0, RULE),
        ("FONTNAME",      (0,1), (0,-1), "Times-Roman"),
        ("FONTNAME",      (1,1), (-1,-1), "Courier"),
        ("FONTSIZE",      (0,1), (-1,-1), 9.5),
        ("ALIGN",         (1,0), (1,-1), "RIGHT"),
        ("ALIGN",         (2,0), (2,-1), "LEFT"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("LINEBELOW",     (0,1), (-1,-2), 0.25, RULE_FAINT),
        ("BACKGROUND",    (0,-1), (-1,-1), PAPER_WARM),
    ]))
    story.append(disc_tbl)
    story.append(Spacer(1, 0.1*inch))

    # ---- 4. Boundary statements ----
    story.append(Paragraph("§ 3 — BOUNDARY STATEMENT", s["DRLKicker"]))
    story.append(Paragraph("What is excluded, in the disclosure's own words", s["DRLH2"]))

    for label, quote, attrib in building["boundary_quotes"]:
        story.append(Paragraph(f"<i>{label}.</i>", s["DRLH3"]))
        story.append(Paragraph(f'"{quote}"', s["DRLQuote"]))
        story.append(Paragraph(f"— {attrib}", s["DRLAttrib"]))

    story.append(Spacer(1, 0.05*inch))

    # ---- 5. Recompute inputs and outputs ----
    inputs = building["recompute_inputs"]
    r = recompute(inputs)

    story.append(Paragraph("§ 4 — DRL RECOMPUTATION INPUTS", s["DRLKicker"]))
    story.append(Paragraph("Every input used in the corrected calculation", s["DRLH2"]))

    inp_rows = [
        ["Input", "Value", "Source / band"],
        ["Timber volume",              f"{inputs['timber_m3']:,} m³",            "Building's own disclosure"],
        ["A1–A3 manufacturing factor", f"{inputs['a1a3_factor']} tCO₂e/m³",      "Athena/FPInnovations mid-range"],
        ["Biogenic storage factor",    f"{inputs['biogenic_factor']} tCO₂e/m³",  "EN 15978 convention"],
        ["SOC efflux factor",          f"{inputs['soc_factor']} tCO₂e/m³",       f"Band: {inputs['soc_band']}"],
        ["EOL methane fraction",       f"{int(inputs['eol_pct']*100)}% biogenic C as CH₄", f"Band: {inputs['eol_band']}"],
        ["Foregone seq. factor",       f"{inputs['fs_factor']} tCO₂e/m³",        f"Band: {inputs['fs_band']}"],
    ]
    inp_tbl = Table(inp_rows, colWidths=[2.5*inch, 1.7*inch, 2.0*inch], hAlign="LEFT")
    inp_tbl.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (-1,0), "Courier-Bold"),
        ("FONTSIZE",      (0,0), (-1,0), 7.5),
        ("TEXTCOLOR",     (0,0), (-1,0), INK_FADED),
        ("LINEBELOW",     (0,0), (-1,0), 1.0, RULE),
        ("FONTNAME",      (0,1), (0,-1), "Times-Roman"),
        ("FONTNAME",      (1,1), (-1,-1), "Courier"),
        ("FONTSIZE",      (0,1), (-1,-1), 9),
        ("ALIGN",         (1,0), (1,-1), "RIGHT"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("LINEBELOW",     (0,1), (-1,-2), 0.25, RULE_FAINT),
    ]))
    story.append(inp_tbl)

    story.append(Spacer(1, 0.15*inch))

    # ---- 6. Step-by-step arithmetic ----
    story.append(Paragraph("§ 5 — ARITHMETIC, LINE BY LINE", s["DRLKicker"]))
    story.append(Paragraph("Every step of the recomputation, showing the calculation", s["DRLH2"]))

    v = inputs['timber_m3']
    bs = r['biostore']
    arith_rows = [
        ["Line", "Calculation", "Result"],
        ["A1–A3",
         f"{v:,} × {inputs['a1a3_factor']}",
         f"+{fmt(r['a1a3'])} tCO₂e"],
        ["Biogenic storage (industry credit)",
         f"{v:,} × {inputs['biogenic_factor']}",
         f"−{fmt(r['biostore'])} tCO₂e"],
        ["Disclosed net (A1–A3 − biogenic)",
         "Sum of lines above",
         f"{fmt_signed(r['disclosed_net'])} tCO₂e"],
        ["+ SOC efflux",
         f"{v:,} × {inputs['soc_factor']}",
         f"+{fmt(r['soc'])} tCO₂e"],
        ["+ EOL methane",
         f"{fmt(r['biostore'])} × {inputs['eol_pct']} × (16/44) × 27.9",
         f"+{fmt(r['eol_methane'])} tCO₂e"],
        ["+ Foregone sequestration",
         f"{v:,} × {inputs['fs_factor']}",
         f"+{fmt(r['foregone'])} tCO₂e"],
        ["Full-boundary total",
         "A1–A3 + SOC + EOL + Foregone",
         f"+{fmt(r['full_boundary'])} tCO₂e"],
        ["Delta vs. disclosed",
         "Full-boundary − disclosed_net",
         f"{fmt_signed(r['delta'])} tCO₂e"],
    ]
    arith_tbl = Table(arith_rows, colWidths=[2.3*inch, 2.5*inch, 1.4*inch], hAlign="LEFT")
    arith_tbl.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (-1,0), "Courier-Bold"),
        ("FONTSIZE",      (0,0), (-1,0), 7.5),
        ("TEXTCOLOR",     (0,0), (-1,0), INK_FADED),
        ("LINEBELOW",     (0,0), (-1,0), 1.0, RULE),
        ("FONTNAME",      (0,1), (0,-1), "Times-Roman"),
        ("FONTNAME",      (1,1), (-1,-1), "Courier"),
        ("FONTSIZE",      (0,1), (-1,-1), 9),
        ("ALIGN",         (2,0), (2,-1), "RIGHT"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("LINEBELOW",     (0,1), (-1,-2), 0.25, RULE_FAINT),
        # totals row highlight
        ("BACKGROUND",    (0,-2), (-1,-2), PAPER_WARM),
        ("FONTNAME",      (0,-2), (-1,-2), "Courier-Bold"),
        # delta row highlight
        ("BACKGROUND",    (0,-1), (-1,-1), PAPER_WARM),
        ("FONTNAME",      (0,-1), (-1,-1), "Courier-Bold"),
        ("TEXTCOLOR",     (2,-1), (2,-1), OXBLOOD),
        # disclosed net row sub-divider
        ("LINEABOVE",     (0,3), (-1,3), 0.5, RULE),
        ("FONTNAME",      (0,3), (-1,3), "Courier-Bold"),
    ]))
    story.append(arith_tbl)

    story.append(Spacer(1, 0.1*inch))
    story.append(PageBreak())

    # ---- 7. Factor library ----
    story.append(Paragraph("§ 6 — EMISSION FACTOR LIBRARY", s["DRLKicker"]))
    story.append(Paragraph("Every factor used here, with its source", s["DRLH2"]))
    story.append(Paragraph(
        "The factors below are the same library used by the live mini-calculator on the building's web page. "
        "Default factor values are mid-range and sourced; low and high alternatives are also available. "
        "Anyone challenging this recomputation can do so by naming a specific factor and substituting an alternative value with a citation; the math will recompute.",
        s["DRLBody"]
    ))

    fac_rows = [["Factor", "Value", "Source"]] + [list(t) for t in FACTORS_DOC]
    fac_tbl = Table(fac_rows, colWidths=[1.9*inch, 1.7*inch, 3.0*inch], hAlign="LEFT")
    fac_tbl.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (-1,0), "Courier-Bold"),
        ("FONTSIZE",      (0,0), (-1,0), 7.5),
        ("TEXTCOLOR",     (0,0), (-1,0), INK_FADED),
        ("LINEBELOW",     (0,0), (-1,0), 1.0, RULE),
        ("FONTNAME",      (0,1), (1,-1), "Courier"),
        ("FONTNAME",      (2,1), (2,-1), "Times-Roman"),
        ("FONTSIZE",      (0,1), (-1,-1), 8.5),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("LINEBELOW",     (0,1), (-1,-2), 0.25, RULE_FAINT),
    ]))
    story.append(fac_tbl)
    story.append(Spacer(1, 0.15*inch))

    # ---- 8. Methodology notes ----
    story.append(Paragraph("§ 7 — METHODOLOGICAL NOTES", s["DRLKicker"]))
    story.append(Paragraph("Calibrations and assumptions specific to this building", s["DRLH2"]))
    for n in building["notes"]:
        story.append(Paragraph("• " + n, s["DRLBody"]))

    story.append(Spacer(1, 0.15*inch))

    # ---- 9. Citations ----
    story.append(Paragraph("§ 8 — CITATIONS", s["DRLKicker"]))
    story.append(Paragraph("Peer-reviewed and primary-source references", s["DRLH2"]))
    citations = [
        "Bowick, M. (2018). Brock Commons Tallwood House — An Environmental Building Declaration According to EN 15978. Athena Sustainable Materials Institute.",
        "EN 15978:2011. Sustainability of construction works — Assessment of environmental performance of buildings — Calculation method. European Committee for Standardization.",
        "Stephenson, N. L., et al. (2014). Rate of tree carbon accumulation increases continuously with tree size. Nature, 507(7490), 90–93.",
        "Luyssaert, S., et al. (2008). Old-growth forests as global carbon sinks. Nature, 455(7210), 213–215.",
        "James, J. & Harrison, R. (2016). The effect of harvest on forest soil carbon: a meta-analysis. Forests, 7(12), 308.",
        "Achat, D. L., et al. (2015). Forest Ecology and Management, 348, 124–141.",
        "Mayer, M., et al. (2020). Tamm Review: Influence of forest management activities on soil organic carbon stocks. Forest Ecology and Management, 466, 118127.",
        "Ximenes, F. A., et al. (2008). Greenhouse gas balance of native forests in NSW, Australia. Carbon Balance and Management, 3(1), 1–13.",
        "Wang, X., et al. (2013). Methane emissions from landfills. Waste Management.",
        "IPCC (2021). Sixth Assessment Report, WG1, Ch. 7, Table 7.15 — methane GWP₁₀₀ = 27.9.",
        "Searchinger, T. D., Peng, L., et al. (2023). Re-evaluating the climate effects of biofuels and bioenergy. Nature, 619, 64–73. doi:10.1038/s41586-023-06187-1",
    ]
    for c in citations:
        story.append(Paragraph(c, s["DRLFootnote"]))

    story.append(Spacer(1, 0.2*inch))
    story.append(HRFlowable(width="100%", thickness=1.5, color=OXBLOOD, spaceBefore=8, spaceAfter=8))

    # ---- 10. Auditor sign-off ----
    story.append(Paragraph("§ 9 — AUDITOR'S NOTE", s["DRLKicker"]))
    story.append(Paragraph(
        "This Reproduction Sheet is audit working papers. It is intended to be checked, disputed, and corrected.",
        s["DRLH3"]
    ))
    story.append(Paragraph(
        "If any input on this page is wrong — the timber volume, the boundary statement, the emission factor band — please write. "
        "The feedback channel logs every submission with timestamp. A correction will be published on the building's page and a revised version of this sheet will be issued. "
        "The purpose of this document is not to be unchallengeable. It is to be challengeable line by line.",
        s["DRLBody"]
    ))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(
        "<b>Auditor:</b> Murphy O'Neal &nbsp;&nbsp; <b>Version:</b> 1.0 &nbsp;&nbsp; <b>Reference framework:</b> Divergent Resource Logic (DRL), full-boundary accounting framework.",
        s["DRLMono"]
    ))
    story.append(Paragraph(
        "<b>Status:</b> Pre-publication draft. To be reviewed by counsel before public release.",
        s["DRLMono"]
    ))

    doc.build(story, onFirstPage=page_decoration, onLaterPages=page_decoration)


# -------------------------------------------------------------------
# CSV builder
# -------------------------------------------------------------------

def build_csv(building, output_path):
    """Reproduction sheet inputs as a flat CSV so anyone can load into Excel."""
    inputs = building["recompute_inputs"]
    r = recompute(inputs)
    d = building["disclosed"]

    rows = []
    rows.append(["# DRL Reproduction Sheet"])
    rows.append(["# Building", building["title"]])
    rows.append(["# Location", building["location"]])
    rows.append(["# Completed", building["completed"]])
    rows.append(["# Architect", building["architect"]])
    rows.append(["# Structural", building["structural"]])
    rows.append(["# LCA practitioner", building["lca_practitioner"]])
    rows.append(["# LCA standard", building["lca_standard"]])
    rows.append(["# Auditor", "Murphy O'Neal"])
    rows.append(["# Version", "1.0"])
    rows.append([])
    rows.append(["# === Public sources ==="])
    for label, url in building["public_sources"]:
        rows.append(["#", label, url])
    rows.append([])
    rows.append(["# === Disclosed figures ==="])
    rows.append(["Item", "Value", "Unit"])
    if d.get("timber_m3"):           rows.append(["Timber volume", d["timber_m3"], "m3"])
    if d.get("biogenic_stored"):     rows.append(["Biogenic stored", d["biogenic_stored"], "tCO2e"])
    if d.get("substitution_avoided"):rows.append(["Substitution avoided", d["substitution_avoided"], "tCO2e"])
    if d.get("total_wood_benefit"):  rows.append(["Total disclosed wood benefit", d["total_wood_benefit"], "tCO2e"])
    if d.get("wholebldg_gwp_100yr"): rows.append(["Whole-building 100-yr GWP", d["wholebldg_gwp_100yr"], "tCO2e"])
    if d.get("per_m2_gwp"):          rows.append(["Per GFA", d["per_m2_gwp"], "kgCO2e/m2"])
    rows.append([])
    rows.append(["# === Recompute inputs ==="])
    rows.append(["Input", "Value", "Unit / Band"])
    rows.append(["Timber volume",                inputs["timber_m3"],       "m3"])
    rows.append(["A1-A3 factor",                 inputs["a1a3_factor"],     "tCO2e/m3"])
    rows.append(["Biogenic storage factor",      inputs["biogenic_factor"], "tCO2e/m3"])
    rows.append(["SOC efflux factor",            inputs["soc_factor"],      f"tCO2e/m3 (band: {inputs['soc_band']})"])
    rows.append(["EOL methane fraction",         inputs["eol_pct"],         f"fraction of biogenic C (band: {inputs['eol_band']})"])
    rows.append(["Foregone seq factor",          inputs["fs_factor"],       f"tCO2e/m3 (band: {inputs['fs_band']})"])
    rows.append([])
    rows.append(["# === Recompute outputs ==="])
    rows.append(["Line", "Value", "Unit"])
    rows.append(["A1-A3",                round(r["a1a3"], 2),         "tCO2e"])
    rows.append(["Biogenic storage",     round(-r["biostore"], 2),    "tCO2e"])
    rows.append(["Disclosed net",        round(r["disclosed_net"], 2),"tCO2e"])
    rows.append(["SOC efflux",           round(r["soc"], 2),          "tCO2e"])
    rows.append(["EOL methane",          round(r["eol_methane"], 2),  "tCO2e"])
    rows.append(["Foregone sequestration",round(r["foregone"], 2),    "tCO2e"])
    rows.append(["Full-boundary total",  round(r["full_boundary"], 2),"tCO2e"])
    rows.append(["Delta vs disclosed",   round(r["delta"], 2),        "tCO2e"])
    rows.append([])
    rows.append(["# === Boundary statements (from source) ==="])
    for label, q, attrib in building["boundary_quotes"]:
        rows.append(["#", label, attrib, q])
    rows.append([])
    rows.append(["# === Notes ==="])
    for n in building["notes"]:
        rows.append(["#", n])
    rows.append([])
    rows.append(["# All emission factors are sourced. See companion PDF or building page for citations."])

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        for row in rows:
            w.writerow(row)


# -------------------------------------------------------------------
# Driver
# -------------------------------------------------------------------

def main():
    out_dir = "/home/claude/ledger/reproduction-sheets"
    os.makedirs(out_dir, exist_ok=True)

    for bid, b in BUILDINGS.items():
        pdf_path = os.path.join(out_dir, f"{bid}.pdf")
        csv_path = os.path.join(out_dir, f"{bid}.csv")
        build_pdf(b, pdf_path)
        build_csv(b, csv_path)
        # Also print the recompute summary for verification
        r = recompute(b["recompute_inputs"])
        print(f"\n=== {b['title']} ===")
        print(f"  Disclosed net:   {fmt_signed(r['disclosed_net'])} tCO2e")
        print(f"  Full-boundary:   {fmt(r['full_boundary'])} tCO2e")
        print(f"  Delta:           {fmt_signed(r['delta'])} tCO2e")
        print(f"  PDF: {pdf_path}")
        print(f"  CSV: {csv_path}")

if __name__ == "__main__":
    main()
