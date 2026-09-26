# Front matter schema and naming conventions

## Front matter

Every exported page starts with a YAML block. Empty fields are omitted rather
than written as `null`.

```yaml
---
onenote_page_id: "1-a1b2c3...!1-d4e5f6..."   # stable; the key for incremental sync
title: KC Notes
created: '2023-07-18T14:21:15Z'
modified: '2023-07-18T14:21:15Z'
notebook: Formula E - S09_10
section_groups: [Race_Events, S09]            # omitted when the section is top-level
section: 23W28_R13_R14_RME
year: 2023                                    # parsed from the section name
week: 28
season: 9
rounds: [13, 14]
session_kind: race                            # race | track_test | combined_test
venue: RME
images: 3
attachments: 1
tables: 2
has_ink: false
---
```

`onenote_page_id` is the one field worth treating as authoritative — it survives
renames and moves, so it is what `notes/.manifest.json` keys on.

## Section naming convention

The notebooks use an underscore-delimited code that
`tools/taxonomy.py` parses. Examples from the live notebooks:

| Section name        | Reads as                                          |
| ------------------- | ------------------------------------------------- |
| `24W11_S10R04_SAO`  | 2024 week 11 · season 10 round 4 · São Paulo      |
| `23W28_R13_R14_RME` | 2023 week 28 · rounds 13 + 14 (doubleheader) · Rome |
| `23W21_T13_CAL`     | 2023 week 21 · track test 13 · Calafat            |
| `23W43_CT18_VLC`    | 2023 week 43 · combined test 18 · Valencia        |
| `S09_23W24_CRITT`   | season 9 · 2023 week 24 · CRITT (dyno facility)   |

Token grammar, in any order:

- `YYWWW` — two-digit year, `W`, ISO week (`24W11`)
- `SxxRyy` — season and round together (`S10R04`)
- `Sxx` — season alone (`S09`)
- `Rnn` / `Tnn` / `CTnn` — round, track test, combined test
- trailing all-letters token — venue or facility (`SAO`, `CRITT`)

Unrecognised tokens are ignored, and a free-text section name like
`MFE Systems checklist` parses to all-empty. That is expected, not a failure.

## Directory layout

The OneNote hierarchy is preserved, slugified:

```
notes/
  formula-e-s09_10/
    race_events/
      s09/
        23w28_r13_r14_rme/
          001-kc-notes.md
          002-team-manager-and-driver-meeting-notes.md
          assets/
            001-kc-notes-01-1-abc-1.png
```

The `NNN-` prefix is the page's position within its section, so files sort in
the order the pages appear in OneNote.

## Second pass: structured data

The Markdown export is the raw layer and should be treated as read-only —
re-running the exporter overwrites it. Anything derived (setups, lap times,
pitstop tables pulled out of the prose into CSV or YAML) belongs in a separate
`data/` tree so it survives a re-export and can be regenerated when the parser
improves.
