# Tyohar feasibility report (issue #65, parent #36)

Status: agent research only. **No human factual or cultural review has happened** (no reviewer assigned yet). Nothing here changes `src/data/words/tyohar.json`, tests, config or mechanics. Candidates live in [tyohar-candidates.md](tyohar-candidates.md), outside the playable banks.

Report date: 2026-11-04. Baseline: `tyohar.json` at this branch (32 entries, `tyohar-001` to `tyohar-032`), `src/game/config.ts`, `shuffleBag.ts`, `milestones.ts`.

## Summary

- Familiar, distinct, respectful supply is small. Of about 70 festival names screened, **9 qualify for a first reviewed batch (B1)** and 13 are conditional on a human call. The rest are aliases, sub-days of an existing entry, solemn, or too obscure.
- Recommended batch B1 (9 entries): **+3 Easy, +5 Medium, +1 Hard**, giving tiers 18 / 15 / 8 (total 41).
- Review round 1 moved THAIPUSAM, KARTHIGAI DEEPAM and PUSHKAR MELA (Hard) and VISHU (Medium) from B1 to conditional, because every tier is now judged against its strictest live clue visibility (section 4.1): a medium or hard word is played on Hard with nothing shown and at most one clue per run, so moderate-familiarity regional names do not qualify without human confirmation of high familiarity.
- The "25 per tier" hypothesis is **not reachable** without padding. Shortfall against 25 after B1: Easy 7, Medium 10, Hard 17. Even if every conditional candidate passed review the ceiling is 18 / 19 / 17.
- Late-Hard repeat horizon under #31 as written: **7 today, 8 with B1, 17 at the ceiling.** If #31 instead keeps Hard 10+ as medium + hard, the horizon is 17 today and 23 with B1. Content alone barely moves the hard-only case; the progression choice matters more (section 4.3).
- Boss concentration is a separate risk (section 1.5): with `BOSS_CANDIDATES = 3` the same three top-ranked words supply most bosses, so those need confirmed high familiarity.
- Existing-entry audit: 2 verified corrections (low severity) and a larger set of review flags (section 2). Nothing was edited.

## 1. Current state

### 1.1 Counts

| | Easy | Medium | Hard | Total |
|---|---|---|---|---|
| Tyohar raw tiers | 15 | 10 | 7 | 32 |
| Status | all `draft` | all `draft` | all `draft` | approved 0 |

`INCLUDE_DRAFT_WORDS = true`, so playable = 32 (`npm run words:check`, run for this report: 483 tests pass; tyohar easy 15, medium 10, hard 7; no cross-category answer duplicates; 159 entries across five banks, all draft).

Effective run pools (`DIFFICULTY_RULES[d].pool`): Easy = easy = **15**; Medium = easy + medium = **25**; Hard = medium + hard = **17**. Masala Mix draws from all five banks, so Tyohar is a fifth of its pool: easy 74, medium 50, hard 35 across categories (Tyohar contributes 15 / 10 / 7). Masala is not the binding case.

What the player sees (`DIFFICULTY_RULES`, `visibleClues`): Easy shows 2 chips and the clue; Medium shows the clue only; **Hard shows neither chips nor clue and never shows chips.** The extra-clue power-up (slot index 1, slot 2 in the brief) unlocks one hidden level per use: on Hard the first use shows the clue and a second would show the extraClue; on Easy and Medium it shows the extraClue. `START_POWER_UPS` gives that slot 1, and boss rewards restock only slot index 0 (reveal a letter, `MILESTONE_REWARD`). So a Hard run gets **at most one clue** in total, and no chips.

Where words are played (pools above): easy-tier words on Easy and Medium; medium-tier on Medium and Hard; hard-tier on Hard. Under proposed #31 hard words also become Easy and Medium bosses. Section 4.1 uses this for tiering.

### 1.2 How draws work

- One saved bag per theme and difficulty (`BagState.remaining`, `last`). `drawNext` takes the next ID; when the bag is empty it reshuffles the whole pool, swapping so the first word is never the last one drawn.
- Boss draws (`drawBoss`) take one at random from the top `BOSS_CANDIDATES = 3` words **still in the bag**, ranked by `bossScore` (tier first, then distinct letters, then length), and remove it from the same bag. Late in a cycle the best remaining may be an easier tier.
- A boss is the word that would reach the next club: `isBossWord(hits)` is true when `next(hits).hits === hits + 1`. The Nth word drawn is therefore a boss when N equals a club's hit threshold.

### 1.3 Boss demand per run

Club thresholds `CLUB_LADDER` = 10, 20, 35, 55, 80; `LADDER_EXTENSION.gapGrowth = 5` continues with gaps 30, 35, 40, 45, giving 110, 145, 185, 230.

| Word number drawn | 10 | 20 | 35 | 55 | 80 | 110 | 145 |
|---|---|---|---|---|---|---|---|
| Bosses drawn so far | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| Boss share of draws so far | 10% | 10% | 8.6% | 7.3% | 6.3% | 5.5% | 4.8% |

A run that dies on word N has N draws (the failed word is drawn), so it has seen the bosses at or below N.

### 1.4 Cross-session distinct-draw horizon

Definition used here: the horizon is the pool size N a bag cycles through, in draws (boss draws count). Because the bag is saved, this holds across sessions. Exact properties (arithmetic, plus a scratch simulation below):

- No answer repeats inside a cycle; the mean gap between two appearances of the same answer is exactly N draws.
- At a cycle boundary the only guard is "not the last word drawn", so the shortest possible gap is **2 draws**. Here the gap is the difference in draw number between two consecutive appearances of the same answer (a gap of 1 means back-to-back, which the guard prevents). "Reappears within 3 draws" means that gap is 2 or 3, i.e. the answer is one of the next 3 draws after its previous appearance. Simulated share of all consecutive-appearance pairs with gap of at most 3: N=7 11.5%, N=10 5.5%, N=15 2.3%, N=17 1.9%, N=25 0.8%.
- Sessions to see everything once = N / words per session. Example: Hard pool 17 takes 17 words, which is one run to ~17 hits; a run to the second club (20 words) already contains a repeat.

Simulation note: scratch Node script, a hand port of `drawNext`/`drawBoss`/`refill` (not committed, not the real modules), 20,000 runs per row, bag starts fresh each run, so figures are approximate (about plus or minus 0.01) and ignore the real persisted mid-cycle bag. Treat as arithmetic support, not a measurement of players.

### 1.5 Current rules, boss supply and concentration

Share of bosses drawn from the top tier available, Hard (pool 17), boss 1 to 5 in an 80-hit run (simulated): 91%, 100%, 100%, 100%, 77% hard-tier (the rest medium once hard words are used up in the cycle). Mean distinct boss answers across the 5 bosses of an 80-hit run: Easy 3.73, Medium 3.81, Hard 3.57. So bosses already repeat inside a long run; this is not new with #31.

**Concentration.** `drawBoss` ranks the words still in the bag by `bossScore` (tier x 1000 + distinct letters x 20 + letters) and picks at random among the top `BOSS_CANDIDATES = 3`. Whichever words have the highest scores therefore become the common bosses, whether or not players know them.

| Pool | Current top-3 by bossScore | Simulated share of the first 5 bosses |
|---|---|---|
| Hard tier (Hard, and Easy/Medium bosses under #31) | THRISSUR POORAM 2214, NAG PANCHAMI 2171, KUMBH MELA 2169 | 23.5%, 23.5%, 23.7% (about 71% together; Hard pool 17, 20,000 runs) |
| Medium tier (Medium bosses) | GOVARDHAN PUJA 1233, CHHATH PUJA 1150, DURGA PUJA 1149 | not simulated |

So the most likely Hard boss today is THRISSUR POORAM, a Kerala temple festival I rate moderate-to-low national familiarity (agent judgement, unverified). The hard-tier bosses are the words a casual Hard player meets at every club.

B1 changes these ranks (agent scoring script, `bossScore` formula): AKSHAY TRITIYA (2173; AKSHAYA TRITIYA 2174) enters the hard top-3 and pushes KUMBH MELA out while all are in the bag. In the medium tier BASANT PANCHAMI (1214), BUDDHA PURNIMA (1213) and HANUMAN JAYANTI (1194) outrank everything except GOVARDHAN PUJA; the top-3 becomes GOVARDHAN PUJA, BASANT PANCHAMI, BUDDHA PURNIMA. Letter-rich long names rank high regardless of familiarity, so an obscure but long name is a boss magnet. Section 4.5 turns this into an integration criterion. The simulation is the same scratch hand port as in 1.4.

### 1.6 Proposed #31 (not built, not decided)

#31 stages: Easy 0-9 hits easy, 10+ easy + medium; Medium 0-9 easy, 10-34 medium, 35+ medium + hard; Hard 0-9 medium, 10+ hard; boss from the tier above the stage, hard if none above.

Assumption (not stated in #31): one saved bag per theme, difficulty and stage pool, and a boss draws from the bag of the tier it takes from. Flag for #31.

| Difficulty | Stage pools with current content | Late stage horizon |
|---|---|---|
| Easy | 0-9: 15; 10+: 15 + 10 = 25 | 25 |
| Medium | 0-9: 15; 10-34: 10; 35+: 10 + 7 = 17 | 17 (10 in the middle stage) |
| Hard | 0-9: 10; 10+: **7** | **7** |

Draws from the 7 hard words in a Hard run (draw 10 is boss 1 from hard, then every word from draw 11): reaching 20 words = 11 hard draws (1.6 cycles); 35 words = 26 (3.7 cycles); 55 words = 46 (6.6); 80 words = 71 (10.1). The first repeat is possible at the 8th hard draw, i.e. word 17, before the second club. Mean distinct boss answers in Hard: 1.81 of 2 (to word 20), 2.55 of 3 (35), 3.14 of 4 (55), 3.50 of 5 (80). In Easy and Medium under #31, bosses from club 2 onward all come from the 7 hard words, so the hard tier carries bosses for all three difficulties.

Medium's middle stage is also short: words 11 to 35 are 25 draws, of which two are bosses (words 20 and 35, taken from the hard bag), leaving **23 non-boss medium draws** from 10 medium words (the word-10 boss also takes a medium word under the bag assumption above). Medium 35+ is 17.

### 1.7 #33 relevance

#33 (written analysis in #60, human evidence in #68) changes run length and boss cadence, which sets draws per run D. This report is parametric in D: hard-only draws are D - 9 under #31 Hard, and bosses drawn follow the table in 1.3. If #33 shortens gaps or caps recovery, boss share of draws rises or falls and the per-run repeat risk moves with it; the pool sizes below do not depend on #33. No #33 numbers are assumed here.

### 1.8 Calendar clusters in the current 32

Counting entries by calendar window (agent grouping; relations are sourced in section 2; BIHU is counted once, in April):

| Window | Existing entries | Count |
|---|---|---|
| Mid-January solar | LOHRI, PONGAL, MAKAR SANKRANTI | 3 |
| Autumn Navratri to Dussehra | NAVRATRI, DUSSEHRA, DURGA PUJA | 3 |
| Diwali days | DIWALI, BHAI DOOJ, GOVARDHAN PUJA | 3 |
| Spring, March to mid-April (Chaitra new year, Rama Navami, solar new years) | GUDI PADWA, UGADI, RAM NAVAMI (Chaitra, spring: [S] Rama Navami), BAISAKHI, BIHU | 5 |
| Holi | HOLI, HOLA MOHALLA | 2 |
| **In a window** | | **16 of 32** |

They are distinct observances, not duplicates, but variety feels lower than the answer count suggests.

How candidates grow the windows (agent grouping):

| Window | Existing | B1 adds | If conditional pass |
|---|---|---|---|
| Diwali days | 3 | DHANTERAS (4) | none |
| Spring, March to mid-April | 5 | HANUMAN JAYANTI (6; Mar-Apr is agent knowledge, varies by region) | VISHU, POHELA BOISHAKH, PUTHANDU, NAVROZ, MAHAVIR JAYANTI, EASTER (up to 12) |
| Kartik Purnima (Nov) | GURPURAB (1) | none | PUSHKAR MELA, KARTHIGAI DEEPAM (up to 3; Dev Deepawali is rejected as an alias of Kartika Purnima [S]) |
| Mid-January and after | 3 | BASANT PANCHAMI (Jan-Feb, adjacent, not inside) | THAIPUSAM (Jan-Feb) |
| New windows | | MAHA SHIVRATRI, RATH YATRA, BUDDHA PURNIMA, GURU PURNIMA, AKSHAY TRITIYA, BAKRID (lunar, floats) | |

So B1 deliberately adds mostly new windows; the one exception is DHANTERAS, kept for its very high familiarity.

## 2. Existing-entry audit

Labels: **VC** = verified correction (a fetched source directly contradicts or the entry omits something it states; 2 found: the BIHU chip and the UGADI clue); **RF** = review flag (needs a human; evidence partial, none, or a design or scope choice); **OK** = checked, consistent with the fetched source. Source key: [S] Wikipedia REST summary, [F] MediaWiki API plain-text extract; both fetched 2026-11-04 (page list in section 5). Wikipedia is a single tertiary source: even VC items need a human to confirm before any JSON edit.

| Entry (ID) | Finding | Label | Evidence and note |
|---|---|---|---|
| DUSSEHRA (007) | Same festival as Vijayadashami (alias) | OK | [S] Dussehra redirects to Vijayadashami, "also known as Dasara, Dussehra", Sept or Oct. Existing extraClue already names Vijayadashami. Do not add Vijayadashami as an answer. |
| DUSSEHRA (007) | "Raavan ka putla jalta" is the north Indian form; in Durga Puja/Navratri regions it is the end of the Durga festival | RF | [S] says Vijayadashami ends Durga Puja and Navaratri. Effigy burning is not in the fetched text. Unverified. |
| NAVRATRI (006) / DURGA PUJA (016) / DUSSEHRA (007) | Three entries share one 10-day window | RF | Distinct observances (Navratri worship over nine nights, Durga Puja eastern form, Vijayadashami the tenth day) [S]; keep all, but do not add more from this window. |
| NAVRATRI (006) seasonal scope | Chip "Sept-Oct" is the autumn Navratri only; there is also a spring one | RF | [S] Rama Navami: "part of the Chaitra Navaratri festival in spring". Existing RAM NAVAMI extraClue already says Chaitra Navratri. The chip is right for the autumn one; the answer is generic. A scope choice (scope the clue to Sharad Navratri, or name the season) for the human reviewer, not a factual error. |
| NAVRATRI (006) | "garba aur dandiya" is a Gujarat/west India practice, not universal | RF | Not in the fetched Navaratri summary ("celebrated in varying ways"). Wording flag. |
| MAKAR SANKRANTI (015) | extraClue "Gujarat mein ise Uttarayan kehte hain" | RF | [S] Makar Sankranti: "also referred to as Uttarayana". [S] Uttarayana page is the astronomical term. The Gujarat kite-festival naming is not in the fetched text. Unverified. Uttarayan is an alias, rejected as a separate answer. |
| MAKAR SANKRANTI / PONGAL / LOHRI / BIHU | Relations | OK | [F] Pongal: "corresponds to Makar Sankranti, the Hindu observance celebrated under various regional names"; 14 or 15 Jan; three or four days (Bhogi, Thai Pongal, Mattu Pongal, Kaanum). [F] Lohri: night before Maghi, commonly 13 Jan, primarily Punjab. [S] Bhogi is day one of the four-day Sankranti festival. [F] Bihu: three Bihus, Magh (Bhogali) in January. Pongal and Lohri are named regional observances with their own customs; keep as distinct, do not count Bhogi, Uttarayan, Thai Pongal or Magh Bihu as extra answers. Existing clues "Makar Sankranti se ek din pehle" (Lohri) and "chaar din" (Pongal) are consistent. |
| BIHU (018) | Scope: answer covers three festivals | RF | [F] Rongali/Bohag (April, new year, spring), Kongali/Kati (Oct-Nov, "sombre"), Bhogali/Magh (January, harvest). Clue "saal mein teen baar" and extraClue "Rongali wala sabse mashhoor" match [F]. Do not add named sub-Bihus. |
| BIHU (018) | Chip "Harvest" | VC | [F]: only Bhogali is the harvest festival; Rongali is a spring/sowing and new-year festival, Kati a crop-protection one. Chip fits one of three. Human to pick wording. |
| TEEJ (031) | Collective term | RF | [S] Teej: "a collective term for three Hindu festivals" for Parvati and Shiva. Chip "July-Aug", "Saawan ke jhoole" fits the monsoon (Hariyali) form only. Other Teej dates and the "Rajasthan aur UP" scope are not in the fetched text. Unverified. |
| GURPURAB (019) | Answer is broader than the clue | RF (design flag) | [S] Gurpurab: "celebration of an anniversary of a Guru's birth" (any Guru). The clue is Guru Nanak Gurpurab specifically [S], which is also called "Guru Nanak Prakash Utsav" and "Guru Nanak Jayanti" [S]. Whether the answer should stay generic or be scoped, and whether "Guru Nanak Jayanti" should be recorded as an alias so it is never added separately, is a design and cultural decision. |
| GURPURAB (019) | Chip "Oct-Nov" | RF | [F] Guru Nanak Gurpurab: Sikhs celebrate it "around November", on Kartik Purnima. [S] Kartika Purnima: "November or December". Chip "Oct-Nov" may be early. Date also differs between the Bikrami and Nanakshahi calendars [F]. |
| LOSAR (027) | Calendars and regions | RF | [F]: "celebrated on various dates depending on location (Tibet, Bhutan, Nepal, Arunachal Pradesh, Sikkim and Ladakh)", Feb or March, lunisolar Tibetan calendar; Nepal's Sonam Lhosar about eight weeks earlier. Clue "Ladakh aur Sikkim" is a subset; no month chip is good (dates vary). |
| HORNBILL (026) | "saari tribes ek saath" | RF | [S]: "represents all ethnic groups of Nagaland", 1-10 December, "Festival of Festivals". The fetched text supports the broad statement, but "saari" is absolute and "tribes" terminology wants human sign-off. extraClue "Ek chidiya ke naam pe" not fetched. |
| EID UL FITR (005) | Spelling | RF | [S] standard English title is "Eid al-Fitr"; "Eid ul Fitr" is the common Indian transliteration (agent knowledge, unverified). Tiles differ (U vs A), so a player using the other spelling pays a life. Needs a human call; keep ID. |
| EID UL FITR (005) | Chip "After Ramzan" | OK | [S] first day of Shawwal, ends month-long fasting. Lunar-safe chip. "Chaand dikha" and "bado se paise" (eidi) are not in the fetched text; the second is a custom, not universal. |
| UGADI (022) | clue "Karnataka aur Andhra ka naya saal" omits Telangana | VC | [F/S] Ugadi: celebrated by Kannadigas and Telugu people "in Andhra Pradesh, Karnataka and Telangana, in some parts of Tamil Nadu and Kerala". Low severity. |
| GUDI PADWA (021) / UGADI (022) | Same lunar day, different peoples | OK | [S] Ugadi: Chaitra Shukla Pratipada. [F] Gudi Padwa: start of Chaitra, Marathi and Konkani Hindus. Same date, distinct observances; keep both. |
| BAISAKHI (017) | Aliases and scope | OK | [S] Vaisakhi, "also known as Baisakhi", 13 or 14 April; Sikhs and Hindus; Sikh new year per Nanakshahi is Chet. Do not add Vaisakhi. extraClue about the Khalsa is not in the fetched text. Unverified. |
| HOLA MOHALLA (024) | "Holi ke agle din" | RF | [S]: "usually a day after Holi, but sometimes coincides". Clue should say "aksar". Anandpur Sahib and Guru Gobind Singh not in fetched text. |
| GOVARDHAN PUJA (025) | "Diwali ke agle din" | RF | [S]: first lunar day of Kartika, "fourth day of Diwali"; Annakut; Krishna lifted the hill. "Next day" is ambiguous with a 5 or 6 day Diwali. |
| DIWALI (002) | extraClue "Ram ji Ayodhya laute the" is one of several narratives | RF | [S]: "variations celebrated in other Indian religions such as Jainism and Sikhism", mid-October to mid-November; the Rama story is not in the summary. Non-universal Hinglish statement. |
| KARVA CHAUTH (012) | "Pati ki lambi umar ke liye vrat" | RF | [S]: Hindu women of Northern and Western India and Nepal, Kartika, fourth day of the waning moon. The husband-only framing is not in the summary; wording flag. Chip "Oct-Nov" OK. |
| KUMBH MELA (030) | Chip "Prayagraj" names one of four sites; no fixed month | OK/RF | [S]: four sites (Prayagraj, Haridwar, Nashik, Ujjain), every 4 or 12 years, about 660 million attended in 2025. Clue and extraClue match. Wording flag: the attendance figure is an official claim (the source reports it as a count, not a measurement), and clues should carry no numbers. Tier flag: this is widely known, so Hard reflects letter burden or clue visibility, not familiarity (see 4.1). |
| THRISSUR POORAM (028) | | OK/RF | [S] Vadakkunnathan Temple, Malayalam month Medam (April-May chip fits). Elephants/parasols not in fetched text. RF: it has the highest `bossScore` in the hard tier (2214), so it is the most likely Hard boss (section 1.5) while its national familiarity is moderate-to-low (agent judgement). |
| NAG PANCHAMI (029) | Chip and scope | OK | [S] fifth day of bright half of Shravana (July/August); some states observe it in the dark half. Milk bath of the serpent image matches. |
| WANGALA (032) | | OK/RF | [F] Garo festival, "Hundred Drums", sun god Misi Saljong, September to December with village-set dates; Garo live in Meghalaya, Nagaland, Assam. Chips fine. The state-sponsored 100 Drums event dates from 1976 [F]. "tribe" wording is a human check. |
| ONAM, RAM NAVAMI, JANMASHTAMI, GANESH CHATURTHI, GURPURAB, THRISSUR | Month chips vs lunar variation | OK | [S] Onam (Mahabali visits), Rama Navami (Chaitra, Mar-Apr), Janmashtami (Shravana or Bhadrapada), Ganesh Chaturthi (ends on the tenth day) all consistent with existing chips and clues. |
| RAKSHA BANDHAN (001) | Chip "August" for a lunar date | RF | [S] confirms sisters tie the rakhi; "Shravan Purnima" and the month were not in the fetched text. A one-month chip on a lunar festival may be wrong in some years. Unverified. |
| CHHATH PUJA (020) | "Bihar ka festival" | RF | [S] Chhath: East India and southern Nepal; Bihar, Jharkhand, eastern UP. Clue is a simplification. Arghya/thekua not fetched. |
| CHRISTMAS (008) | extraClue "Goa aur Kerala mein midnight mass" | RF | [S] confirms December 25. The two-state claim is restrictive and not supported by the fetched text. |
| HOLI (003), BHAI DOOJ (014) | | OK | [S] Holi: Radha-Krishna, victory of Vishnu as Narasimha. Holika dahan in the extraClue is not in the fetched summary. Bhai Dooj: second lunar day of Shukla Paksha of Kartika, during Diwali; the Yama-Yamuna story is not fetched. |

Month chips: lunar-date festivals with a single-month chip are RAKSHA BANDHAN ("August") only; the others use two-month ranges, "After Ramzan", or no month (Kumbh), which is the safe pattern.

**Tier flag from the audit.** Familiarity and letter burden are mixed in the current tiers: KUMBH MELA and NAG PANCHAMI are widely known but sit in Hard, while WANGALA and LOSAR are regional and also Hard. Because medium and hard words share the same strictest visibility on Hard play (nothing shown, at most one clue), the tier separation between them rests on familiarity and letter burden alone. This report does not re-tier existing entries (IDs and meaning are preserved); it is raised for the human reviewer, together with the THRISSUR POORAM boss flag.

## 3. Candidate ledger

See [tyohar-candidates.md](tyohar-candidates.md): the full table with canonical spelling, aliases, scope, sources, familiarity, tier rationale, collision and phone-fit checks, plus all rejected and deferred names.

## 4. Counts, shortfalls and target options

### 4.1 Tiering rules used

**Judge each tier against the strictest visibility it is ever played under** (section 1.1):

| Tier | Played on (current rules) | Also under #31 | Strictest live visibility |
|---|---|---|---|
| Easy | Easy (chips + clue), Medium (clue only) | same | **clue only**, no chips |
| Medium | Medium (clue only), Hard (nothing) | Easy and Medium boss 1; Hard early stage | **nothing shown**, at most one clue per Hard run |
| Hard | Hard (nothing) | Hard; Easy and Medium bosses from club 2 | **nothing shown**, at most one clue per Hard run |

So chips can never carry a word that is not Easy-only, and medium and hard words have the same visibility on Hard play. Consequences:

- Easy: high familiarity, and the clue alone must carry it (Medium play has no chips). Low or moderate letter burden.
- Medium: must be nameable from the blank-tile pattern alone on Hard, so high familiarity is needed. A moderate-familiarity regional word is not a Medium word; it is conditional until a human confirms high familiarity.
- Hard: no more visibility than Medium, so Hard is about letter or spelling burden on a name the audience still knows (high familiarity), or a human-confirmed moderate one. Regional alone is never Hard, and Hard is not a place to park unfamiliar names.

Familiarity ratings (high, moderate, low) are agent judgement for a broad casual Indian audience. **No survey or human check was done.**

### 4.2 Defensible counts

| Tier | Current | B1 adds | After B1 | Conditional adds (human call) | Ceiling | Shortfall vs 25 (B1 / ceiling) |
|---|---|---|---|---|---|---|
| Easy | 15 | 3 | 18 | 0 | 18 | 7 / 7 |
| Medium | 10 | 5 | 15 | 4 (MAHAVIR JAYANTI, EASTER, POHELA BOISHAKH, VISHU) | 19 | 10 / 6 |
| Hard | 7 | 1 | 8 | 9 | 17 | 17 / 8 |
| Total | 32 | 9 | 41 | 13 | 54 | |

### 4.3 Repeat horizon by option (pool sizes in draws; from section 1 arithmetic)

| Option | Easy | Medium | Hard |
|---|---|---|---|
| 0. Current content, current rules | 15 | 25 | 17 |
| 1. Current content, #31 as written | 15, then 25 | 15, 10, then 17 | 10, then **7** |
| 2. B1, current rules | 18 | 33 | 23 |
| 3. B1, #31 as written | 18, then 33 | 18, 15, then 23 | 15, then **8** |
| 4. B1, #31 with Hard 10+ = medium + hard | 18, then 33 | 18, 15, then 23 | 15, then 23 |
| 5. B1, #31 with Hard hard-only from 35+ hits | 18, then 33 | 18, 15, then 23 | 15, then 23, then **8** (from 35) |
| 6. Ceiling content, #31 as written | 18, then 37 | 18, 19, then 36 | 19, then **17** |

Notes:
- Option 3: hard draws start at word 10, so a repeat is guaranteed from the 9th hard draw (**word 18**, before the second club); today (option 1) it is word 17.
- Option 4 reduces #31 on Hard to "hits 0-9 medium only": after that Hard draws exactly what it draws today (medium + hard), so only the Hard warm-up changes.
- Option 5 delays the hard-only stage until three clubs are done. Hard-only draws then number D - 35 (20 by word 55, 45 by word 80), so the first repeat in that stage is the 9th hard-only draw (word 44); where Hard bosses come from before then is for #31 to specify.
- Under options 1, 3, 5 and 6 the hard tier supplies bosses for all three difficulties from club 2, so a small hard tier also limits boss variety on Easy and Medium.
- Hard-only draws reach 26 by word 35 in option 3, so even 25 hard words would not stop a repeat by the third club; 25 per tier would still not cover long runs.

### 4.4 Recommendation

1. Treat 25 per tier as unattainable on familiar supply; do not add words to chase it.
2. Bring batch B1 (9 entries, ledger section A) to a culturally informed human reviewer. Integrate only those approved. Conditional names (ledger section B) enter a later batch only after a human confirms high familiarity.
3. Be clear that content barely moves the hard-only case: B1 changes late-Hard from 7 to 8. The owner chooses between a smaller reviewed pool and a #31 change; the choices are the options above:
   - Accept #31 as written with B1 (option 3): late-Hard horizon 8, a repeat before the second club for runs past about word 18, and hard bosses for all difficulties drawn from 8 words.
   - Ask #31 to keep Hard 10+ drawing medium + hard (option 4): horizon 23, but "after 10 hits they're hard" no longer holds and #31 on Hard shrinks to a medium-only warm-up.
   - Or delay the hard-only stage to 35+ hits (option 5): horizon 23 until word 35, then 8.
   Agent view only: because even the ceiling gives 17 hard words and those include regional names whose familiarity is unconfirmed, option 4 or 5 is the safer fit for repeat protection. This is a progression decision for #31 and the owner, not made here.
4. Boss concentration (section 1.5): until `BOSS_CANDIDATES` or `bossScore` is reconsidered in a separate issue, make the top-3 candidates of each boss pool recognisable. A human must confirm high familiarity for each word that ranks in the top 3 of its boss pool (including existing THRISSUR POORAM).
5. Do not change #31 or BRIEF in the integration child.

### 4.5 Exact integration targets (for a future child, after human review)

Edit only `src/data/words/tyohar.json`; append new IDs in this order, keep `tyohar-001` to `032` unchanged, `status: "draft"`, ids unused elsewhere. Spellings marked "pending" are a human call.

| New ID | Canonical answer | Tier | Spelling note |
|---|---|---|---|
| tyohar-033 | DHANTERAS | easy | |
| tyohar-034 | MAHA SHIVRATRI | easy | pending: SHIVRATRI vs SHIVARATRI (MAHA SHIVARATRI also passes phone-fit); a one-word MAHASHIVRATRI fails the 11-letter rule (13 letters) |
| tyohar-035 | BAKRID | easy | use "Eid ul Adha" consistently with EID UL FITR |
| tyohar-036 | BASANT PANCHAMI | medium | |
| tyohar-037 | RATH YATRA | medium | |
| tyohar-038 | HANUMAN JAYANTI | medium | |
| tyohar-039 | BUDDHA PURNIMA | medium | |
| tyohar-040 | GURU PURNIMA | medium | |
| tyohar-041 | AKSHAY TRITIYA | hard | pending: AKSHAY (likelier fan spelling) vs AKSHAYA (also passes phone-fit) |

Acceptance for that child:
- Each entry has two chips (each at most 20 characters), a `clue` and `extraClue` of 6 to 90 characters, with **no answer word of 4 or more letters** in the clue, extraClue or chips. This matters here: MAHA, GURU, RATH, YATRA, HANUMAN, BUDDHA, JAYANTI, PURNIMA, BASANT, PANCHAMI, AKSHAY (or AKSHAYA) and TRITIYA cannot appear, so deity or person names that are part of the answer need other wording. A human must approve it; near-synonyms (for example Bajrangbali for Hanuman) risk becoming hints.
- Easy clues must work with the clue alone (Medium play shows no chips); Medium and Hard entries must still be nameable from the blank pattern when nothing is shown. Chips are a bonus only on Easy.
- No single-month chip on lunar or region-varying dates: BAKRID (lunar) and HANUMAN JAYANTI (varies by region).
- **Boss criterion.** Given a Hard boss draw, when the top-3 candidates are ranked by `bossScore`, then the human reviewer has confirmed high familiarity for each of the three (hard tier today: THRISSUR POORAM, NAG PANCHAMI, KUMBH MELA; after B1 with AKSHAY TRITIYA: THRISSUR POORAM, AKSHAY TRITIYA, NAG PANCHAMI). The same check applies to the medium-tier top 3 for Medium bosses (after B1: GOVARDHAN PUJA, BASANT PANCHAMI, BUDDHA PURNIMA).
- Minimum viable: integrate only approved entries, no replacement from the conditional list without a new familiarity decision.
- Re-run the exact-answer collision check against all five banks (sibling issues #34/#35 may add words), and `npm run words:check`.
- Report total / approved / playable counts separately (all draft stay playable while `INCLUDE_DRAFT_WORDS` is true; the parent says draft inclusion does not quarantine new entries, so human review comes **before** integration).
- Expected size: 1 to 2 counted files. No test edits needed (the bank tests are data-driven; the only count assertion is "at least 28 per category").

## 5. Validation and sign-off

### 5.1 Agent research (done)

- Existing-bank checks: `npm run words:check` (schema, phone-fit, giveaway, uniqueness) passes on the unchanged bank: 483 tests.
- Candidate checks (scratch script using the real `layoutTiles` and `answerProblem` with the test thresholds: parts at most 11 letters, width 366, 3 lines, tile size at least 28): all screened candidate answers pass, with the exception of the one-word spelling MAHASHIVRATRI, which fails. Exact-answer collisions with all five banks: none.
- Pool and boss arithmetic and the scratch simulation (sections 1 and 4).
- Source reading from Wikipedia only.

### 5.2 Human sign-off (pending: no human reviewer yet)

Not done and not claimed:
- Factual accuracy of every clue claim, every candidate's scope and calendar, and every VC/RF item in section 2.
- Cultural and respectful wording (Hinglish, "tribes", Karva Chauth framing, Muharram scope, Eid spelling). Specific reviewer notes:
  - BAKRID: plain, non-flippant clues about the sacrifice; use "Eid ul Adha" consistently with EID UL FITR.
  - GURU PURNIMA: not Hindu-only ([S] names Hindus, Sikhs and Buddhists; Jain observance is unverified).
  - KUMBH MELA: the attendance figure is an official claim; clues should carry no numbers.
  - GURPURAB: record "Guru Nanak Jayanti" as an alias and decide the answer's scope.
  - HANUMAN JAYANTI and BUDDHA PURNIMA: other names or epithets in clues need approval.
- Familiarity ratings (a human, ideally category-familiar casual players, must confirm the high/moderate/low calls, and in particular each boss top-3 word).
- The choice between pool and #31 alternatives (owner).
- Final canonical spellings (AKSHAY vs AKSHAYA, SHIVRATRI vs SHIVARATRI).

### 5.3 Sources actually fetched (2026-11-04, via the proxy)

All are Wikipedia: REST summary endpoint (`/api/rest_v1/page/summary/<Title>`) unless marked (F) for the MediaWiki plain-text extract. Titles as requested (landing title in brackets when it redirected): Dussehra [Vijayadashami], Vijayadashami, Makar_Sankranti, Uttarayan [Uttarayana], Pongal (disambiguation), Pongal_(festival) (F), Lohri, Lohri (F), Bihu, Bihu (F), Magh_Bihu, Bohag_Bihu, Teej, Navaratri, Losar, Losar (F), Hornbill_Festival, Eid_al-Fitr, Karva_Chauth, Ugadi, Gudi_Padwa (F), Baisakhi/Vaisakhi, Hola_Mohalla, Govardhan_Puja, Bhai_Dooj, Wangala, Wangala (F), Thrissur_Pooram, Nag_Panchami, Kumbh_Mela, Chhath, Raksha_Bandhan, Onam, Janmashtami, Ram_Navami, Durga_Puja, Holi, Diwali, Ganesh_Chaturthi, Christmas, Sankranti, Bhogi, Gurpurab, Guru_Nanak_Gurpurab (summary and F), Dhanteras, Maha_Shivaratri, Vasant_Panchami [also Saraswati_Puja], Rath_Yatra, Vishu, Pohela_Boishakh, Maha_Vishuva_Sankranti, Eid_al-Adha, Easter, Good_Friday, Buddha_Purnima, Mahavir_Jayanti, Hanuman_Jayanti, Guru_Purnima, Akshaya_Tritiya, Pushkar_Camel_Fair, Nowruz, Thaipusam, Bathukamma, Nuakhai, Karthigai_Deepam, Tulsi_Vivah, Dev_Deepawali [Kartika Purnima], Vat_Purnima, Vat_Savitri, Muharram, Ashura, Mawlid, Gangaur, Gangasagar_Mela, Paryushana, Lakshmi_Puja, Anant_Chaturdashi, Sarhul, Hemis_Monastery, Amavasya. Also read: the issue bodies and comments for #65, #36, #31, #33, and the repo files named above.

**Unverified: not fetched** (use "unverified" in any follow-up): full text of Navaratri, Teej, Hornbill_Festival, Eid_al-Fitr, Makar_Sankranti, Karva_Chauth, Kumbh_Mela and every page other than the five (F) extracts above; Puthandu, Kali_Puja, Naraka_Chaturdashi, Mysore_Dasara, Kullu_Dussehra (requests rate-limited, never succeeded); any non-Wikipedia source (government calendars, Sikh/Jain/Buddhist/Parsi/Islamic bodies, news, dictionaries); all dates other than the ones quoted above; all clue content marked "not in the fetched text" in section 2; transliteration/usage statements marked agent knowledge. The summary endpoint returns only the lead paragraph, so absence from a summary is not evidence of falsity.
