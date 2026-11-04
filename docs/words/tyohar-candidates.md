# Tyohar candidate ledger (issue #65, parent #36)

Companion to [tyohar-feasibility.md](tyohar-feasibility.md). Candidates are **outside the playable banks**; nothing here is in `tyohar.json`. Agent research only, no human review yet. Source key: [S] Wikipedia REST summary, [F] MediaWiki plain-text extract (both fetched 2026-11-04). Familiarity (H high, M moderate, L low) is agent judgement for a broad casual Indian audience with no survey; letter burden (low, mid, high) is judged separately from familiarity.

Checks applied to every candidate answer with a scratch script (real `layoutTiles` and `answerProblem`, thresholds from `wordBank.test.ts`: longest part at most 11 letters, width 366, 3 lines, tile size at least 28): all pass, except the one-word spelling MAHASHIVRATRI (13 letters), which fails the 11-letter rule. No exact answer match in any of the five banks (so no Masala Mix exact collision). "Banned clue tokens" are answer words of 4 or more letters, which the giveaway test forbids in clue, extraClue and chips.

Tier logic: each tier is judged against the **strictest visibility it is played under** (feasibility report section 4.1). Easy words are also played on Medium, which shows the clue only (no chips); medium and hard words are played on Hard, which shows nothing at the start and allows at most one clue per run (the extra-clue power-up, slot index 1, starts at 1 and boss rewards restock only slot index 0). Under proposed #31, hard words also become Easy and Medium bosses. So chips are only a bonus on Easy play and must never be relied on to carry a word, and Medium and Hard have the same live visibility; the difference is familiarity and letter burden. Moderate-familiarity regional names are conditional until a human confirms high familiarity. "Widely observed" below is agent judgement, unverified, unless a source is cited.

## A. Recommended batch B1 (9)

| # | Canonical (alias, not to be added) | Scope: region, calendar, season | Source | Fam. | Letter burden | Tier and rationale (strictest visibility) | Duplicate and collision notes | Banned clue tokens | Uncertainties |
|---|---|---|---|---|---|---|---|---|---|
| 1 | DHANTERAS (Dhanatrayodashi; Tihar day one in Nepal) | First day of Diwali or Tihar "in most of India and Nepal" [S]; Oct-Nov | [S] Dhanteras | H | low (one 9-letter word) | Easy: high familiarity; on Medium play the clue alone must carry it | A day inside Diwali, like existing BHAI DOOJ (easy) and GOVARDHAN PUJA (medium); distinct named observance. Adds a fourth entry to the Diwali window. | DHANTERAS | What the observance involves is not in the fetched text; human to author clues. |
| 2 | MAHA SHIVRATRI (Mahashivratri, Shivaratri) | Hindu festival, widely observed (agent judgement, unverified); Feb-Mar, lunar, Magha or Phalguna by region, same night [S] | [S] Maha Shivaratri | H | mid (9-letter second word; spelling varies) | Easy: high familiarity; the clue alone carries it, and the 4 + 9 word-break pattern helps | No collision. Spelling pending: SHIVRATRI vs SHIVARATRI (MAHA SHIVARATRI passes phone-fit). A one-word MAHASHIVRATRI fails the 11-letter rule. | MAHA, SHIVRATRI ("Shiv" alone is allowed) | Canonical spelling; Hinglish usage is agent knowledge. |
| 3 | BAKRID (Eid ul Adha, Bakra Eid) | Muslim festival, 10 Dhu al-Hijja, lunar, no fixed month [S]; widely observed in India (agent judgement, unverified) | [S] Eid al-Adha: "second of the two main festivals in Islam" | H | low (6 letters) | Easy: high familiarity; short word; clue alone carries it | Distinct from EID UL FITR. Keep the transliteration consistent: "Eid ul Adha" if EID UL FITR stays. No exact collision. No fixed-month chip. | BAKRID | "Bakrid" as the common Indian name is agent knowledge. Plain, non-flippant wording about the sacrifice needs human review. |
| 4 | BASANT PANCHAMI (Vasant Panchami; same observance as Saraswati Puja) | Hindu festival, Magha shukla panchami, Jan-Feb [S]; breadth of observance unverified | [S] Vasant Panchami: "also rendered Basant Panchami and Saraswati Puja" | H | mid | Medium: nameable from the 6 + 8 blank pattern with nothing shown; high familiarity | Saraswati Puja is the same observance per [S]: not a second answer. No collision. Also becomes a medium-tier boss magnet (bossScore 1214). | BASANT, PANCHAMI | Bengal's Saraswati Puja customs vs north Indian ones: human. |
| 5 | RATH YATRA (Ratha Yatra, Jagannath Rath Yatra) | Puri, Odisha, plus other cities [S]; Ashadha, June-July (agent knowledge, unverified) | [S] Ratha Yatra: Puri procession of Jagannath, Balabhadra, Subhadra; the term also means any chariot procession | H | low (4 + 5, 5 distinct letters) | Medium: high familiarity; short pattern is guessable with nothing shown | No Puri or Jagannath entry in Safar; if Safar later adds PURI there is a conceptual overlap. | RATH, YATRA | The month is not in the fetched summary; the "any chariot procession" ambiguity needs a Puri-specific clue. |
| 6 | HANUMAN JAYANTI (Hanuman Janmotsava) | Hindu festival, birth of Hanuman [S]; date varies by region (agent knowledge, unverified), commonly Mar-Apr | [S] Hanuman Jayanti | H | low | Medium: the rationale is a **clue constraint**, not familiarity. The clue cannot say HANUMAN, and near-synonyms (for example Bajrangbali) risk being hints, so Easy (which depends on a clue-only carry on Medium) is not safe. High familiarity makes it nameable with nothing shown. No single-month chip (date varies). | No collision | HANUMAN, JAYANTI | Date variance (not fetched); approved alternate names. |
| 7 | BUDDHA PURNIMA (Buddha Jayanti, Vesak) | Primarily Buddhist, South, Southeast and East Asia [S]; Indian public-holiday status and the Vaisakha full-moon date (Apr-May) are agent knowledge, unverified | [S] Buddha's Birthday: birth of Siddhartha Gautama | M-H | low (two common words) | Medium, with a flag: nameable on Hard only if familiarity is truly high; if the reviewer rates it moderate it moves to conditional. | No collision. The fetched page is the generic Asia page, not the Indian "Purnima" name. Medium-tier boss magnet (1213). | BUDDHA, PURNIMA | Indian-name usage and date: unverified. |
| 8 | GURU PURNIMA (Vyasa Purnima) | Celebrated "in India, Nepal and Bhutan by Hindus, Sikhs and Buddhists" [S]: not Hindu-only; Ashadha full moon, June-July [S] | [S] Guru Purnima | M-H | low (two common words) | Medium, with the same flag as BUDDHA PURNIMA; "guru" cannot appear in the clue | Overlaps in meaning with GURPURAB (a Sikh Guru birth anniversary); distinct festival; whether both can sit in one pool is a human call. | GURU, PURNIMA | Teacher's day association and Jain observance not fetched. |
| 9 | AKSHAY TRITIYA (Akshaya Tritiya, Akha Teej, Akha Tija) | Hindu and Jain spring festival, third tithi of bright half of Vaisakha, Apr-May [S] | [S] Akshaya Tritiya: "Akśaya Tṛtīyā, also known as Ākhā Tīja" | H | high (two long words; spelling varies) | Hard: high familiarity, high letter burden (13 letters, 8 distinct, spelling variants), no clue shown | Related to TEEJ in name only ("Akha Teej" is the same day); keep TEEJ separate. Enters the hard-tier top-3 for bosses (2173; AKSHAYA 2174). | AKSHAY (or AKSHAYA), TRITIYA | Spelling: AKSHAY is the likelier fan spelling, pending a human call (AKSHAYA passes phone-fit too). Gold-buying custom not fetched. |

Counts: B1 = Easy 3 (#1-3), Medium 5 (#4-8), Hard 1 (#9).

## B. Conditional (13): plausible but need a human call, in most cases a confirmation of high familiarity

| Canonical | Proposed tier | Source | Reason for the hold |
|---|---|---|---|
| VISHU | Medium | [S] Kerala and Mahe, first of Medam, mid-April solar new year | Moved out of B1: moderate regional familiarity; a 5-letter, 5-distinct-letter word with nothing shown (Hard play) is not reliably nameable by a non-Malayali. Medium only if a human confirms high familiarity; otherwise reject. Part of the spring window. |
| THAIPUSAM | Hard | [S] Tamil Hindu, Thai month full moon with Pusam star, Murugan's victory | Moved out of B1: moderate familiarity; needs human confirmation of high familiarity before it can be a Hard word. |
| KARTHIGAI DEEPAM | Hard | [S] Karthika Deepam, festival of lights, Nov-Dec, differs from Kartika Purnima by a day | Moved out of B1: moderate familiarity plus spelling variants (Karthigai/Karthika); thematically near DIWALI; Kartik Purnima window. |
| PUSHKAR MELA | Hard | [S] Pushkar Fair, Rajasthan, ends on Kartik Purnima, 200,000 visitors | Moved out of B1: tourist rather than religious familiarity; fair or festival scope; Kartik Purnima window; Safar overlap risk if PUSHKAR is added there; banned tokens PUSHKAR, MELA. |
| MAHAVIR JAYANTI | Medium | [S] Mahavira Janma Kalyanaka, Jain, March or April | Familiarity moderate outside Jain communities; banned tokens MAHAVIR, JAYANTI |
| EASTER | Medium | [S] Easter | Familiarity moderate; Christian minority in India; wording for faith |
| POHELA BOISHAKH | Medium | [S] Bengali new year, 14 April, or 15 in West Bengal, Tripura, Jharkhand, Assam | Spelling variants (Poila Baisakh); spring window |
| PUTHANDU | Hard | not fetched (summary failed, rate-limited) | Unverified: not fetched; Tamil new year |
| NAVROZ | Hard | [S] Nowruz: spring equinox 19-22 March | Parsi Navroz and Nowruz are different spellings and communities; Indian usage unfetched |
| BATHUKAMMA | Hard | [S] Telangana/AP women, nine days, corresponds to Sharad Navratri and Durga Puja | Moderate familiarity outside Telangana; overlaps the Navratri window |
| NUAKHAI | Hard | [S] Western Odisha, Bhadrapada, the day after Ganesh Chaturthi | Low outside Odisha and Chhattisgarh |
| GANGAUR | Hard | [S] Rajasthan, Haryana, MP, UP, Gujarat and West Bengal | Moderate; Chaitra Gaur variant needs scoping |
| TULSI VIVAH | Hard | [S] Tulasi Vivaha, end of the monsoon, start of wedding season | Moderate; observance is a ritual, not a festival to many players |

Ceiling counts if all pass: Easy 18, Medium 19 (B1 5 + VISHU, MAHAVIR JAYANTI, EASTER, POHELA BOISHAKH = 4 more, on top of the current 10), Hard 17 (current 7 + AKSHAY TRITIYA + 9 conditional).

## C. Deferred (scope or sensitivity: owner or human decision, not familiarity)

| Name | Reason |
|---|---|
| GOOD FRIDAY | [S] "solemn Christian holy day commemorating the crucifixion"; a guessing-game clue is a respect question. |
| MUHARRAM / ASHURA | [S] Muharram is a month; Ashura is "a day of mourning" for Shia Muslims; not a celebratory festival. |
| MILAD UN NABI / MAWLID | [S] Mawlid, 12 Rabi I, birthday of the Prophet; sensitivity and usage in India unfetched. |
| INDEPENDENCE DAY, REPUBLIC DAY, GANDHI JAYANTI | National days, not festivals; scope decision for the owner (BRIEF describes the category as festivals). Not fetched beyond a title. |

## D. Rejected

| Name | Reason |
|---|---|
| VIJAYADASHAMI, DASARA | Alias of DUSSEHRA [S]. |
| UTTARAYAN, SANKRANTI | Alias of MAKAR SANKRANTI [S]; Uttarayana page is the astronomical term. |
| THAI PONGAL | Alias of PONGAL [F]. |
| BHOGI | Day one of Sankranti [S]; part of PONGAL/Sankranti. |
| VAISAKHI | Alias of BAISAKHI [S]. |
| SARASWATI PUJA | Same observance as BASANT PANCHAMI [S]. |
| MAGH BIHU, BOHAG BIHU, KATI BIHU | Sub-festivals of BIHU [F]; do not split until BIHU scope is decided. |
| LAKSHMI PUJA | Main day of Diwali [S] (amavasya, third day). |
| DEV DIWALI | Kartika Purnima / Dev Deepawali [S]; same date as GURPURAB and PUSHKAR; answer words "DIWALI" banned from clues. |
| ANANT CHATURDASHI | A Vishnu observance on the 14th day of waxing Bhadrapada [S]; its link to Ganesh immersion is agent knowledge, unverified; sub-day of the Ganesh window; phone-fit: longest word 11 letters, tile size 28 (borderline). |
| KALI PUJA, CHHOTI DIWALI / NARAK CHATURDASHI, MYSORE DASARA, KULLU DUSSEHRA | Diwali-day or Dussehra-regional forms. Not fetched: unverified. Rejected as sub-observances of existing entries; reconsider with a source. |
| VAT SAVITRI | [S] Vata Purnima, observed by married women in several regions; low familiarity for a broad audience, and husband-framing needs respect review. |
| GANGASAGAR MELA | [S] held on Makar Sankranti at Gangasagar; low national familiarity, part of the Sankranti window. |
| PARYUSHAN | [S] major Jain observance, Aug-Oct; low familiarity beyond Jain communities. |
| SARHUL, HEMIS FESTIVAL | [S] Jharkhand tribal spring festival; Hemis festival in Ladakh. Low familiarity for the broad audience. |
| RAMZAN | A month of fasting, not a festival; already referenced in EID UL FITR's chip. |
| HOLIKA DAHAN, RANG PANCHAMI, DHULANDI | Parts or aliases of HOLI. Not fetched: unverified. |

Notes: "reject" means not proposed now; a human reviewer may reopen any with a source.

## E. Totals

Names screened about 70; B1 9; conditional 13; deferred 4 groups; rejected about 24. Familiar distinct supply is limited: the shortfall against 25 per tier is expected, not a failure.
