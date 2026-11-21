# Scenarios

One JSON file per scenario. The schema is in `schema/scenario.schema.json`.
Check every file with `npm run validate:scenarios`.

## lisbon-cafe-pt

- The hotspot, signage and spawn coordinates are placeholders. There is no café scene file yet, so there was nothing to click in, and the coordinates stay as they are until the scene is generated and exported.
- To place them later, run the dev server with the scene file in `media/lisbon-cafe/` and open `/s/lisbon-cafe-pt/play?place=1`. Pick an item, click in the scene, and copy the printed fragment into the scenario file. The panel writes nothing to disk and exists only in development.
- `character.anchor` is optional. It sets where the name tag sits in the scene. Without it the tag keeps a fixed place over the scene area.
- It is not yet reviewed by a fluent speaker, so it has no `reviewed` block.
  The validator reports it as valid and unlisted, and the library does not show it.

## How to sign off a scenario

A fluent European Portuguese speaker checks the persona, the target phrases and the signage text.
Then add this block after `targets`:

```json
"reviewed": { "by": "<reviewer id>", "on": "YYYY-MM-DD" }
```

Run `npm run validate:scenarios`. The line should say `valid, listed`.
