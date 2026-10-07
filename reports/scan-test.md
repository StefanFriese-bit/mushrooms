# The scan test

Built 2026-10-07 by `tools/evaluate-scan.ts` from 6294 UK observations (12120 photos) of our species — none of them the guide's own photos. Every choice (how photos are prepared, the thresholds) was made on half the observations (even numbers); every figure below is measured on the other half.

**Pass mark (spec 6.3):** dangerous species on the shortlist at least 98 times in 100 when they are the answer. The file the phone runs (8-bit, or full size as a phone file) is scored through that file itself and must also lose at most 1 point of "right first" against the same model run in PyTorch.

**Dangerous** here means the 28 species on the approved list's safety list (Deadly, or a dangerous lookalike of an edible). Other poisonous species among the 300 (the Fly Agaric, for one) count once their pages are written, and the test is run again then.

**Two species lists.** DF20 and FungiTastic models know different species. "Right first", "on the shortlist" and "dangerous on the shortlist" are given twice: over the species the model knows (the pass mark uses this one, as the spec says) and over ALL our species with test photos, where a species the model cannot name counts as a miss — the fair way to compare the two lists.

## How photos are prepared

Each model scored the same sample of the tuning half in each way; the best way is used for every figure below and in the app.

| Model | Prepared as | Observations | Right first (1 photo) |
|---|---|---|---|
| MobileNetV2 | squash, ImageNet colours | 292 | 63.4% |
| MobileNetV2 | square, ImageNet colours | 292 | 68.8% |
| MobileNetV2 | timm, ImageNet colours | 292 | 67.8% |
| MobileNetV2 | squash, 0.5/0.5 colours | 292 | 51.4% |
| ResNet-18 | squash, ImageNet colours | 292 | 58.9% |
| ResNet-18 | square, ImageNet colours | 292 | 61.6% |
| ResNet-18 | timm, ImageNet colours | 292 | 62.3% |
| ResNet-18 | squash, 0.5/0.5 colours | 292 | 47.3% |
| FungiTastic ResNet-50 | squash, ImageNet colours | 298 | 12.4% |
| FungiTastic ResNet-50 | square, ImageNet colours | 298 | 13.1% |
| FungiTastic ResNet-50 | timm, ImageNet colours | 298 | 12.4% |
| FungiTastic ResNet-50 | squash, 0.5/0.5 colours | 298 | 9.4% |
| FungiTastic ResNet-50 | square, 0.5/0.5 colours | 298 | 11.4% |
| FungiTastic ResNet-50 | timm, 0.5/0.5 colours | 298 | 10.4% |
| EfficientNet-B0 | squash, ImageNet colours | 292 | 5.8% |
| EfficientNet-B0 | square, ImageNet colours | 292 | 6.8% |
| EfficientNet-B0 | timm, ImageNet colours | 292 | 6.8% |
| EfficientNet-B0 | squash, 0.5/0.5 colours | 292 | 68.8% |
| EfficientNet-B0 | square, 0.5/0.5 colours | 292 | 69.2% |
| EfficientNet-B0 | timm, 0.5/0.5 colours | 292 | 68.8% |
| EfficientNet-B3 | squash, ImageNet colours | 292 | 5.8% |
| EfficientNet-B3 | square, ImageNet colours | 292 | 7.5% |
| EfficientNet-B3 | timm, ImageNet colours | 292 | 6.5% |
| EfficientNet-B3 | squash, 0.5/0.5 colours | 292 | 68.8% |
| EfficientNet-B3 | square, 0.5/0.5 colours | 292 | 72.6% |
| EfficientNet-B3 | timm, 0.5/0.5 colours | 292 | 75.7% |
| FungiTastic EfficientNet-B3 | squash, ImageNet colours | 298 | 7.7% |
| FungiTastic EfficientNet-B3 | square, ImageNet colours | 298 | 6.0% |
| FungiTastic EfficientNet-B3 | timm, ImageNet colours | 298 | 8.1% |
| FungiTastic EfficientNet-B3 | squash, 0.5/0.5 colours | 298 | 75.8% |
| FungiTastic EfficientNet-B3 | square, 0.5/0.5 colours | 298 | 77.5% |
| FungiTastic EfficientNet-B3 | timm, 0.5/0.5 colours | 298 | 77.9% |
| FungiTastic EfficientNetV2-B3 | squash, ImageNet colours | 298 | 35.9% |
| FungiTastic EfficientNetV2-B3 | square, ImageNet colours | 298 | 37.2% |
| FungiTastic EfficientNetV2-B3 | timm, ImageNet colours | 298 | 35.9% |
| FungiTastic EfficientNetV2-B3 | squash, 0.5/0.5 colours | 298 | 79.9% |
| FungiTastic EfficientNetV2-B3 | square, 0.5/0.5 colours | 298 | 81.5% |
| FungiTastic EfficientNetV2-B3 | timm, 0.5/0.5 colours | 298 | 81.5% |
| ViT-Base (ceiling only) | squash, ImageNet colours | 292 | 56.5% |
| ViT-Base (ceiling only) | square, ImageNet colours | 292 | 59.9% |
| ViT-Base (ceiling only) | timm, ImageNet colours | 292 | 63.4% |
| ViT-Base (ceiling only) | squash, 0.5/0.5 colours | 292 | 65.8% |
| ViT-Base (ceiling only) | square, 0.5/0.5 colours | 292 | 69.5% |
| ViT-Base (ceiling only) | timm, 0.5/0.5 colours | 292 | 73.6% |
| FungiTastic ViT-Base (ceiling only) | squash, ImageNet colours | 298 | 63.8% |
| FungiTastic ViT-Base (ceiling only) | square, ImageNet colours | 298 | 63.1% |
| FungiTastic ViT-Base (ceiling only) | timm, ImageNet colours | 298 | 65.1% |
| FungiTastic ViT-Base (ceiling only) | squash, 0.5/0.5 colours | 298 | 77.9% |
| FungiTastic ViT-Base (ceiling only) | square, 0.5/0.5 colours | 298 | 80.5% |
| FungiTastic ViT-Base (ceiling only) | timm, 0.5/0.5 colours | 298 | 79.5% |

squash = the whole photo scaled to a square; square = the centre square; timm = the centre 87.5% square (the models' own evaluation crop).

## The candidates

Over the species each model knows (up to three photos unless said):

| Model | Size | Knows (of 300) | Prepared as | Right first (1 photo) | Right first | On the shortlist | Dangerous on the shortlist | False alarms | "Not sure" | Passes |
|---|---|---|---|---|---|---|---|---|---|---|
| MobileNetV2 | 4.3 M | 273 | square, ImageNet colours | 72.4% | 76.0% | 94.1% | 98.9% (440/445) | 31.6% | 61.7% | yes |
| MobileNetV2 (8-bit) | 4.3 M | 273 | square, ImageNet colours | 70.9% | 74.6% | 93.0% | 96.2% (428/445) | 14.0% | 63.1% | no |
| MobileNetV2 (phone file) | 4.3 M | 273 | square, ImageNet colours | 72.4% | 76.0% | 94.1% | 98.9% (440/445) | 31.6% | 61.7% | yes |
| ResNet-18 | 12 M | 273 | timm, ImageNet colours | 66.7% | 71.4% | 91.7% | 97.3% (433/445) | 26.9% | 61.8% | no |
| EfficientNet-B0 | 6.1 M | 273 | square, 0.5/0.5 colours | 73.2% | 78.4% | 94.2% | 98.0% (436/445) | 23.6% | 53.1% | no |
| EfficientNet-B0 (8-bit) | 6.1 M | 273 | square, 0.5/0.5 colours | 52.7% | 57.8% | 84.9% | 96.2% (428/445) | 47.4% | 89.4% | no |
| EfficientNet-B3 | 13.2 M | 273 | timm, 0.5/0.5 colours | 76.2% | 80.6% | 95.9% | 97.3% (433/445) | 16.9% | 48.5% | no |
| EfficientNet-B3 (8-bit) | 13.2 M | 273 | timm, 0.5/0.5 colours | 32.5% | 37.5% | 62.6% | 75.5% (336/445) | 27.6% | 82.6% | no |
| FungiTastic EfficientNet-B3 | 15 M | 282 | square, 0.5/0.5 colours | 78.3% | 81.8% | 95.6% | 97.8% (449/459) | 10.7% | 38.0% | no |
| FungiTastic EfficientNetV2-B3 | 17.2 M | 282 | square, 0.5/0.5 colours | 80.4% | 84.3% | 96.5% | 97.2% (446/459) | 8.3% | 24.0% | no |
| ViT-Base (ceiling only) | 87 M | 273 | timm, 0.5/0.5 colours | 76.8% | 80.6% | 96.3% | 99.1% (441/445) | 30.5% | 42.4% | yes |
| FungiTastic ViT-Base (ceiling only) | 88.3 M | 282 | square, 0.5/0.5 colours | 81.2% | 83.7% | 96.6% | 98.0% (450/459) | 7.2% | 22.9% | yes |

Over ALL our species with test photos (3178 observations, 462 of them dangerous species; up to three photos):

| Model | Right first | On the shortlist | Dangerous on the shortlist | Dangerous the model cannot name |
|---|---|---|---|---|
| FungiTastic EfficientNetV2-B3 | 79.9% | 91.4% | 96.5% (446/462) | 3 |
| FungiTastic ViT-Base (ceiling only) | 79.3% | 91.5% | 97.4% (450/462) | 3 |
| FungiTastic EfficientNet-B3 | 77.5% | 90.6% | 97.2% (449/462) | 3 |
| ViT-Base (ceiling only) | 74.2% | 88.6% | 95.5% (441/462) | 17 |
| EfficientNet-B3 | 74.1% | 88.2% | 93.7% (433/462) | 17 |
| EfficientNet-B0 | 72.1% | 86.7% | 94.4% (436/462) | 17 |
| MobileNetV2 | 69.9% | 86.5% | 95.2% (440/462) | 17 |
| MobileNetV2 (phone file) | 69.9% | 86.5% | 95.2% (440/462) | 17 |
| MobileNetV2 (8-bit) | 68.7% | 85.5% | 92.6% (428/462) | 17 |
| ResNet-18 | 65.6% | 84.3% | 93.7% (433/462) | 17 |
| EfficientNet-B0 (8-bit) | 53.2% | 78.1% | 92.6% (428/462) | 17 |
| EfficientNet-B3 (8-bit) | 34.5% | 57.6% | 72.7% (336/462) | 17 |

Thresholds per model (from the tuning half): safety = the highest score at which a dangerous species is still added; "not sure" = the lowest top score above which the first answer is right 90 times in 100; off-season = the mark-down factor; group = the lowest score of a genus's species added up above which the group headline ("most likely a brittlegill") is right 90 times in 100, with one photo and with three.

- MobileNetV2: safety 0.0001, not sure 0.9, off-season ×0.3, group 0.7
- MobileNetV2 (8-bit): safety none reaches the pass mark, not sure 0.9, off-season ×0.3, group 0.7; against the same model in PyTorch 1.4 points of "right first" lost
- MobileNetV2 (phone file): safety 0.0001, not sure 0.9, off-season ×0.3, group 0.7; against the same model in PyTorch no "right first" lost
- ResNet-18: safety 0.0005, not sure 0.8, off-season ×0.3, group 0.7
- EfficientNet-B0: safety 0.00005, not sure 0.9, off-season ×0.3, group 0.7
- EfficientNet-B0 (8-bit): safety none reaches the pass mark, not sure 0.9, off-season ×0.3, group 0.75; against the same model in PyTorch 20.6 points of "right first" lost
- EfficientNet-B3: safety 0.0001, not sure 0.9, off-season ×0.3, group 0.6
- EfficientNet-B3 (8-bit): safety none reaches the pass mark, not sure 0.9, off-season ×0.3, group none reaches 90 in 100; against the same model in PyTorch 43.1 points of "right first" lost
- FungiTastic EfficientNet-B3: safety 0.001, not sure 0.7, off-season ×0.3, group 0.4
- FungiTastic EfficientNetV2-B3: safety 0.001, not sure 0.6, off-season ×0.3, group 0.3
- ViT-Base (ceiling only): safety 0.00002, not sure 0.8, off-season ×0.3, group 0.6
- FungiTastic ViT-Base (ceiling only): safety 0.002, not sure 0.6, off-season ×0.3, group 0.3

## What the models know

**DF20** (1,604 classes, the list the app runs today): 273 of our 300 species. The 27 it cannot recognise:

Fool's Webcap (*Cortinarius orellanus*) — **deadly** · Deadly Fibrecap (*Inosperma erubescens*) — **deadly** · Ivory Funnel (*Collybia dealbata*) — **deadly** · Wrinkled Conecap (*Pholiotina rugosa*) — **deadly** · Jack O'Lantern (*Omphalotus illudens*) — **poisonous** · Stump Puffball (*Apioperdon pyriforme*) · Wrinkled Peach (*Rhodotus palmatus*) · Orange Pore Fungus (*Favolaschia claudopus*) · Rhodocollybia asema (*Rhodocollybia asema*) · Smoky Spindles (*Clavaria fumosa*) · Poplar Fieldcap (*Cyclocybe cylindracea*) · Hazel Gloves (*Hypocreopsis rhododendri*) · Golden Spindles (*Clavulinopsis fusiformis*) · Cobalt Crust (*Terana coerulea*) · Phaeotremella frondosa (*Phaeotremella frondosa*) · Flame Shield (*Pluteus aurantiorugosus*) · Holly Parachute (*Marasmius hudsonii*) · Jubilee Waxcap (*Gliophorus reginae*) · Lilac Pinkgill (*Entoloma porphyrophaeum*) · Red Cage (*Clathrus ruber*) · Blackening Wax-cap (*Hygrocybe nigrescens*) · Blueleg Brownie (*Psilocybe cyanescens*) · Plantpot Dapperling (*Leucocoprinus birnbaumii*) · Haw Goblet (*Monilinia johnsonii*) · Glue Crust (*Hydnoporia corrugata*) · Pale Stagshorn (*Calocera pallidospathulata*) · Dung-loving Deconica (*Deconica coprophila*)

31 of its species carry an older name of one of ours (as iNaturalist files them), e.g. *Amanita gemmata* = Fly Agaric, *Armillaria lutea* = Bulbous Honey Fungus, *Clitocybe odora* = Aniseed Funnel. One of them looks different: the Jewelled Amanita (*Amanita gemmata*) counts as the Fly Agaric, because iNaturalist files it there; on a scan it shows as the Fly Agaric, a poisonous Amanita.

**FungiTastic** (2,829 classes): 282 of our 300 species. The 18 it cannot recognise:

Fool's Webcap (*Cortinarius orellanus*) — **deadly** · Ivory Funnel (*Collybia dealbata*) — **deadly** · Jack O'Lantern (*Omphalotus illudens*) — **poisonous** · White Fibrecap (*Inocybe geophylla*) · Orange Pore Fungus (*Favolaschia claudopus*) · European False Blusher (*Amanita excelsa*) · Poplar Fieldcap (*Cyclocybe cylindracea*) · Hazel Gloves (*Hypocreopsis rhododendri*) · Wrinkled Club (*Clavulina rugosa*) · Crested Coral (*Clavulina coralloides*) · Holly Parachute (*Marasmius hudsonii*) · Jubilee Waxcap (*Gliophorus reginae*) · Blackening Wax-cap (*Hygrocybe nigrescens*) · Blueleg Brownie (*Psilocybe cyanescens*) · Sordid Blewit (*Collybia sordida*) · Haw Goblet (*Monilinia johnsonii*) · Pale Stagshorn (*Calocera pallidospathulata*) · Lilac Bonnet (*Mycena pura*)

24 of its species carry an older name of one of ours (as iNaturalist files them), e.g. *Amanita gemmata* = Fly Agaric, *Armillaria lutea* = Bulbous Honey Fungus, *Clitocybe odora* = Aniseed Funnel. One of them looks different: the Jewelled Amanita (*Amanita gemmata*) counts as the Fly Agaric, because iNaturalist files it there; on a scan it shows as the Fly Agaric, a poisonous Amanita.

## The group headline and "not sure"

| | MobileNetV2 (phone file), 1 photo | MobileNetV2 (phone file), up to 3 | FungiTastic EfficientNetV2-B3, 1 photo | FungiTastic EfficientNetV2-B3, up to 3 |
|---|---|---|---|---|
| Group headline shown | 77.1% | 65.0% | 96.7% | 97.3% |
| …right when shown | 91.3% | 95.5% | 91.3% | 94.5% |
| "Not sure" shown | 44.8% | 59.4% | 15.4% | 21.2% |
| …right species still on the list | 83.7% | 90.7% | 83.4% | 89.8% |

## Dangerous species, one by one (up to three photos)

| Species | Danger | MobileNetV2 (phone file) | FungiTastic EfficientNetV2-B3 |
|---|---|---|---|
| Deathcap | deadly | 27/27 | 27/27 |
| Destroying Angel | deadly | 8/8 | 8/8 |
| Funeral Bell | deadly | 29/29 | 29/29 |
| Deadly Dapperling | deadly | 0/0 | 0/0 |
| Fatal Dapperling | deadly | 12/12 | 11/12 |
| Deadly Webcap | deadly | 30/30 | 30/30 |
| Fool's Webcap | deadly | cannot name it (Check catches 0/0) | cannot name it (Check catches 0/0) |
| Deadly Fibrecap | deadly | cannot name it (Check catches 0/4) | 4/4 |
| Lilac Fibrecap | deadly | 3/3 | 3/3 |
| Fool's Funnel | deadly | 11/11 | 11/11 |
| Ivory Funnel | deadly | cannot name it (Check catches 0/0) | cannot name it (Check catches 0/0) |
| False Morel | deadly | 22/22 | 22/22 |
| Brown Rollrim | deadly | 29/29 | 29/29 |
| Wrinkled Conecap | deadly | cannot name it (Check catches 0/10) | 5/10 |
| Angel's Wings | deadly | 23/23 | 23/23 |
| Grey Knight | deadly | 21/22 | 21/22 |
| Frosty Funnel | deadly | 2/2 | 2/2 |
| Panthercap | poisonous | 29/29 | 29/29 |
| Stinking Dapperling | poisonous | 25/25 | 25/25 |
| Yellow Stainer | poisonous | 23/24 | 24/24 |
| Livid Pinkgill | poisonous | 0/0 | 0/0 |
| Jack O'Lantern | poisonous | cannot name it (Check catches 1/3) | cannot name it (Check catches 0/3) |
| False Chanterelle | poisonous | 30/30 | 30/30 |
| Common Earthball | poisonous | 26/26 | 26/26 |
| Magpie Inkcap | poisonous | 24/24 | 24/24 |
| Woolly Milkcap | poisonous | 27/27 | 27/27 |
| Inky Mushroom | poisonous | 21/22 | 20/22 |
| Sickener | poisonous | 18/20 | 16/20 |

## The choice

**MobileNetV2 (phone file)** passes and is the best phone-sized model of the DF20 list, the one the app runs. Its speed on Stefan's iPhone decides (spec 6.1): a three-photo scan in about 3 seconds.

**Best FungiTastic model: FungiTastic EfficientNetV2-B3** — does not pass; right first 79.9% of all our species (MobileNetV2 (phone file): 69.9%). Moving the app to it is a decision for Stefan and needs app work (its own class list, names and phone file); this test never switches it by itself.

