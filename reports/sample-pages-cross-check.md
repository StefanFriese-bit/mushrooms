# The ten sample pages — cross-check (06/10/2026)

Every safety fact on the ten pages (edibility, the edibility note, every top point, every "tell them apart" row)
was read on First Nature (FN), Wild Food UK (WF), Wikipedia (WP) and, where it covers the species, the Woodland
Trust (WT). Only the articles were read, never reader comments. Two extra articles counted as WT and WF:
the Woodland Trust's "Poisonous mushrooms: 8 most dangerous UK mushrooms" and Wild Food UK's "The most poisonous
UK fungi, part 1". As agreed: the majority decides, a tie takes the cautious answer, and every disagreement is
listed here.

## How many websites stand behind each page's safety facts

| Page | Safety facts | Fewest websites behind one fact | Combinations used |
|---|---|---|---|
| Chanterelle | 17 | 2 | FN+WF+WP+WT, FN+WF+WT, FN+WF, FN+WF+WP |
| Deadly Dapperling | 13 | 2 | FN+WF+WP, FN+WP, FN+WF+WP+WT |
| Deadly Webcap | 15 | 3 | FN+WF+WP+WT, FN+WF+WP, FN+WF+WT |
| Deathcap | 18 | 2 | FN+WF+WP+WT, FN+WP+WT, FN+WF+WT, FN+WF, FN+WF+WP |
| Destroying Angel | 18 | 2 | FN+WF+WP+WT, FN+WF+WP, FN+WF+WT, FN+WF, FN+WT |
| False Chanterelle | 11 | 2 | FN+WF+WP, FN+WP |
| Field Mushroom | 19 | 2 | FN+WF+WP, FN+WF+WP+WT, FN+WP, FN+WF, FN+WF+WT |
| Horse Mushroom | 16 | 2 | FN+WF+WP, FN+WP, FN+WF |
| Parasol | 16 | 2 | FN+WF+WP, FN+WP |
| Yellow Stainer | 16 | 2 | FN+WF+WP, FN+WP, FN+WF |

A row in a "tell them apart" table makes two claims, one about each mushroom. Each claim is stated by at least
two of the sources listed for that row, on two different websites. One exception: the Fatal Dapperling's size
row. Only First Nature gives its size (2–3.5 cm), so the row also names Wild Food UK's warning about the whole
group (dapperlings are smaller; under 12 cm, check carefully).

## Added: four deadly pairs that were not on the core list

The sources name these mix-ups outright, so they are now on the core list (`tools/config/core-lists.json`) and on
the pages. This is the cautious answer; nothing was taken off.

| Edible | Deadly lookalike | Who says so |
|---|---|---|
| Field Mushroom | Deathcap | FN Deathcap page names the Field Mushroom; WT "possible confusion: common field mushroom" |
| Field Mushroom | Destroying Angel | WP Field Mushroom page ("the most dangerous confusion"); FN and WT: young white Agaricus mushrooms |
| Wood Mushroom | Deathcap | FN Deathcap page and FN Wood Mushroom page name each other; WP: young white Agaricus mushrooms |
| Wood Mushroom | Destroying Angel | FN Destroying Angel page names the Wood Mushroom; WP and WT: young white Agaricus mushrooms |

## Where the sources disagree, and what was decided

| Fact | What the sources say | Decided |
|---|---|---|
| Deathcap gills | WP, WF: white (to cream). FN, WT: white, turning cream, sometimes faintly pink with age | Written as "white, later cream (at most faintly pink) — never brown"; no source says brown |
| Deathcap smell when young | FN, WT, WP: none or faint. WF article: like freshly grated potato | Majority: "none to faint when young, sickly-sweet when old". Not used to tell it apart from anything |
| Destroying Angel smell | FN: faint, sickly. WP: like radish. WF article: radish when young, sweet when old | Written as WF puts it, since it covers both. Used only against the Wood Mushroom (aniseed) |
| Destroying Angel ring | FN: not grooved. WP: grooved | Not used |
| False Chanterelle flesh | WF: never pure white. WP: white to yellow to golden-orange | A tie → the cautious answer: flesh colour is NOT offered as a way to tell it from the Chanterelle |
| False Chanterelle stem base | FN: paler towards the base. WP: darker, brownish base | Not used |
| False Chanterelle texture | WP: soft. WF: tough | Not used |
| False Chanterelle edibility | WF, WP: poisonous. FN: "not seriously toxic", treat as not edible. WP also cites one mycologist who calls it harmless | Majority: poisonous (as on the approved list) |
| Chanterelle spore print | FN, WP, WT: pale yellow to cream. WF: ochre | Majority: pale yellow to cream |
| Parasol stem base | WF: young ones "emerge from a sack-like structure". FN, WP: a bulb, no bag | The page's "bag at the base" says no (the cautious answer for an edible: a bag points away from the Parasol); the warning that young Parasols look like deadly Amanitas is on the page |
| Deadly Dapperling flesh | WP: reddens when bruised or cut. FN: white (says nothing of a change) | Recorded as both say; not used to tell it apart |
| Deadly Webcap — mistaken for what | FN, WP, WT: the Chanterelle. WP: the Nicholas Evans party thought theirs were ceps; FN says chanterelles | The Chanterelle and Trumpet Chanterelle pairs stand; ceps are on one source only (below) |

## Found, needing a second source — for later pages

- **Puffballs.** FN's Deathcap page: Deathcaps at the button stage "could also be mistaken for edible puffballs
  such as the Common Puffball or the Stump Puffball". The core list pairs the Common Puffball only with the
  Common Earthball, and gives the Giant Puffball "no dangerous lookalike". To check when the puffball pages
  are written (batch 1).
- **Deadly Dapperling.** WP says it resembles the Fairy Ring Champignon and the Grey Knight. Only one source; to
  check when those pages are written.
- **Deathcap and green brittlegills (Russula).** WP only. **Deadly Webcap and the Cep.** WP only. Neither added.
- **False Deathcap (Amanita citrina).** FN, WT and WF name it as a lookalike of the Deathcap and the Destroying
  Angel. It is not an edible species, so it is not a "dangerous lookalike" pair. Not added.

## Reading rules used

- **Season.** The months a species can be found, taken from FN's months, WF's seasons and the WP/WT wording.
  For an edible species: the months at least two sources share. For a poisonous or deadly species: every month
  any source gives, so it is never pushed down the list. One source is accepted for the season, since the design
  counts it as a description, not a safety fact. The Deadly Dapperling's months come from FN alone.
- **Cap size.** For an edible species: the range at least two sources reach. For a poisonous or deadly species:
  the widest range any source gives.
- **Ring and bag at the base.** Read from each source's full description of the stem. A stem described in full
  with no ring or bag counts as "no". Two facts are stated about a whole genus: "no Agaricus has a volva" (FN,
  WP) and "every Cortinarius has a rusty-brown spore print" (WP). These count for each member of that genus.
- **Protected in the UK.** None of the ten is on Wild Food UK's DEFRA list of protected UK fungi (77 species,
  all four nations) or on Wikipedia's list of species of principal importance in England. The fungi the species
  pages name as protected by law (Schedule 8 — Sandy Stiltball, Royal Bolete, Bearded Tooth, Oak Polypore) are on
  both lists.
- **Flesh change and smell** need one source (they are descriptions). Where they are used to tell two
  mushrooms apart, the row needs two, like every row.
