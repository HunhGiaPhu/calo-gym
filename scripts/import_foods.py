"""Đọc sheet Food List trong Excel -> src/data/foods.json (món sạch) + foods_can_xem.csv (món nghi sai).
Chạy: python -I scripts/import_foods.py "<đường dẫn xlsx>"
"""
import csv, json, sys
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def check(kcal100, p, c, f):
    """Trả về lý do nghi sai, hoặc '' nếu ổn."""
    if kcal100 > 900:
        return "kcal/100g > 900"
    est = 4 * p + 4 * c + 9 * f
    if abs(est - kcal100) > max(50, 0.4 * kcal100):
        return f"macro ra {est:.0f} kcal nhưng ghi {kcal100:.0f}"
    return ""


def main(xlsx):
    ws = openpyxl.load_workbook(xlsx, data_only=True, read_only=True)["Food List"]
    good, bad, seen = [], [], set()
    for row in ws.iter_rows(min_row=2, values_only=True):
        name = (str(row[0]).strip() if row[0] else "")
        g, kcal, f, c, p = (num(x) for x in row[1:6])
        if not name or not g or g <= 0 or kcal is None or name.lower() in seen:
            continue
        seen.add(name.lower())
        f, c, p = f or 0, c or 0, p or 0
        # grams == 1 trong file gốc nghĩa là "1 phần", không phải 1 gram
        unit, k = ("phần", 1) if g == 1 else ("g", 100 / g)
        item = {"name": name, "unit": unit,
                "kcal": round(kcal * k, 1), "p": round(p * k, 1),
                "c": round(c * k, 1), "f": round(f * k, 1)}
        why = check(item["kcal"], item["p"], item["c"], item["f"]) if unit == "g" else ""
        (bad if why else good).append({**item, "ly_do": why} if why else item)

    out = ROOT / "src" / "data"
    out.mkdir(parents=True, exist_ok=True)
    (out / "foods.json").write_text(json.dumps(good, ensure_ascii=False, indent=0), encoding="utf-8")
    review = Path(xlsx).parent / "foods_can_xem.csv"
    with review.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=["name", "unit", "kcal", "p", "c", "f", "ly_do"])
        w.writeheader(); w.writerows(bad)
    print(f"OK {len(good)} món -> {out/'foods.json'}; {len(bad)} món nghi sai -> {review}")


if __name__ == "__main__":
    assert check(165, 31, 0, 3.6) == ""          # ức gà: ổn
    assert check(4200, 25, 3, 70).startswith("kcal")  # bacon lỗi
    main(sys.argv[1])
