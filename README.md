# SatoshiShrine — published output

**This repository is generated.** It is the built static site that Vercel serves at
<https://satoshishrine.vercel.app>. Nothing here is edited by hand; every file is overwritten
by the next publish. The build that produces it is a separate, private repository.

## What the site is

EU crypto, AI and finance law held verbatim from the **Official Journal** — not the EUR-Lex
consolidated text, which EUR-Lex itself labels *of documentary value only*. Every provision is
published at an address that does not move, carrying the SHA-256 of the official file it was
extracted from and the date it was captured.

    /celex/32023R1114/ART_59/20260823-32c6d21e/

516 provisions are leaves of one Merkle tree. The root, the leaf definition and a membership
proof for every provision are published so a citation can be checked without trusting us:

- `celex/corpus-proof.json` — root, leaf definition, extraction method, one proof per provision
- `celex/roots.json` — append-only ledger of every root that has existed, so the corpus can grow
  without breaking a citation made against an earlier one
- `celex/proofs/<root>.json` — the archived proof set for each root

Leaf definition: `sha256(celex ␟ provision ␟ artifact_sha256 ␟ captured ␟ text)`, U+241F as the
separator. Pairs hash left+right; an odd node is duplicated. Text extracted with
`pdftotext version 4.00`.

## The legal texts

They are European Union material, reproduced under Commission Decision 2011/833/EU on the reuse
of Commission documents. Only the Official Journal publication is authentic.

The vendored in-browser model runtime under `semantic/vendor/` ships unmodified under its own
licence; see `semantic/LICENSES.md`.

No licence is stated here for the code that builds this site. That is not an oversight and it is
not an implied grant: the terms have not been decided, and this file will say so plainly rather
than imply anything either way.

## What this does not do

It does not tell anyone what the law means for them, whether a provision applies to them, or
whether they comply. Pages that ask a reader questions record the reader's own answers against
the exact wording they answered, and say so.

## Known gaps

Held source PDFs are not yet published here, so `artifact_sha256` is currently checkable only
against EUR-Lex, which rotates files. There is no container or lockfile yet, so the Merkle root
cannot be reproduced from scratch by a third party. The root is not signed. These are recorded
as outstanding work rather than left to be discovered.
