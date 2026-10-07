# Batch 3 — 12 more pages with NatureSpot as the second website (07/10/2026)

Stefan approved NatureSpot (naturespot.org) as an extra trusted website on 07/10/2026 (and not Rogers Mushrooms; see
`reports/more-sources-research.md`). NatureSpot's species accounts — read as the account only, never the recorders'
photo captions or records — gave 19 of the 40 species without a page a second website. **12 of them now have a page**;
the guide has **272 pages for the 300 species**. The two-websites-per-fact rule and the batch-2 rules are unchanged.

## The 12 new pages

Butter Waxcap, Persistent Waxcap, Spangle Waxcap, Glutinous Waxcap, Orange Mosscap, Flame Shield, Holly Parachute,
Dewdrop Mottlegill, Conical Brittlestem, Beechmast Candlesnuff, Pipe Club, Bleeding Broadleaf Crust.

All 12 are **not edible** (none poisonous or deadly). Each has 6 checked photos (72 in all). None is on either
protection list (the Wild Food UK / DEFRA list and Wikipedia's England s41 list, both read again today).

New lookalikes, linked both ways: Butter Waxcap ↔ Golden Waxcap; **Persistent Waxcap ↔ Blackening Waxcap (poisonous)**
— it does not blacken; Glutinous Waxcap ↔ Heath Waxcap (gill colour).

## My readings — please confirm or strike

1. **Persistent Waxcap is "not edible".** First Nature: "some field guides … say that it is edible", but it "is not
   highly rated"; NatureSpot says nothing about eating. With one source and no clear verdict, I took the cautious one.
2. **Where it grows, when the two sites differ** (listed as batch 2 listed the Verdigris Agaric):
   Conical Brittlestem — First Nature: in leaf litter; NatureSpot: often on rotten wood or woodchip → *ground*.
   Pipe Club — First Nature: on the ground in leaf litter, sometimes from rotting wood; NatureSpot: from small branches
   and buried sticks → *ground* (what you see). Holly Parachute (fallen holly leaves) → *ground*. Beechmast Candlesnuff
   (old beech-nut cases in the litter) → *wood*, as batch 2 did for the Earpick Fungus on buried pine cones.
3. **"No ring" and "no bag at the base"** are read, as on the 260 earlier pages, from a site's description of the stem
   that names none (on the earlier pages 322 of 442 "no ring" citations are of that kind). A ring that IS there, or
   gills, is never read from silence — which is why the Wrinkled Fieldcap is still held (below).
4. **Cap sizes given only as "under 1 cm" / "under 4 cm"** (Orange Mosscap, Dewdrop Mottlegill) are stored as that one
   figure. The size is not shown on the page; it only places the species in Identify's size bands (under 5 cm here).

## Photos left out (`tools/config/photo-skip.json`)

- Flame Shield, sighting 140487876: a large bracket fungus fills the wide shot; the close-up rests on it too.
- Bleeding Broadleaf Crust, sighting 142904583: bright orange-yellow crusts, unlike the buff to pinkish-brown both
  sources describe — it may be another *Stereum*.

## Still without a page (28)

**Two sites now, but a fact a page needs is missing (8):**
Yellow Club, Common Jellyspot, Beech Jellydisc, Powderpuff Bracket — no trusted site says whether they can be eaten;
Conifer Blueing Bracket — only First Nature calls it edible (as with the Matt Bolete);
Bolete Mould — no trusted site says when it appears (Wikipedia: "not edible and may be poisonous");
Dung-loving Deconica — Wikipedia's only season is North America's;
Wrinkled Fieldcap — the gills are described by First Nature only.
**Held in batch 2, and NatureSpot does not change that (10):** Wrinkled Club, Thimble Morel, Dark Honey Fungus, Matt
Bolete — their missing spore print, cap size or second "edible" are not in NatureSpot's accounts; Green Elfcup — still
no site on eating it; Meadow Puffball, Blackening Brittlegill, Sordid Blewit, Field Bird's Nest, *Phaeotremella
frondosa* — no NatureSpot page.

**One trusted site or none (10):** *Rhodocollybia asema*, Birch Woodwart, Hair Ice, *Ganoderma resinaceum*, Steely
Bonnet (NatureSpot only), Blackening Wax-cap (*Hygrocybe nigrescens*), Heath Navel, Dappled Webcap, Olive Shaggy
Parasol, Haw Goblet.

## Tools

`tools/research/gather.py --naturespot <name> | --naturespot-missing` (the account's labelled fields only);
NatureSpot added to `sources.py`, `verify.py`, `queue.py`, `read.py` and to the allowed source websites
(`tools/config/core-lists.json`); `page.py` now dates a page by the day it is written.
