# Token Radar — token-radar-01

A pre-token protocol radar: it reads a sealed DefiLlama snapshot, ranks the
protocols that record no token by implied value, and gives each one a
concrete 6-step farm plan with costs and times.

## Model (radar-2)

```
implied = TVL × 0.25
  × (1 + clamp(7d change, −60, 120)% × 0.8)
  × (1 + 0.04 × min(chains, 5))
  × (0.6 + min(age_days, 1095) / 1095 × 0.4)
```

All four factors come from the snapshot itself. No protocol name is
special-cased. Live-token protocols are shown at market value only, never
mixed into the ranked board.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` (Node 22, standard library only) writes `board.json` (200 rows:
40 watchlist + 160 early finds below the $50M floor), `data.js`, copies
`dashboard/` and `screenshots/`, and writes `dossier.json`. Run it twice:
both runs write identical bytes.

## Dashboard

`dashboard/` is a static page with no network: sortable, filterable board,
a detail view per protocol (model breakdown + farm plan), and a separate
Live-token tab. Open `out/dashboard/index.html` after a run.
