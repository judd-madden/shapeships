# Set 03 local source provenance

The generator reads only these three local JSON inputs. It never downloads data.

| File | Origin | SHA-256 |
| --- | --- | --- |
| `dsojevic-profanity-en.json` | Built top-level `en.json`, <https://github.com/dsojevic/profanity-list> | `bcf8bfc09dd3f7480972cb041a4cba291a6ff16a6fbf29022d5d679e3c39502c` |
| `dsojevic-profanity-src-en.json` | Grouped `src/en.json`, same repository | `c6335736d52678a33c7c58cfd25cd03cf78119d6717cacca0c7b442c3645836f` |
| `btrsco-reserved-usernames.json` | `reserved-usernames.json`, <https://gist.github.com/btrsco/83bac8e835d948bc236e329a4e4c7639> | `278f5da24930e867f17e412c0ebb3f6c07feafa92398fe8180b44ea550dfd8dc` |

These are owner-supplied snapshots; hashes pin their exact bytes. No upstream commit/date is inferred. The gist states no licence and is used only as a reference for common system words. The source files are retained unchanged for review. The report lists all dropped Snapchat entries, every transformation/drop, and all retained reservations.

Preserve the source bytes, including LF line endings and whitespace; changing them changes provenance hashes. The supplied gist has 25 whitespace-only lines with trailing spaces. Its staged whitespace-check findings are retained intentionally so the source remains byte-identical; authored files and generated outputs pass the check.

The built profanity file has no `allow_partial` fields. The grouped source marks `sex`, `rape`, `cum`, `anal`, `xxx` and `ass` as `allow_partial:false`. The generator flattens group defaults, then supplements fields absent from each built entry. Built values retain precedence. Repeated IDs (`piss-pig`, `strap-on`) are disambiguated by their match/severity/tags; missing or ambiguous metadata aborts generation rather than silently overwriting an entry.

Severity 3–4 produces contains rules unless `allow_partial:false`; severity 1–2 produces exact rules. Exceptions mask safe substrings on contains rows only. Source provenance includes both profanity file names and hash prefixes; notes retain original ID, severity, tags, source notes and relevant partial-match policy. The fixed Shapeships reservations are explicitly marked in their notes. No owner exception or official/regular-player reservation is inserted.

Run from the repository root in PowerShell:

```powershell
deno run --no-config --allow-read=supabase/manual/account/sources '--allow-write=supabase/manual/account/03-seed-name-rules.sql,supabase/manual/account/sources/name-rules-report.md' supabase/manual/account/sources/build-name-rules.ts
```

The two outputs are deterministic: no timestamps, network access, environment settings or random identifiers are embedded. Current SQL is 223,794 UTF-8 bytes, suitable for one complete editor paste. Preserve both outputs with the implementation. On future source updates, update this provenance table and review the regenerated report before applying the rerunnable seed.

## dsojevic MIT notice

MIT License

Copyright (c) 2021 David Sojevic

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
