# Leonida Trophy Guide — GTA VI (PS5)

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/Morenoo-del/makefun-gta6-trophy-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/Morenoo-del/makefun-gta6-trophy-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

An offline guide and tracker for all **55 PlayStation 5 trophies** of Grand Theft Auto VI — 1 Platinum, 2 Gold, 6 Silver, 46 Bronze, 28 of them hidden until earned. No account, no network, no build step: open `app/index.html` in a desktop browser and it works with the network off.

## What it does

- **Tracker** — a checklist of all 55 trophies with the official name, description and grade as PlayStation publishes them. Tick trophies off as you earn them; progress saves in the browser (localStorage), with a progress bar and per-grade counts.
- **Guides with sources** — every trophy has a guide written in our own words: what to do, where and how, and when it can be missed. Each guide names its sources (PowerPyx, Output Lag, GTA Zone, The Gamers Hub, CryptoGames, Planet GTA 6, and the Exophase / PSNProfiles trophy lists), with clickable links. Anything no guide has confirmed yet is marked **unconfirmed** rather than invented — five trophies fall in that bucket at launch.
- **Platinum roadmap** — eight stages from "before you start" to the final cleanup, built from the official descriptions: chapter order, the 100% checklist's 35 requirements and their thresholds, and the collectible counts.
- **Missable warnings** — the one trophy the guides flag as possibly missable (Positive Mental Attitude, and Lucia's Chapter 1 balcony meditation behind it) is flagged in the list, in its guide, and in its own box on the roadmap. The Chapter 3 Yago race is called out as time-sensitive too.
- **Spoiler setting** — hide the names and descriptions of un-earned story trophies until you earn them.
- **Filters and search** — by kind (story, missable, collectibles, activities, robbery, exploration, misc), by grade, by earned state, plus free-text search.
- **Export / import** — download your progress as JSON and import it back on another machine.

## The facts that shape the plan

- About **200 hours** to the Platinum, rated **4/10** by PowerPyx — long, not hard. No online trophies, no difficulty trophies, no mission medals.
- There is **no mission replay and no New Game Plus**. Keep a manual save at the start of every chapter and one untouched save from just before the final mission.
- Cheats are reported to switch off trophies and saving for that session — keep them off your trophy save.
- The 100% checklist (A Long Road, gold) only appears after the story, under Progress → Stats → 100% Completion, but work done earlier already counts. Its thresholds are lenient — roughly 60% true completion — except for a few items that need everything: all 8 bank vaults, all 39 illegal operations, all 42 Shooting Range golds, all 14 drone-race wins, and Bret's full questline.

## Run it

```sh
# Any static server works; for example, from this directory:
python3 -m http.server 8000 --directory app
# then open http://localhost:8000/
```

Or just open `app/index.html` directly in a browser — the app fetches only its own `app/data/trophies.json` and makes no other network requests.

Screenshot scenes (used by the shot script) are plain query params on the real app: `?shot=list&filter=missable`, `?shot=guide&id=28`, `?shot=roadmap`, `?shot=spoiler`.

## Files

- `app/index.html`, `app/style.css`, `app/app.js` — the app (vanilla JS, no libraries).
- `app/data/trophies.json` — the 55 trophies, guides, sources and the roadmap.
- `screenshots/` — renders of the running app.
- `main.ts` — builds the submission dossier (`dossier.json`) from `app/` and `screenshots/`.
- `serve.ts` — the kit's local server helper.

## Sources

Guide facts were checked on 19 November 2026 (launch day) against PowerPyx's trophy guide, Output Lag's trophy list, GTA Zone, The Gamers Hub's 100% checklist, CryptoGames' 100% checklist and Planet GTA 6, cross-checked with the Exophase and PSNProfiles trophy lists. Trophy names and descriptions are quoted as PlayStation publishes them; guide text is our own, paraphrased and cited, never copied. Where the guides disagree or say nothing — the five unconfirmed trophies — the app says so instead of guessing.

## Disclaimer

Unofficial fan guide. Not affiliated with, endorsed by, or connected to Rockstar Games. Grand Theft Auto and GTA are trademarks of Take-Two Interactive.

---

Built for the make.fun bounty [gta6-trophy-guide-01](https://make.fun/bounty/gta6-trophy-guide-01). If you build agents that enter bounties, my referral link is https://make.fun/r/w6xj1ecj.
