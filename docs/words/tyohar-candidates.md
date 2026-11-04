# Tyohar candidate ledger (issue #65, parent #36)

Companion to [tyohar-feasibility.md](tyohar-feasibility.md). Candidates are **outside the playable banks**; nothing here is in `tyohar.json`. Agent research only, no human review yet. Source key: [S] Wikipedia REST summary, [F] MediaWiki plain-text extract (both fetched 2026-11-04). Familiarity (H high, M moderate, L low) is agent judgement for a broad casual Indian audience with no survey; letter burden (low, mid, high) is judged separately from familiarity.

Checks applied to every candidate answer with a scratch script (real `layoutTiles` and `answerProblem`, thresholds from `wordBank.test.ts`: longest part at most 11 letters, width 366, 3 lines, tile size at least 28): all pass. No exact answer match in any of the five banks (so no Masala Mix exact collision). "Banned clue tokens" are answer words of 4 or more letters, which the giveaway test forbids in clue, extraClue and chips.

Tier logic under the real clue visibility: Easy shows 2 chips and the clue; Medium the clue only; Hard nothing until the reveal power-up.

## A. Recommended batch B1 (13)

| # | Canonical (alias, not to be added) | Scope: region, calendar, season | Source | Fam. | Letter burden | Tier and rationale | Duplicate and collision notes | Banned clue tokens | Uncertainties |
|---|---|---|---|---|---|---|---|---|---|
| 1 | DHANTERAS (Dhanatrayodashi; Tihar day one in Nepal) | Pan-Indian, first day of Diwali, Oct-Nov | [S] Dhanteras: "first day that marks the festival of Diwali or Tihar" | H | low | Easy: chips plus a trade or buying clue carry it | A day inside Diwali, like existing BHAI DOOJ (easy) and GOVARDHAN PUJA (medium); distinct named observance. Adds a fourth entry to the Diwali window. | DHANTERAS | What the observance involves is not in the fetched text; human to author clues. |
| 2 | MAHA SHIVRATRI (Mahashivratri, Shivaratri) | Pan-Hindu, Feb-Mar, lunar (Magha or Phalguna by region, same night) | [S] Maha Shivaratri: Feb-Mar, caturdashi of krishnapaksha, "same lunar night across the regions" | H | mid (9-letter second word, spelling varies) | Easy: very familiar, clue plus month chip | No collision. Spelling "SHIVRATRI" vs "SHIVARATRI" is a human call; Hinglish usage "Maha Shivratri" is agent knowledge. | MAHA, SHIVRATRI ("Shiv" alone is allowed) | Canonical spelling. |
| 3 | BAKRID (Eid ul Adha, Bakra Eid) | Muslim, 10 Dhu al-Hijja, lunar, no fixed month | [S] Eid al-Adha: "second of the two main festivals in Islam"; tenth of Dhu'l-Hijja | H | low | Easy: familiar nationally | Distinct from EID UL FITR (a different festival); keep the two spelling conventions consistent: if EID UL FITR stays, the alias would be EID UL ADHA. No exact collision. Chip must avoid a fixed month. | BAKRID | "Bakrid" as the common Indian name is agent knowledge. Respectful wording about the sacrifice needs human review. |
| 4 | BASANT PANCHAMI (Vasant Panchami; same observance as Saraswati Puja) | Pan-Indian, Magha shukla panchami, Jan-Feb | [S] Vasant Panchami: "also rendered Basant Panchami and Saraswati Puja", Jan-Feb | H | mid | Medium: clue (yellow, spring, Saraswati) is needed | Saraswati Puja is the same observance per [S]: not a second answer. No collision. | BASANT, PANCHAMI | Bengal's Saraswati Puja customs vs north Indian ones: human. |
| 5 | RATH YATRA (Ratha Yatra, Jagannath Rath Yatra) | Puri, Odisha, plus other cities; Ashadha, June-July | [S] Ratha Yatra: Puri procession of Jagannath, Balabhadra, Subhadra; the term also means any chariot procession | H | low | Medium: clue (chariots, Puri) needed | No Puri or Jagannath entry in Safar; if Safar later adds PURI there is a conceptual overlap. | RATH, YATRA | The month was not in the fetched summary; the "any chariot procession" ambiguity needs a Puri-specific clue. |
| 6 | HANUMAN JAYANTI (Hanuman Janmotsava) | Pan-Hindu; date differs by region; Mar-Apr in most places | [S] Hanuman Jayanti: birth of Hanuman "also called Hanuman Janmotsava" | H | low | Medium, not Easy: the clue cannot say "Hanuman" (banned token), so it must use other names | No collision | HANUMAN, JAYANTI | Dates vary across regions (not fetched); respectful alternate names. |
| 7 | BUDDHA PURNIMA (Buddha Jayanti, Vesak) | Buddhist and pan-Indian public holiday; Vaisakha full moon, Apr-May | [S] Buddha's Birthday: primarily Buddhist, South, Southeast and East Asia; birth of Siddhartha Gautama | M-H | low | Medium: clue only | No collision. The fetched page is generic Asia, not the Indian "Purnima" name; Indian date and observance not fetched. | BUDDHA, PURNIMA | Indian-name usage and date: unverified. |
| 8 | GURU PURNIMA (Vyasa Purnima) | Hindu, Buddhist, Sikh; Ashadha full moon, June-July | [S] Guru Purnima: respect for spiritual and academic gurus, Ashadha, June-July, "also Vyasa Purnima" | M-H | low | Medium: clue only; "guru" cannot appear in the clue | Overlaps in meaning with GURPURAB (a Sikh Guru birth anniversary); distinct festival, but both contain "guru"; keep apart in the same run is a human call. | GURU, PURNIMA | Teacher's day association not fetched. |
| 9 | VISHU (Vishu) | Kerala and Mahe; first of Medam, solar new year, mid-April | [S] Vishu: first of Medam, solar new year in Malabar | M | low | Medium: clue (Kerala, new year) carries it; regional but short | Part of the mid-April new-year window with BAISAKHI, BIHU, GUDI PADWA, UGADI; distinct. | VISHU | Customs (kani, kaineettam) not fetched. |
| 10 | AKSHAYA TRITIYA (Akha Teej) | Hindu and Jain, Vaisakha shukla tritiya, Apr-May | [S] Akshaya Tritiya: "also known as Akha Tija", Jaina and Hindu spring festival | H | high (two long words, spelling varies: Akshay, Akshaya) | Hard: familiar, but long and spelling-heavy with no clue | Related to TEEJ in name only ("Akha Teej" alias is the same day); keep TEEJ separate. | AKSHAYA, TRITIYA | Spelling and gold-buying custom not fetched. |
| 11 | THAIPUSAM (Thaipoosam) | Tamil Hindu, Thai month full moon with Pusam star, Jan-Feb | [S] Thaipusam: Tamil Hindu, victory of Murugan over Surapadman | M | mid | Hard: moderate familiarity, no clue; not purely regional | In the Thai month like PONGAL but a different observance. | THAIPUSAM | National familiarity is the weak point; human check. |
| 12 | KARTHIGAI DEEPAM (Karthika Deepam, Thrikarthika) | Tamils and Malayalis, Karthigai month full moon with Krittika, Nov-Dec | [S] Karthika Deepam: festival of lights, "falls in November or December", differs from Kartika Purnima by a day | M | mid-high (spelling varies) | Hard: moderate familiarity plus spelling variants | Thematically near DIWALI (lights) but a distinct festival; Wikipedia ties it to Kartika Purnima and DEV DEEPAWALI. | KARTHIGAI, DEEPAM | Spelling Karthigai vs Karthika. |
| 13 | PUSHKAR MELA (Pushkar Fair, Kartik Mela, Pushkar Camel Fair) | Pushkar, Rajasthan; begins Kartik, ends Kartik Purnima, Oct-Nov | [S] Pushkar Fair: camel, horse, cattle trading fair, 200,000 visitors | M | mid | Hard: moderate familiarity, no clue. A fair, like existing KUMBH MELA. | If Safar adds PUSHKAR later there is a conceptual overlap. | PUSHKAR, MELA | Fair or festival scope; tourist rather than religious familiarity. |

Counts: B1 = Easy 3 (#1-3), Medium 6 (#4-9), Hard 4 (#10-13).

## B. Conditional (9): plausible but need a human familiarity or scope call

| Canonical | Proposed tier | Source | Reason for the hold |
|---|---|---|---|
| MAHAVIR JAYANTI | Medium | [S] Mahavira Janma Kalyanaka, Jain, March or April | Familiarity moderate outside Jain communities; banned tokens MAHAVIR, JAYANTI |
| EASTER | Medium | [S] Easter | Familiarity moderate; Christian minority in India; wording for faith |
| POHELA BOISHAKH | Medium | [S] Bengali new year, 14 April, or 15 in West Bengal, Tripura, Jharkhand, Assam | Spelling variants (Poila Baisakh); mid-April cluster |
| PUTHANDU | Hard | not fetched (summary failed, rate-limited) | Unverified: not fetched; Tamil new year |
| NAVROZ | Hard | [S] Nowruz: spring equinox 19-22 March | Parsi Navroz and Nowruz are different spellings and communities; Indian usage unfetched |
| BATHUKAMMA | Hard | [S] Telangana/AP women, nine days, corresponds to Sharad Navratri and Durga Puja | Moderate familiarity outside Telangana; overlaps the Navratri window |
| NUAKHAI | Hard | [S] Western Odisha, Bhadrapada, the day after Ganesh Chaturthi | Low outside Odisha and Chhattisgarh |
| GANGAUR | Hard | [S] Rajasthan, Haryana, MP, UP, Gujarat and West Bengal | Moderate; Chaitra Gaur variant needs scoping |
| TULSI VIVAH | Hard | [S] Tulasi Vivaha, end of the monsoon, start of wedding season | Moderate; observance is a ritual, not a festival to many players |

Ceiling counts if all pass: Easy 18, Medium 19, Hard 17.

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

Names screened about 70; B1 13; conditional 9; deferred 4 groups; rejected about 24. Familiar distinct supply is limited: the shortfall against 25 per tier is expected, not a failure.
