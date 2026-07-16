# Social Deprivation Index (SDI) — 2019 ZCTA

Source data for PREVENT ZIP → SDI decile lookup (1–10).

## File

- `asset_rgc_sdi_2015_through_2019_zcta.csv` — Robert Graham Center **2019 SDI at ZCTA** (derived from **2015–2019** ACS 5-Year Summary Files). Unmodified download.

## Download

- Primary (historical DAM path; currently may 404):  
  `https://www.graham-center.org/content/dam/rgc/documents/maps-data-tools/sdi/2015-2019-sdi/rgcsdi-2015-2019-zcta.csv`
- Wayback (2023-12-13):  
  `https://web.archive.org/web/20231213195651/https://www.graham-center.org/content/dam/rgc/documents/maps-data-tools/sdi/2015-2019-sdi/rgcsdi-2015-2019-zcta.csv`
- Project page:  
  [Social Deprivation Index (Robert Graham Center)](https://www.graham-center.org/evidence-based-research/featured-work/social-deprivation-index)

## CSV columns used

| Column | Role |
|--------|------|
| `ZCTA5_FIPS` | 5-digit ZCTA key |
| `SDI_score` | Centile 1–100 of area deprivation |

PREVENT optional models use a **decile** of `SDI_score` (not the raw `sdi` factor score), aligned with preventr:

- `SDI_score ≤ 10 → 1` … `≤ 100 → 10`

The calculator loads this CSV (served from `doc/sdi` at `/data/sdi/`) and parses it in the browser. Do not add derived JSON or other generated maps under `public/`.

## Generated artifact

Do not hand-edit. Regenerate with:

```bash
npm run generate:sdi-2019
```

- `public/cql/SDI-2019.cql` (`library SDI2019`) — only generated file from this source.

## Citation

Social deprivation index (SDI). Robert Graham Center - Policy Studies in Family Medicine & Primary Care.
https://www.graham-center.org/evidence-based-research/featured-work/social-deprivation-index
