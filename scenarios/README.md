# Scenarios

One JSON file per scenario. The schema is in `schema/scenario.schema.json`.
Check every file with `npm run validate:scenarios`.

## lisbon-cafe-pt

- The hotspot, signage and spawn coordinates are placeholders until phase 3.
- It is not yet reviewed by a fluent speaker, so it has no `reviewed` block.
  The validator reports it as valid and unlisted, and the library does not show it.

## How to sign off a scenario

A fluent European Portuguese speaker checks the persona, the target phrases and the signage text.
Then add this block after `targets`:

```json
"reviewed": { "by": "<reviewer id>", "on": "YYYY-MM-DD" }
```

Run `npm run validate:scenarios`. The line should say `valid, listed`.
