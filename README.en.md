# dsh-attention-center · PTC suite

One bundle, three things:

| Piece | Row | What it does |
|---|---|---|
| **Inquiry (PTC)** | `preset-inquiry` | A preset that asks 20-30 concrete questions before building. Runs on PTC: the model only sees `run_code` plus a generated SDK |
| **Attention center** | `attention-core` + `client.js` | Running-session pill, failure/done toasts, **cross-session answer popup**, optional phone push |
| **OPS / PTC pairing** | `tool-presentation` | Under PTC, `dsh-ops` tools become SDK bindings: one `run_code` program can probe several things concurrently and return only the lines that matter |

## Install

```text
plugin_manager install_bundle   target = github:zxh21149-commits/dsh-attention-center
```

Restart DSH afterwards (host rows + preset + skill); the client half only needs a page refresh.

Requirements: DSH >= 0.2.0 and the host `ptc-runtime` (shipped in official builds; this bundle overrides its `timeoutMs`).
`dsh-ops` is optional (third-party, Rust, Windows x64). Without it the preset still works; probing falls back to bash/file tools.

## Notes

- Asking is **timed**: 5 minutes to answer; after that the tool returns `pending` and the answer arrives later as a user message. A blocking wait inside `run_code` can be cut by the program deadline, and the official docs warn an interrupted PTC wait may lose the question.
- Auto-pick only applies to questions the popup actually showed; the idle clock starts when it was first shown; every auto-submit leaves a card naming the conversation and every pick.
- `/compact` has no retry of its own in DSH. If it fails mid-window, run it again later.

Tests: `node --test` (41 passing). License: MIT.

## What was tested

| Area | Coverage | Result |
|---|---|---|
| Attention: 15 unit tests | failure projection fold, notify folding + dedupe, the five push providers' request bodies, question timeout, done threshold | pass |
| Inquiry: 26 unit tests | config bounds, bank validation/fallback, skill prompt generation, `/pao` followup, `apply` wiring | pass |
| SSR probe (6 scenes) | answer card, failure card (open/retry/dismiss), no modal while unfocused, no crash without slot props, object status map, done card, `⏳10分` badge | pass |
| Real interaction | cross-session answer popup was used for real (choose, submit, resume) | pass |
| Remote push | request builders are unit-tested; no credential is shipped, **no real message ever received** | unverified |
| PTC preset | wiring + `ptc-runtime` deadline configured; **not yet run in a real browser** | unverified |

## Known limits

- Remote push needs your own credential (WeCom robot / PushPlus / Qmsg / ServerChan / webhook).
- `dsh-ops` is not vendored: it is a third-party Windows x64 native plugin. Without it the preset still works with bash/file tools.
- Inside PTC the answer wait is bounded by the `run_code` deadline; this bundle ships 300s ask / 330s program.
- `/compact` has no retry of its own in DSH; run it again if it hits a network window.
