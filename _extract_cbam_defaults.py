"""
Excel'den CBAM default değerlerini çıkarır ve cbam-defaults.js olarak kaydeder.
Kaynak: DVs as adopted_v20260204 .xlsx

Kapsam:
- indirect kolonu boş (None) veya 'N/A' veya '◦' olan CN kodları → scope2Exempt: true
- 'see below' olan satırlar → parent satır atlanır, child satırlar kullanılır
- CN kodları normalize edilir (boşluklar kaldırılır, int → string)
"""

import json, re, openpyxl
from datetime import datetime

XLSX_PATH = r"C:\Users\erhan\Downloads\Claude\Voltfox\DVs as adopted_v20260204 .xlsx"
OUT_PATH  = r"C:\Users\erhan\Downloads\Claude\cbam-defaults.js"

# Scope 2 muafiyet belirleyici: bu değerler → scope2Exempt = True
SCOPE2_EXEMPT_VALUES = {None, "N/A", "–", "–", "◦", "•"}  # – = en dash

SKIP_SHEETS = {"Overview", "Version History", "_Other Countries and Territorie"}

def normalize_cn(raw) -> str | None:
    """CN kodunu normalize et: boşlukları kaldır, int → string, geçersizleri filtrele."""
    if raw is None:
        return None
    s = str(raw).replace(" ", "").replace(" ", "").strip()
    # Sadece sayısal CN kodlarını kabul et (4-10 rakam)
    if re.fullmatch(r"\d{4,10}", s):
        return s
    return None  # Sektor başlığı veya geçersiz

def is_scope2_exempt(indirect_val) -> bool:
    if indirect_val is None:
        return True
    if isinstance(indirect_val, str):
        return indirect_val.strip() in SCOPE2_EXEMPT_VALUES or indirect_val.strip() == ""
    return False  # float → değer var, muaf değil

def safe_float(v) -> float | None:
    if isinstance(v, (int, float)):
        return float(v)
    return None

def parse_sheet(ws):
    """Bir ülke sheet'ini parse et, (cn_code, row_data) listesi döndür."""
    rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 2:  # başlık satırları
            continue
        if len(row) < 5:
            continue

        cn_raw, desc, direct, indirect, total, y2026, y2027, y2028, route = (
            row + (None,) * 9
        )[:9]

        cn = normalize_cn(cn_raw)
        if cn is None:
            continue  # sektor başlığı veya geçersiz satır

        # 'see below' → parent satırı atla, alt satırlar zaten doğru değerleri taşır
        if isinstance(indirect, str) and indirect.strip() == "see below":
            continue

        direct_v   = safe_float(direct)
        indirect_v = safe_float(indirect)
        total_v    = safe_float(total)
        y2026_v    = safe_float(y2026)
        y2027_v    = safe_float(y2027)
        y2028_v    = safe_float(y2028)
        exempt     = is_scope2_exempt(indirect)
        desc_str   = str(desc).strip() if desc else ""

        rows.append({
            "cn":         cn,
            "desc":       desc_str,
            "direct":     direct_v,
            "indirect":   indirect_v,
            "total":      total_v,
            "y2026":      y2026_v,
            "y2027":      y2027_v,
            "y2028":      y2028_v,
            "scope2Exempt": exempt,
        })
    return rows

def main():
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)

    cn_master  = {}   # cn → {d, c, scope2Exempt}
    countries  = {}   # country → [[cn, direct, indirect, total, 2026, 2027, 2028, scope2Exempt]]

    # Sektor tespiti: sheet içindeki sektor başlık satırları (CN kodu olmayan)
    def detect_sector(ws):
        """Sheet'in ilk sektor başlığını bul."""
        for row in ws.iter_rows(values_only=True, min_row=3, max_row=5):
            if row[0] is not None and normalize_cn(row[0]) is None:
                return str(row[0]).strip()
        return "Unknown"

    # Sektor haritası: ilk geçerli değer öncesindeki başlık
    def parse_sheet_with_sectors(ws):
        rows = []
        current_sector = "Unknown"
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i < 2: continue
            if len(row) < 5: continue
            cn_raw = (row + (None,)*9)[:9][0]
            cn = normalize_cn(cn_raw)
            if cn is None:
                # Sektor başlığı olabilir
                if cn_raw and str(cn_raw).strip() and not any(
                    kw in str(cn_raw) for kw in ("Product CN", "Default Value", "mark-up", "Underlying")
                ):
                    current_sector = str(cn_raw).strip()
                continue

            row9 = (row + (None,)*9)[:9]
            _, desc, direct, indirect, total, y2026, y2027, y2028, _ = row9

            if isinstance(indirect, str) and indirect.strip() == "see below":
                continue

            rows.append({
                "cn":          cn,
                "desc":        str(desc).strip() if desc else "",
                "sector":      current_sector,
                "direct":      safe_float(direct),
                "indirect":    safe_float(indirect),
                "total":       safe_float(total),
                "y2026":       safe_float(y2026),
                "y2027":       safe_float(y2027),
                "y2028":       safe_float(y2028),
                "scope2Exempt": is_scope2_exempt(indirect),
            })
        return rows

    total_rows = 0
    exempt_count = 0
    country_count = 0

    for sheet_name in wb.sheetnames:
        if sheet_name in SKIP_SHEETS:
            continue

        ws = wb[sheet_name]
        parsed = parse_sheet_with_sectors(ws)

        if not parsed:
            continue

        country_count += 1
        country_rows = []

        for r in parsed:
            cn = r["cn"]
            total_rows += 1
            if r["scope2Exempt"]:
                exempt_count += 1

            # cn_master güncelle
            if cn not in cn_master:
                cn_master[cn] = {
                    "d": r["desc"],
                    "c": r["sector"],
                    "scope2Exempt": r["scope2Exempt"],
                }

            # Ülke row: [cn, direct, indirect, total, 2026, 2027, 2028, scope2Exempt]
            country_rows.append([
                cn,
                r["direct"],
                r["indirect"],
                r["total"],
                r["y2026"],
                r["y2027"],
                r["y2028"],
                r["scope2Exempt"],
            ])

        countries[sheet_name] = country_rows

    # JSON çıktısı
    output = {
        "meta": {
            "version":     "20260204",
            "source":      "DVs as adopted_v20260204.xlsx",
            "generatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "validFrom":   "2026-02-04",
            "encoding":    "utf-8",
            "note":        "scope2Exempt=true: indirect emissions boş/N/A → bu CN kodu 2026'da Scope 2'den muaf",
        },
        "cn":        cn_master,
        "countries": countries,
    }

    js_content = "window.CBAM_DATA=" + json.dumps(output, ensure_ascii=False, separators=(",", ":")) + ";"
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"Tamamlandı.")
    print(f"  Ülke sayısı : {country_count}")
    print(f"  Toplam satır: {total_rows}")
    print(f"  CN kodu     : {len(cn_master)}")
    print(f"  Scope2 muaf : {exempt_count} ({exempt_count/total_rows*100:.1f}%)")
    print(f"  Çıktı       : {OUT_PATH}")

    # Türkiye örnek — hem muaf hem değil
    tr = countries.get("Türkiye", [])
    exempt_ex = [r for r in tr if r[7]][:3]
    active_ex = [r for r in tr if not r[7]][:3]
    print(f"\nTürkiye — Scope2 muaf örnekler:")
    for r in exempt_ex:
        print(f"  CN={r[0]:10s}  direct={r[1]}  indirect={r[2]}  total={r[3]}")
    print(f"Türkiye — Scope2 aktif örnekler:")
    for r in active_ex:
        print(f"  CN={r[0]:10s}  direct={r[1]}  indirect={r[2]}  total={r[3]}")

if __name__ == "__main__":
    main()
