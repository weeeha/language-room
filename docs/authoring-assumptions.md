# Authoring assumptions

The plan says phase 5 needs teacher interviews first. None have happened. The authoring screens are the smallest version that the task outlines describe. Each line below is an assumption to test in interviews. None of them is something a teacher asked for.

## Form (task 24)

- A teacher is comfortable with one long form on one page, with sections for basics, place, character, goal and phrases.
- Plain text fields are enough. Teachers do not need a preview of the conversation while they write.
- European Portuguese is the default language. Other languages are a rare need and a language tag field is acceptable for them.
- A level of A1 to B2 is the right set, as in the spec.
- Goal steps are short English instructions to the learner, and a teacher is happy to leave the generated step ids alone.
- Target phrases and grammar targets are easiest to write as one item per line.
- Saving in the browser is enough at first. A teacher accepts that a scenario lives in one browser and moves between computers as a file.
- Exporting a file and putting it in the `scenarios/` folder is acceptable for shipping, or someone else does that step.
- Duplicating a bundled scenario is a useful way to start.

## Scene (task 25)

- A teacher is willing to generate a scene in Marble themselves, possibly paying for it, and to copy the exported file into `media/<scenario id>/` by hand.
- Clicking in the scene to place a word or sign is easier than typing numbers. Number inputs are the keyboard path and may be rarely used.
- Placing three to six markers per scenario is the usual amount.
- A teacher can judge from looking at the scene whether large text inside it needs a new generation.

## Review (task 26)

- A fluent reviewer is a different person from the author, and the reviewer uses the same browser or receives the scenario as a link or file.
- A name or an id typed into a box is enough as a sign-off. There is no check that the person is who they say.
- A review checklist of persona, target phrases and sign text is the right scope. Glosses and hotspot meanings are not part of what is signed.
- Any change to reviewed text should remove the sign-off, and an author accepts that this means asking for a new review.
- A class is reached by a link that carries the scenario text. Teachers accept that the scene file is not part of the link and that each learner's computer needs the file in `media/<id>/` for the scene to show. The conversation works without it.
- Links up to about 8000 characters are fine to share. Longer scenarios need the file route.
