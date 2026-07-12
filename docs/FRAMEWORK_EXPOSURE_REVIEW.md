# Framework Mapping-Identifier Exposure Review (Catalog Roadmap Stage 6)

- **Date:** 2026-07-11
- **Status:** **Decided 2026-07-11 (Peter): expose everything except the 4 CAUTION and 1 NON-PUBLIC keeps.** 178 frameworks flipped to `public` (including SWIFT and MPA, accepted without the manual terms check); COBIT, CR-CMM, SACS-002, ISMAP, and Shared Assessments SIG remain `non-public`. Applied to `data/framework-manifest.overrides.json` the same day.
- **Scope:** All 183 `visibility: preview` frameworks in `data/framework-manifest.json` (SCF 2026.2)
- **Question under review:** For each framework, may Graphletter **publicly display the SCF crosswalk's mapping identifiers** (e.g., `ECC 2-1-1`, `SR 1.1`, `B-13 §3.1.2`) next to SCF controls?
- **Decision artifact:** approving a disposition here means flipping `exposureStatus` in `data/framework-manifest.overrides.json` (see §7 Mechanics). Exposure is **not** visibility promotion — a framework can be exposure-cleared and remain `preview` (roadmap principle 4).

## Verdict summary

| Disposition                                | Count | What it means                                                                                                                                  |
| ------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **EXPOSE** (recommended)                   | 176   | Clear to flip `exposureStatus: public`; attribution obligations noted in §5.2                                                                  |
| **EXPOSE — pending 1-minute manual check** | 2     | SWIFT CSCF, MPA CSBP: recommendation is EXPOSE but publisher terms were bot-walled; one browser visit each closes them                         |
| **CAUTION** (your call)                    | 4     | ISACA COBIT, CR-CMM, Saudi Aramco SACS-002, Japan ISMAP: legally defensible, real publisher-relations residual; options given per item in §5.4 |
| **NON-PUBLIC** (recommended keep)          | 1     | Shared Assessments SIG: the identifier scheme _is_ the paid product                                                                            |
| Total                                      | 183   |                                                                                                                                                |

The Stage 7 first cohort (FedRAMP ×4, GovRAMP ×6, NIST profiles ×5) is **fully cleared** — all fifteen fall in the EXPOSE group with no conditions beyond standard attribution.

## 1. Decision frame

**What is exposed.** Only the SCF crosswalk's mapping identifiers — the framework-side control/requirement/section designators the SCF prints in its own freely downloadable workbook. Graphletter never reproduces source-framework text (control descriptions, guidance prose, questionnaire content).

**Legal baseline.** The SCF 2026.2 workbook is licensed CC BY-ND 4.0 and vendored verbatim (`data/LICENSE_AUDIT.json`, verdict `clean`). Displaying its mapping columns with attribution is redistribution of the SCF's own published work. Independently, bare identifiers are facts/short designators — below the copyright threshold in essentially every jurisdiction reviewed.

**Precedent.** The 66 `supported` frameworks already expose identifiers for the most restrictive publishers in the catalog: ISO (10 frameworks), PCI SSC (10), AICPA (SOC 2 TSC), CIS (4), CSA, COSO. "Publisher sells the standard" is therefore settled as non-disqualifying. This review hunts for what _differs_ from that precedent:

1. identifier schemes that are only available behind member/paid walls (the identifiers themselves aren't public);
2. publisher terms that explicitly restrict citing/mapping/crosswalk products (not merely text reproduction);
3. trademark/certification-mark regimes restricting commercial reference;
4. known enforcement against mapping/crosswalk products.

**Default.** Per roadmap principle: ambiguous stays `non-public`. Every recommendation below is evidence-backed; unverified points are flagged inline rather than assumed away.

## 2. Review method

- 114 frameworks resolved deterministically (90 laws/regulations, 24 government publications) — publisher class settles the question; no per-item research needed.
- 69 frameworks across 35 publisher families researched individually (4 parallel research passes, 2026-07-11): source URLs fetched, publisher terms/licence pages read, in-document notices extracted from downloaded PDFs where reachable. Primary-evidence documents read firsthand include: NERC CIP-004-7, FBI CJIS v6.0, CERT-RMM v1.2, DOE C2M2 v2.1, NAIC MDL-668, BSI C5:2020, ENX ISA 6 workbook, NCA ECC/CSCC, UAE NIAF + TDRA IA Regulation v1.1, INCD CMO v1.0/v2.0, MAS TRM, Australia IoT Code of Practice.
- One caution was resolved locally: the Spain CCN-STIC 825 mapping column (col 231 of `data/controls.csv`) was sampled and contains only statutory ENS measure IDs (`org.1`, `op.exp.1`, `mp.si.3`, …) from Royal Decree 311/2022 — copyright-exempt statutory content (Art. 13 TRLPI), not guide-specific numbering.
- Verification gaps are stated per item (§5); none were silently upgraded to EXPOSE.

## 3. Group A — Laws and regulations (90) → EXPOSE

Statutes, regulations, directives, and binding regulatory instruments. Identifiers are article/section/paragraph citations of public legal texts — edicts of government, not copyrightable subject matter (and in the US, government works are public domain under 17 U.S.C. §105). Citing a law's section number is the ordinary act of legal reference performed by every compliance product, law firm, and regulator.

¹ Eleven entries' `sourceUrl` points at a third-party translation or mirror (DigiChina/Stanford for China, IAPP for Mexico, lexbahamas, kontur.ru, etc.). This is a provenance note only: Graphletter links to, but does not republish, those translations, and the exposed identifiers come from the SCF crosswalk, not the mirror.

| Key                                                       | Framework                                      | Geography | Mappings | Source note                     |
| --------------------------------------------------------- | ---------------------------------------------- | --------- | -------- | ------------------------------- |
| `americas-arg-ppd-2018`                                   | Americas Argentina Reg 132 2018                | Americas  | 78       | official source                 |
| `apac-aus-privacy-principles-2026`                        | APAC Australian Privacy Principles 2026        | APAC      | 24       | official source                 |
| `apac-aus-ps-cps-230-2023`                                | APAC Australia Prudential Standard CPS230 2023 | APAC      | 69       | official source                 |
| `apac-aus-ps-cps-234-2019`                                | APAC Australia Prudential Standard CPS234 2019 | APAC      | 23       | official source                 |
| `emea-aut-dpa-2018`                                       | EMEA Austria FAPPD 2000                        | EMEA      | 28       | official source                 |
| `americas-bhs-dpa-2003`                                   | Americas Bahamas DPA 2003                      | Americas  | 40       | third-party translation/mirror¹ |
| `emea-bel-act-30-2018`                                    | EMEA Belgium Act 8 1992                        | EMEA      | 27       | official source                 |
| `americas-bra-lgpd-2018`                                  | Americas Brazil LGPD 2018                      | Americas  | 29       | third-party translation/mirror¹ |
| `americas-can-pipeda-2000`                                | Americas Canada PIPEDA 2000                    | Americas  | 35       | official source                 |
| `americas-chl-act-19628-1999`                             | Americas Chile Act 19628 1999                  | Americas  | 12       | official source                 |
| `apac-chn-csnip-2012`                                     | APAC China DNSIP 2012                          | APAC      | 7        | third-party translation/mirror¹ |
| `apac-chn-cybersecurity-law-2017`                         | APAC China Cybersecurity Law 2017              | APAC      | 27       | third-party translation/mirror¹ |
| `apac-chn-data-security-law-2021`                         | APAC China Data Security Law 2021              | APAC      | 10       | third-party translation/mirror¹ |
| `apac-chn-pipl-2021`                                      | APAC China Privacy Law 2021                    | APAC      | 37       | third-party translation/mirror¹ |
| `americas-col-law-1581-2012`                              | Americas Colombia Law 1581 2012                | Americas  | 21       | official source                 |
| `emea-eu-ai-act-2024`                                     | EMEA EU AI Act                                 | EMEA      | 119      | official source                 |
| `emea-eu-cyber-resilience-act-2024`                       | EMEA EU Cyber Resiliency Act 2024              | EMEA      | 35       | official source                 |
| `emea-eu-dora-2023`                                       | EMEA EU DORA 2023                              | EMEA      | 102      | official source                 |
| `emea-eu-nis2-2022`                                       | EMEA EU NIS2 2022                              | EMEA      | 68       | official source                 |
| `emea-eu-psd2-2015`                                       | EMEA EU PSD2 2015                              | EMEA      | 11       | official source                 |
| `usa-federal-dow-dfars-252-204-7012`                      | US DFARS Cybersecurity 252.204-7012            | US        | 19       | official source                 |
| `usa-federal-eo-14028`                                    | US EO 14028                                    | US        | 43       | official source                 |
| `usa-federal-far-52-204-21`                               | US FAR 52.204-21                               | US        | 59       | official source                 |
| `usa-federal-far-52-204-25`                               | US FAR 52.204-25 (NDAA Section 889)            | US        | 2        | official source                 |
| `usa-federal-far-52-204-27`                               | US FAR 52.204-27                               | US        | 3        | official source                 |
| `usa-federal-fda-21-cfr-part-11-2025`                     | US FDA 21 CFR Part 11                          | US        | 62       | official source                 |
| `usa-federal-hhs-45-cfr-155-260-2016`                     | US HHS 45 CFR 155.260                          | US        | 36       | official source                 |
| `usa-federal-law-33-cfr-part-101-subpart-f`               | US 33 CFR Part 101 Subpart F                   | US        | 104      | official source                 |
| `usa-federal-law-coppa-2024`                              | US COPPA                                       | US        | 10       | official source                 |
| `usa-federal-law-facta-fcra-2023`                         | US FACTA & FCRA                                | US        | 3        | official source                 |
| `usa-federal-law-ferpa-2010`                              | US FERPA                                       | US        | 5        | official source                 |
| `usa-federal-law-ftc-act`                                 | US FTC Act                                     | US        | 16       | official source                 |
| `usa-federal-law-glba-cfr-314-2023`                       | US GLBA CFR 314 2023                           | US        | 70       | official source                 |
| `usa-federal-nispom-2020`                                 | US NISPOM 2020                                 | US        | 35       | official source                 |
| `usa-federal-sec-cybersecurity-rule-2023`                 | US SEC Cybersecurity Rule                      | US        | 40       | official source                 |
| `usa-federal-tsa-security-directive-1580-82-2022-01`      | US TSA / DHS 1580/82-2022-01                   | US        | 60       | official source                 |
| `emea-deu-fdpa-2017`                                      | EMEA Germany FDPA 2017                         | EMEA      | 46       | official source                 |
| `emea-grc-pirppd-1997`                                    | EMEA Greece PIRPPD 1997                        | EMEA      | 26       | official source                 |
| `apac-hkg-pdo-2022`                                       | APAC Hong Kong PDO 2022                        | APAC      | 18       | official source                 |
| `emea-hun-act-cxii-2011`                                  | EMEA Hungary Act CXII 2011                     | EMEA      | 35       | official source                 |
| `apac-ind-dpdpa-2023`                                     | APAC India DPDPA 2023                          | APAC      | 41       | official source                 |
| `apac-ind-privacy-rules-2011`                             | APAC India ITR 2011                            | APAC      | 13       | third-party translation/mirror¹ |
| `emea-irl-dpa-2018`                                       | EMEA Ireland DPA 2018                          | EMEA      | 17       | official source                 |
| `emea-isr-ppl-5741-2025`                                  | EMEA Israel PPL 2025                           | EMEA      | 13       | third-party translation/mirror¹ |
| `emea-ita-pdpc-2018`                                      | EMEA Italy PDPC 2018                           | EMEA      | 13       | official source                 |
| `apac-jpn-appi-2020`                                      | APAC Japan APPI 2020                           | APAC      | 34       | official source                 |
| `emea-ken-pda-2019`                                       | EMEA Kenya DPA 2019                            | EMEA      | 42       | official source                 |
| `apac-mys-pdpa-2010`                                      | APAC Malaysia PDPA 2010                        | APAC      | 19       | official source                 |
| `americas-mex-fdpa-2010`                                  | Americas Mexico FDPA 2010                      | Americas  | 23       | third-party translation/mirror¹ |
| `apac-nzl-privacy-act-2020`                               | APAC New Zealand Privacy Act of 2020           | APAC      | 20       | official source                 |
| `emea-nga-dpr-2019`                                       | EMEA Nigeria DPR 2019                          | EMEA      | 32       | official source                 |
| `general-nist-800-66-r2`                                  | NIST SP 800-66 R2                              | General   | 112      | official source                 |
| `emea-nor-pda-2018`                                       | EMEA Norway DPA 2018                           | EMEA      | 4        | official source                 |
| `apac-phl-dpa-2012`                                       | APAC Philippines DPA 2012                      | APAC      | 16       | official source                 |
| `emea-pol-act-10-2018`                                    | EMEA Poland Act 10 2018                        | EMEA      | 2        | official source                 |
| `emea-qat-pdppl-2020`                                     | EMEA Qatar PDPPL 2020                          | EMEA      | 33       | official source                 |
| `emea-rus-152-fz-2025`                                    | EMEA Russia 152-FZ 2025                        | EMEA      | 17       | third-party translation/mirror¹ |
| `emea-sau-pdpl-2023`                                      | EMEA Saudi Arabia PDPL                         | EMEA      | 36       | official source                 |
| `emea-srb-act-9-2018`                                     | EMEA Serbia 87/2018                            | EMEA      | 31       | third-party translation/mirror¹ |
| `apac-sgp-pdpa-2012`                                      | APAC Singapore PDPA 2012                       | APAC      | 33       | official source                 |
| `emea-zaf-popia-2013`                                     | EMEA South Africa POPIA 2013                   | EMEA      | 23       | official source                 |
| `apac-kor-pipa-2011`                                      | APAC South Korea PIPA 2011                     | APAC      | 24       | official source                 |
| `emea-esp-decree-311-2022`                                | EMEA Spain Royal Decree 311 2022               | EMEA      | 72       | official source                 |
| `usa-state-ak-pipa-2009`                                  | US - AK PIPA                                   | US        | 5        | official source                 |
| `usa-state-ca-sb1386-2002`                                | US - CA SB1386                                 | US        | 4        | official source                 |
| `usa-state-ca-sb327-2018`                                 | US - CA SB327                                  | US        | 3        | official source                 |
| `usa-state-co-privacy-act-2021`                           | US - CO Colorado Privacy Act                   | US        | 23       | official source                 |
| `usa-state-il-bipa-2008`                                  | US - IL BIPA                                   | US        | 6        | official source                 |
| `usa-state-il-ipa-2009`                                   | US - IL IPA                                    | US        | 12       | official source                 |
| `usa-state-il-pipa-2006`                                  | US - IL PIPA                                   | US        | 10       | official source                 |
| `usa-state-ma-201-cmr-17-2008`                            | US - MA 201 CMR 17.00                          | US        | 53       | official source                 |
| `usa-state-nv-privacy-law-2023`                           | US - NV Privacy Law 2023                       | US        | 29       | official source                 |
| `usa-state-nv-regulation-5-2024`                          | US - NV NOGE Reg 5                             | US        | 20       | official source                 |
| `usa-state-nv-sb220-2019`                                 | US - NV SB220                                  | US        | 3        | official source                 |
| `usa-state-ny-dfs-23-nycrr500-2023-amd2`                  | US - NY DFS 23 NYCRR500 2023 Amd 2             | US        | 156      | official source                 |
| `usa-state-ny-shield-act-2019`                            | US - NY SHIELD Act S5575B                      | US        | 28       | official source                 |
| `usa-state-or-cpa-2023`                                   | US - OR CPA                                    | US        | 34       | official source                 |
| `usa-state-or-ors-646a-2025`                              | US - OR 646A                                   | US        | 24       | official source                 |
| `usa-state-tn-tipa-2025`                                  | US - TN TIPA                                   | US        | 29       | official source                 |
| `usa-state-tx-bc521-2009`                                 | US - TX BC521                                  | US        | 5        | official source                 |
| `usa-state-tx-cdpa-2025`                                  | US - TX CDPA                                   | US        | 28       | official source                 |
| `usa-state-tx-dir-security-control-standards-catalog-2-2` | US - TX DIR Control Standards 2.2              | US        | 238      | official source                 |
| `usa-state-tx-sb2610-2025`                                | US - TX SB 2610                                | US        | 6        | official source                 |
| `usa-state-tx-sb820-2019`                                 | US - TX SB 820                                 | US        | 4        | official source                 |
| `usa-state-va-cdpa-2023`                                  | US - VA CDPA 2023                              | US        | 44       | official source                 |
| `usa-state-vt-act-171-2018`                               | US - VT Act 171 of 2018                        | US        | 35       | official source                 |
| `emea-che-fadp-2025`                                      | EMEA Switzerland FADP 2025                     | EMEA      | 25       | official source                 |
| `apac-twn-pdpa-2025`                                      | APAC Taiwan PDPA 2025                          | APAC      | 9        | official source                 |
| `emea-tur-lppd-2016`                                      | EMEA Turkey LDDP 2016                          | EMEA      | 7        | official source                 |
| `emea-gbr-dpa-2018`                                       | EMEA UK DPA 2018                               | EMEA      | 25       | official source                 |

## 4. Group B — Government publications (24) → EXPOSE

Non-statutory government frameworks, baselines, and profiles. US federal works (FedRAMP, CMMC, NIST, IRS 1075, MARS-E, FIPPS, DoD Zero Trust docs, NNPI, DPF, FCA CRM) are public domain under 17 U.S.C. §105. TX-RAMP is a Texas state program publishing NIST-derived baselines openly. The EU CRA Annex I and NIS2 Annex identifiers are citations of EU legal acts (EUR-Lex; Commission reuse decision 2011/833/EU).

Note on CMMC: the CMMC certification marks have a DoD usage regime; identifier exposure (practice IDs, which are NIST SP 800-171 numbering) is unaffected — never imply certification-body status.

| Key                                              | Framework                                    | Geography | Mappings | Source note     |
| ------------------------------------------------ | -------------------------------------------- | --------- | -------- | --------------- |
| `emea-eu-cyber-resilience-act-annex-i-2024`      | EMEA EU Cyber Resiliency Act Annex I 2024    | EMEA      | 16       | official source |
| `emea-eu-nis2-annex-2024`                        | EMEA EU NIS2 Annex 2024                      | EMEA      | 223      | official source |
| `usa-federal-cms-marse-2-0`                      | US CMS MARS-E 2.0                            | US        | 392      | official source |
| `usa-federal-doc-data-privacy-framework-2023`    | US Data Privacy Framework (DPF)              | US        | 31       | official source |
| `usa-federal-dow-cmmc-2-level-1`                 | US CMMC 2.0 Level 1                          | US        | 52       | official source |
| `usa-federal-dow-cmmc-2-level-1-aos`             | US CMMC 2.0 Level 1 AOs                      | US        | 16       | official source |
| `usa-federal-dow-cmmc-2-level-2`                 | US CMMC 2.0 Level 2                          | US        | 198      | official source |
| `usa-federal-dow-cmmc-2-level-3`                 | US CMMC 2.0 Level 3                          | US        | 55       | official source |
| `usa-federal-dow-safeguarding-nnpi-2010`         | US NNPI (unclass)                            | US        | 32       | official source |
| `usa-federal-dow-zt-roadmap-1-1`                 | US DoD Zero Trust Execution Roadmap          | US        | 117      | official source |
| `usa-federal-dow-zta-reference-architecture-2-0` | US DoD Zero Trust Reference Architecture 2.0 | US        | 39       | official source |
| `usa-federal-gsa-fedramp-5-high`                 | US FedRAMP R5 (high)                         | US        | 561      | official source |
| `usa-federal-gsa-fedramp-5-li-saas`              | US FedRAMP R5 (LI-SaaS)                      | US        | 383      | official source |
| `usa-federal-gsa-fedramp-5-low`                  | US FedRAMP R5 (low)                          | US        | 383      | official source |
| `usa-federal-gsa-fedramp-5-mod`                  | US FedRAMP R5 (moderate)                     | US        | 491      | official source |
| `usa-federal-irs-1075-2021`                      | US IRS 1075                                  | US        | 443      | official source |
| `usa-federal-omb-fipps-1973`                     | US FIPPS                                     | US        | 30       | official source |
| `usa-federal-sro-fca-crm-2023`                   | US FCA CRM                                   | US        | 81       | official source |
| `general-nist-600-1-gen-ai-profile`              | NIST AI 600-1                                | General   | 139      | official source |
| `general-nist-800-172a-r3`                       | NIST 800-172A R3                             | General   | 163      | official source |
| `general-nist-800-82-r3`                         | NIST 800-82 R3                               | General   | 777      | official source |
| `general-nist-cswp-39`                           | NIST CSWP 39                                 | General   | 15       | official source |
| `usa-state-tx-txramp-2-0-level-1`                | US - TX TX-RAMP Level 1                      | US        | 173      | official source |
| `usa-state-tx-txramp-2-0-level-2`                | US - TX TX-RAMP Level 2                      | US        | 285      | official source |

## 5. Group C — Researched publishers (69)

### 5.1 Cleared → EXPOSE (62)

| Publisher                           | Frameworks (entries)                                                 | Evidence for exposure                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IEC                                 | TR 60601-4-5; 62443-2-1/-3-3/-4-1/-4-2 (5)                           | Same posture as already-exposed ISO/IEC 27001: copyright restricts reproduction, permission process is scoped by clause number — referencing is the sanctioned alternative to copying. SR/CR identifiers published by NIST/CISA/ISAGCA with no IEC objection; scheme co-owned with ISA.                     |
| UL Standards & Engagement           | UL 2900-1, 2900-2-2 (2)                                              | Free read-only Digital View after registration; ANSI-approved, FDA-recognized (designations in FDA's public database). ToS restricts reproducing the purchased product, not citation. Never imply UL certification.                                                                                         |
| AICPA                               | Privacy Management Framework (1)                                     | Same publisher as already-exposed SOC 2 TSC, equal-or-lighter terms; free-account download gate only.                                                                                                                                                                                                       |
| ENX/VDA (TISAX)                     | ISA 6 catalogue (1)                                                  | Verified in the freely downloaded workbook: CC BY-ND 4.0 **plus** an extra derivative-distribution grant (§9) — same licence family as the SCF itself. Attribution required (§5.2).                                                                                                                         |
| NERC                                | CIP 2024 set (1)                                                     | Trademark guidelines **expressly permit** compliance products referencing Reliability Standards by identifier (worked example in NERC's own policy). No logo, no implied endorsement.                                                                                                                       |
| FBI                                 | CJIS Security Policy 6.0 (1)                                         | US government work, no copyright notice in document; FBI seal separately restricted (18 U.S.C. §709) — text identifiers unaffected.                                                                                                                                                                         |
| CMU SEI                             | CERT-RMM v1.2 (1)                                                    | Distribution Statement A ("public release, unlimited distribution"); permission clause targets reproducing material, not process-area IDs. Quoting practice text would need SEI permission.                                                                                                                 |
| DOE                                 | C2M2 v2.1 (1)                                                        | DOE publication with zero copyright assertion (v2.1 carries no CMU claim).                                                                                                                                                                                                                                  |
| GovRAMP                             | GovRAMP + Core/Low/Low+/Mod/High (6)                                 | All baseline docs openly downloadable (verified 2026-07-11); identifiers are overwhelmingly NIST 800-53 control IDs (public domain) + GovRAMP grouping labels; only generic site T&C.                                                                                                                       |
| FINRA                               | Cybersecurity rules (1)                                              | Full rulebook publicly published; rule numbers are SEC-approved SRO rules, universally cited.                                                                                                                                                                                                               |
| NAIC                                | Model Law 668 (1)                                                    | © NAIC on the freely published PDF but no restriction language; section numbers also exist as enacted state statutes (public domain law). Don't republish model-law text.                                                                                                                                  |
| MITRE / CTID                        | ATT&CK 16.1 mappings (1)                                             | Express royalty-free commercial licence; CTID mappings-explorer is Apache 2.0. Required attribution line (§5.2).                                                                                                                                                                                            |
| Aerospace Corp                      | SPARTA (1)                                                           | ToS grants royalty-free commercial licence (modeled on ATT&CK terms); reproduce Aerospace copyright designation (§5.2).                                                                                                                                                                                     |
| OWASP                               | Top 10 2025 (1)                                                      | CC BY 3.0 (attribution only — **not** share-alike).                                                                                                                                                                                                                                                         |
| OECD                                | Privacy Principles (1)                                               | Excerpt-with-attribution expressly permitted; principle numbers are the canonical citation currency of privacy law.                                                                                                                                                                                         |
| APEC                                | Privacy Framework 2015 (1)                                           | "Contents… can be reproduced… with the proper crediting of APEC"; no APEC logo.                                                                                                                                                                                                                             |
| UNECE                               | UN R155 + WP.29 (2)                                                  | Restrictive site notice on paper, but both are international regulatory legal texts mirrored verbatim in EUR-Lex; clause-number citation is universal automotive-industry practice.                                                                                                                         |
| IMO                                 | MSC-FAL.1/Circ.3/Rev.3 (1)                                           | Free-circulation circular (not an IMO sales publication); commercial-reuse prohibition covers reproducing Materials, not citing section numbers.                                                                                                                                                            |
| UK NCSC / MOD / CAA                 | CAF 4.0, Cyber Essentials 3.3, Def Stan 05-138 + L0–L3, CAP 1850 (8) | Crown copyright under OGL v3.0 (CAF, CE, Def Stan — the latter published openly on GOV.UK with MOD itself publishing crosswalks). CAP 1850 is stricter (CAA not OGL) but its identifiers are the OGL-licensed CAF's; don't reproduce CAP guidance text. Don't use the Cyber Essentials certification badge. |
| Germany BSI                         | C5:2020, Standard 200-1 (2)                                          | C5 PDF legal notice read in full: free publication, no restriction; AWS/Google/Microsoft publish C5 criterion IDs commercially. 200-1: freely published, chapter-number mappings only (BSI imprint page unreachable — flagged, not blocking).                                                               |
| Spain CCN                           | CCN-STIC 825 (1)                                                     | CCN guides carry a written-authorization reproduction prohibition, **but** the mapping column verified locally to contain only statutory ENS measure IDs from RD 311/2022 (copyright-exempt, Art. 13 TRLPI). Exposure reproduces nothing from the guide.                                                    |
| EU EBA                              | ICT & Security Risk Mgmt Guidelines (1)                              | Legal notice: reproduction authorised with source acknowledgment.                                                                                                                                                                                                                                           |
| Canada OSFI / CCCS                  | B-13, Cyber Self-Assessment (col 279), ITSP.10.171 (3)               | Crown copyright: commercial _reproduction of materials_ needs permission; identifier citation is not reproduction. ITSP.10.171 identifiers are NIST 800-171's public-domain numbering. **Hard line: never reproduce B-13 prose or the self-assessment questionnaire content.**                              |
| Bermuda BMA                         | Cyber Code of Conduct 2020 (1)                                       | Statutory-style code; site terms target data-feeds/mirroring, not section citation; Big-4 republish commercially.                                                                                                                                                                                           |
| Saudi NCA                           | ECC, CSCC, OTCC, CGIoT (4)                                           | Verified TLP:White / Unclassified markings; targeted search found **no** reproduction-restriction clause; NCA publishes its own crosswalk annexes. (OTCC/CGIoT internals corroborated via indexed text.)                                                                                                    |
| Saudi SAMA                          | Cyber Security Framework 1.0 (1)                                     | Full framework incl. control IDs published as open HTML on the SAMA rulebook; no reproduction restriction.                                                                                                                                                                                                  |
| UAE TDRA                            | NIAF 2023 (1)                                                        | NIAF + companion IA Regulation v1.1 (source of the T/M control IDs) both downloaded: no classification or reproduction notice in either.                                                                                                                                                                    |
| Israel INCD                         | CMO 2.0 (1)                                                          | Explicitly permissive: v1.0 "can be used freely"; v2.0 permits copying/incorporation with INCD credit, current version, no changes. Credit INCD (§5.2).                                                                                                                                                     |
| Australia ASD / OAIC / Home Affairs | ISM 2026-03, Essential Eight, APPs, IoT Code of Practice (4)         | ISM is CC BY 4.0 with an OSCAL edition published _for_ GRC tools; OAIC site CC BY 4.0 (verified); APPs are statutory; IoT CoP PDF carries an in-document CC BY 4.0 statement (verified firsthand 2026-07-11).                                                                                               |
| NZ GCSB / Health NZ                 | NZISM 3.9, HISF micro/small + suppliers (3)                          | NZISM legal page: CC BY 4.0 (NZGOAL). HISF: in-document CC BY 4.0 grant. Link-rot risk from the tewhatuora→healthnz migration is operational, not licensing.                                                                                                                                                |
| Singapore MAS                       | TRM Guidelines, Cyber Hygiene (FSM-N06) (2)                          | All-rights-reserved site ToU covers reproducing content; paragraph-identifier citation of freely published regulatory instruments is unaffected; TRM PDF itself carries no notice.                                                                                                                          |
| Malaysia BNM                        | RMiT 2025 (1)                                                        | Restrictive ToU + Emblems and Names Act → strictly nominative use, no BNM emblem; paragraph-ID citation is factual reference (Thales/PwC/EY publish RMiT mappings).                                                                                                                                         |
| India SEBI                          | CSCRF 2024 (1)                                                       | Site policy allows free reproduction with emailed permission + prominent acknowledgment; identifiers sit below that threshold. Optional courtesy permission email.                                                                                                                                          |

### 5.2 Attribution obligations that ride along with EXPOSE

These are conditions, not blockers. Recommend a per-framework `attribution` note (overrides file) surfaced on the framework detail page:

| Publisher                                                | Required/expected line                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| MITRE ATT&CK                                             | "© 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation." ATT&CK® with ® on first use. |
| Aerospace SPARTA                                         | Reproduce Aerospace's copyright designation per its ToS.                                                                                              |
| ENX/VDA TISAX                                            | "TISAX® is a registered trademark of ENX Association"; credit VDA/ENX for the ISA catalogue.                                                         |
| OWASP                                                    | CC BY 3.0 attribution to OWASP Foundation.                                                                                                            |
| Australia ASD / OAIC / Home Affairs, NZ GCSB / Health NZ | CC BY 4.0 attribution (© Commonwealth of Australia / © Crown NZ).                                                                                   |
| UK NCSC / MOD                                            | OGL v3.0 attribution ("Contains public sector information licensed under the Open Government Licence v3.0").                                          |
| Israel INCD                                              | Credit the Israel National Cyber Directorate.                                                                                                         |
| OECD / APEC / EBA / SEBI / BMA                           | Source acknowledgment on display surfaces.                                                                                                            |
| NERC / UL / CMMC / Cyber Essentials / BNM                | Negative obligations: no logos/marks, no implied certification or endorsement, nominative use only.                                                   |

### 5.3 EXPOSE pending a one-minute manual check (2)

Both recommendations are EXPOSE; both publishers' terms were unreachable from automated tooling (swift.com times out network-wide; ttpn.org serves an Incapsula bot challenge). One browser visit each closes them:

1. **SWIFT CSCF v2025** (`general-swift-cscf-2025`) — Control IDs are de facto public: Microsoft, AWS, UpGuard, and assessor firms publish full control-level CSCF mappings with no known enforcement, and SWIFT's own Knowledge Centre PDF URLs are crawler-indexed. **Check:** open swift.com terms + the CSCF document's distribution notice in a browser; confirm no crosswalk-specific restriction.
2. **MPA Content Security Best Practices v5.3.1** (`general-mpa-csbp-5-3-1`) — Openly published for voluntary industry-wide adoption; predecessor labeled "Initial Public Release" with no copyright block; IDs already public via cloud-provider compliance pages. **Check:** download the v5.3.1 xlsx in a browser and confirm no new terms sheet inside the workbook.

### 5.4 CAUTION — your call (4)

Each is legally defensible on the identifiers-are-facts + SCF-redistribution basis, but carries a residual worth a deliberate decision:

1. **ISACA COBIT 2019** (`general-cobit-2019`, 190 mappings) — The only publisher whose terms _name what Graphletter does_: an annual ISACA licence is required when COBIT content is "used in commercial works or products (such as software products, tools…)". A support article adds a >20% content threshold, but the product clause isn't quantity-qualified on its face, and ISACA runs a dedicated IP office and active licensing program — the most assertive posture in the catalog. _Options:_ (a) keep non-public (zero risk, loses 190 mappings from public view); (b) expose with a nominative-use attribution line and accept the small relations risk (bare objective IDs like DSS05.04 are far below 20%); (c) email IPinfo@isaca.org for a written read first. **Recommendation: (c) then (b)** — the query costs one email.
2. **CR-CMM 2026** (`general-cr-cmm-2026`, 46 mappings) — Owned by High Value Target, a private commercial firm; workbook download may be email-gated; **no licence text exists anywhere** (bare © footer). _Options:_ one-line confirmation email to contact@cr-cmm.org, or keep non-public on watch. **Recommendation: keep non-public until the email is answered** — smallest publisher in the set, no precedent to lean on.
3. **Saudi Aramco SACS-002** (`emea-sau-sacs-002-2022`, 101 mappings) — A _corporate_ standard (supplier CCC program), not government regulation; PDF carries an internal "Company General Use" classification marking; aramco.com ToU prohibits commercial reproduction/public display without written consent. Third parties republish it, but that's absence of enforcement, not permission. **Recommendation: keep non-public.** Aramco is brand-protective, the audience is its own suppliers, and the upside of public exposure is low.
4. **Japan ISMAP** (`apac-jpn-ismap`, 249 mappings) — The control-standards PDF is free (soumu.go.jp mirror verified), but the portal requires IPA's prior consent for republication (転載), does not adopt Japan's CC-BY-compatible Government Standard Terms, and gates the Excel catalog behind JIS-purchase attestation because the control text derives from JIS/ISO copyrighted standards. Bare control IDs are defensible; wholesale ID-list display is the weakest open signal in the set. **Recommendation: keep non-public pending a legal read** (or a consent request to IPA if ISMAP demand materializes).

### 5.5 NON-PUBLIC — recommended keep (1)

**Shared Assessments SIG 2025** (`general-shared-assessments-sig-2025`, 128 mappings) — Member/purchase-only (~$6,500/yr standalone licence); the question/control-ID scheme **is the licensed asset**; even the FAQ is login-gated. This is the exact disqualifying condition the review was built to catch. Keep `non-public`; SIG mappings may still serve authenticated product surfaces if ever needed (visibility axis unaffected).

## 6. Out of scope

Three `visibility: excluded` entries (zero mapped controls in the 2026.2 workbook) carry no exposure question: `general-scf-dpmp-2025`, `apac-nzl-hisf-mlhsp-2023`, `americas-can-osfi-self-assessment` (upstream dual-FDI defect noted in overrides).

## 7. Mechanics — how decisions land

1. For each approved framework, set in `data/framework-manifest.overrides.json`: `exposureStatus: "public"` and replace the pending-review `exposureReason` with a decision record, e.g. `"Cleared by exposure review 2026-07-11 (docs/FRAMEWORK_EXPOSURE_REVIEW.md): <one-line basis>."` Keep CAUTION/NON-PUBLIC entries `non-public` with the same doc-reference style.
2. `pnpm manifest:generate` → regenerates `data/framework-manifest.json` and the derived columns module; freshness + consistency gates verify.
3. Reseed is **not** required for exposure flips alone (exposure is metadata consumed at query time), but Stage 7 cohort promotion (visibility flip) follows its own full-ceremony spec.
4. Suggested enhancement for Stage 7: an optional `attribution` string per manifest entry, rendered on the framework detail page, to discharge §5.2 obligations systematically.

## 8. Decision checklist (your moves)

- [ ] Approve Group A (90 laws) → public
- [ ] Approve Group B (24 government publications) → public
- [ ] Approve Group C cleared set (62) → public, with §5.2 attribution notes
- [ ] SWIFT + MPA: do the two 1-minute browser checks (or delegate; then flip per result)
- [ ] COBIT: pick option a/b/c (recommended: email ISACA, then expose with attribution)
- [ ] CR-CMM: send the confirmation email or leave non-public
- [ ] SACS-002: confirm keep non-public
- [ ] ISMAP: confirm keep non-public
- [ ] SIG: confirm keep non-public

Approving the three bulk groups clears **176 of 183** frameworks for public identifier exposure — including the entire Stage 7 first cohort.

## Appendix — Group C per-entry dispositions (69)

Mechanical index for scripting the overrides flip; rationale lives in §5.

| Key                                                       | Framework                                        | Mappings | Disposition                   |
| --------------------------------------------------------- | ------------------------------------------------ | -------- | ----------------------------- |
| `general-aicpa-pmf-2020`                                  | AICPA Privacy Management Framework (PMF)         | 109      | EXPOSE                        |
| `general-apec-privacy-framework-2015`                     | APEC Privacy Framework 2015                      | 14       | EXPOSE                        |
| `apac-aus-cop-sitc-2020`                                  | APAC Australia IoT Code of Practice 2024         | 35       | EXPOSE                        |
| `apac-aus-essential-8-2024`                               | APAC Australia Essential 8 2024                  | 37       | EXPOSE                        |
| `apac-aus-ism-2026-march`                                 | APAC Australia ISM March 2026                    | 389      | EXPOSE                        |
| `americas-bmu-mba-coc-2020`                               | Americas Bermuda BMACCC 2020                     | 97       | EXPOSE                        |
| `general-bsi-200-1-1-0`                                   | BSI Standard 200-1                               | 35       | EXPOSE                        |
| `americas-can-itsp-10-171-2025`                           | Americas Canada ITSP-10-171 2025                 | 415      | EXPOSE                        |
| `americas-can-osfi-b13-2022`                              | Americas Canada OSFI B-13 2022                   | 150      | EXPOSE                        |
| `americas-can-osfi-self-assessment-column-279`            | Americas Canada OSFI Self-Assessment Guidance    | 125      | EXPOSE                        |
| `general-cr-cmm-2026`                                     | CR CMM 2026                                      | 46       | CAUTION                       |
| `emea-eu-eba-ict-srm-2025`                                | EMEA EU EBA GL/2019/04                           | 153      | EXPOSE                        |
| `usa-federal-doe-c2m2-2-1`                                | US C2M2 2.1                                      | 224      | EXPOSE                        |
| `usa-federal-dow-cert-rmm-1-2`                            | US CERT RMM 1.2                                  | 85       | EXPOSE                        |
| `usa-federal-fbi-cjis-6-0`                                | US CJIS Security Policy 6.0                      | 365      | EXPOSE                        |
| `usa-federal-nerc-cip-2024`                               | US NERC CIP 2024                                 | 122      | EXPOSE                        |
| `usa-federal-sro-finra`                                   | US FINRA                                         | 17       | EXPOSE                        |
| `emea-deu-c5-2020`                                        | EMEA Germany C5 2020                             | 207      | EXPOSE                        |
| `general-govramp`                                         | GovRAMP                                          | 441      | EXPOSE                        |
| `general-govramp-core`                                    | GovRAMP Core                                     | 86       | EXPOSE                        |
| `general-govramp-high`                                    | GovRAMP High                                     | 441      | EXPOSE                        |
| `general-govramp-low`                                     | GovRAMP Low                                      | 166      | EXPOSE                        |
| `general-govramp-low-plus`                                | GovRAMP Low+                                     | 230      | EXPOSE                        |
| `general-govramp-mod`                                     | GovRAMP Moderate                                 | 347      | EXPOSE                        |
| `general-iec-62443-2-1-2024`                              | IEC 62443-2-1 2024                               | 112      | EXPOSE                        |
| `general-iec-62443-3-3-2013`                              | IEC 62443-3-3 2013                               | 80       | EXPOSE                        |
| `general-iec-62443-4-1-2018`                              | IEC 62443-4-1 2018                               | 25       | EXPOSE                        |
| `general-iec-62443-4-2-2019`                              | IEC 62443-4-2 2019                               | 89       | EXPOSE                        |
| `general-iec-tr-60601-4-5-2021`                           | IEC TR 60601-4-5 2021                            | 26       | EXPOSE                        |
| `general-imo-maritime-cyber-risk-management-2025`         | IMO Maritime Cyber Risk Management               | 75       | EXPOSE                        |
| `apac-ind-sebi-2024`                                      | APAC India SEBI CSCRF 2024                       | 170      | EXPOSE                        |
| `general-cobit-2019`                                      | COBIT 2019                                       | 190      | CAUTION                       |
| `emea-isr-cmo-2-0`                                        | EMEA Israel CDMO 2.0                             | 67       | EXPOSE                        |
| `apac-jpn-ismap`                                          | APAC Japan ISMAP                                 | 249      | CAUTION                       |
| `apac-mys-bnm-rmit-2025`                                  | APAC Malaysia RMiT 2025                          | 197      | EXPOSE                        |
| `general-mitre-att_ck-16-1`                               | MITRE ATT&CK 16                                  | 108      | EXPOSE                        |
| `general-mpa-csbp-5-3-1`                                  | MPA Content Security Program 5.3.1               | 232      | EXPOSE (pending manual check) |
| `general-naic-insurance-data-security-model-law-668-2017` | NAIC Insurance Data Security Model Law (MDL-668) | 58       | EXPOSE                        |
| `apac-nzl-hisf-microsmall-2023`                           | APAC New Zealand HISF Microsmall 2023            | 102      | EXPOSE                        |
| `apac-nzl-hisf-suppliers-2023`                            | APAC New Zealand HISF Suppliers 2023             | 101      | EXPOSE                        |
| `apac-nzl-ism-3-9`                                        | APAC New Zealand NZISM 3.9                       | 289      | EXPOSE                        |
| `general-oecd-privacy-principles-2010`                    | OECD Privacy Principles                          | 14       | EXPOSE                        |
| `general-owasp-top-10-2025`                               | OWASP Top 10 2025                                | 139      | EXPOSE                        |
| `emea-sau-cgiot-2024`                                     | EMEA Saudi Arabia IoT CGIoT-1 2024               | 118      | EXPOSE                        |
| `emea-sau-cscc-1-2019`                                    | EMEA Saudi Arabia CSCC-1 2019                    | 172      | EXPOSE                        |
| `emea-sau-ecc-1-2018`                                     | EMEA Saudi Arabia ECC-1 2018                     | 169      | EXPOSE                        |
| `emea-sau-otcc-1-2022`                                    | EMEA Saudi Arabia OTCC-1 2022                    | 160      | EXPOSE                        |
| `emea-sau-sacs-002-2022`                                  | EMEA Saudi Arabia SACS-002 2022                  | 101      | CAUTION                       |
| `emea-sau-sama-csf-1-2017`                                | EMEA Saudi Arabia SAMA CSF 1.0 2017              | 91       | EXPOSE                        |
| `general-shared-assessments-sig-2025`                     | Shared Assessments SIG 2025                      | 128      | NON-PUBLIC                    |
| `apac-sgp-cyber-hygiene-practice-2019`                    | APAC Singapore Cyber Hygiene Practice 2019       | 17       | EXPOSE                        |
| `apac-sgp-mas-trm-2021`                                   | APAC Singapore MAS TRM 2021                      | 219      | EXPOSE                        |
| `emea-esp-ccn-stic-825-2026`                              | EMEA Spain CCN-STIC 825                          | 234      | EXPOSE                        |
| `general-sparta`                                          | SPARTA                                           | 79       | EXPOSE                        |
| `general-swift-cscf-2025`                                 | SWIFT CSF 2025                                   | 164      | EXPOSE (pending manual check) |
| `general-tisax-6-0-3`                                     | TISAX ISA 6.0.3                                  | 154      | EXPOSE                        |
| `emea-uae-niaf-2023`                                      | EMEA UAE NIAF 2023                               | 20       | EXPOSE                        |
| `general-ul-2900-1-2017`                                  | UL 2900-1 2017                                   | 23       | EXPOSE                        |
| `general-ul-2900-2-2-2016`                                | UL 2900-2-2 2016                                 | 20       | EXPOSE                        |
| `emea-gbr-caf-4-0`                                        | EMEA UK CAF 4.0                                  | 66       | EXPOSE                        |
| `emea-gbr-cap-1850-2020`                                  | EMEA UK CAP 1850 2020                            | 36       | EXPOSE                        |
| `emea-gbr-cyber-essentials-requirements-3-3`              | EMEA UK Cyber Essentials 3.3                     | 27       | EXPOSE                        |
| `emea-gbr-def-stan-05-138-2024`                           | EMEA UK DEFSTAN 05-138 2024                      | 213      | EXPOSE                        |
| `emea-gbr-def-stan-05-138-l0-2024`                        | EMEA UK DEFSTAN 05-138 - L0 2024                 | 2        | EXPOSE                        |
| `emea-gbr-def-stan-05-138-l1-2024`                        | EMEA UK DEFSTAN 05-138 - L1 2024                 | 159      | EXPOSE                        |
| `emea-gbr-def-stan-05-138-l2-2024`                        | EMEA UK DEFSTAN 05-138 - L2 2024                 | 206      | EXPOSE                        |
| `emea-gbr-def-stan-05-138-l3-2024`                        | EMEA UK DEFSTAN 05-138 - L3 2024                 | 212      | EXPOSE                        |
| `general-un-155-2021`                                     | UN R155                                          | 57       | EXPOSE                        |
| `general-un-ece-wp-29-2020`                               | UN ECE WP.29                                     | 57       | EXPOSE                        |
