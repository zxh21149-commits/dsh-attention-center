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
