RTI Setu — bundled fonts
=========================

For full offline operation and zero CDN dependency, drop these four WOFF2
files into this folder (filenames must match exactly):

  Fraunces-SemiBold.woff2     (weight 600 — brand name, headings)
  Fraunces-Medium.woff2       (weight 500 — section headlines)
  DMSans-Regular.woff2        (weight 400 — body text)
  DMSans-Medium.woff2         (weight 500 — labels, buttons)

WHERE TO GET THEM
-----------------
Both families are open-source (SIL Open Font License), free for bundling:

  Fraunces : https://github.com/undercasetype/Fraunces  (or fonts.google.com/specimen/Fraunces)
  DM Sans  : https://fonts.google.com/specimen/DM+Sans

KEEPING THEM LIGHT (recommended)
--------------------------------
The full families are large. Subset each to just the characters you need —
Latin + the Devanagari used in "सत्यमेव जयते" — to get the whole set down to
~28 KB total. Using the `fonttools` Python package:

  pip install fonttools brotli
  pyftsubset Fraunces-SemiBold.ttf \
    --unicodes="U+0020-007E,U+0900-097F" \
    --flavor=woff2 --output-file=Fraunces-SemiBold.woff2

Repeat for each weight. U+0020-007E is basic Latin; U+0900-097F is Devanagari.

IF YOU SKIP THIS
----------------
The extension still works. popup.css and dashboard.css declare system-font
fallbacks (Georgia for the serif, system-ui for sans, Courier New for mono),
so missing WOFF2 files degrade gracefully — you simply lose the exact brand
typography. Nothing breaks.
