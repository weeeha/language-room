# Synthetic session, lisbon-cafe-pt, 2026-11-21

Synthetic stand-in. The learner voice is the macOS voice Joana, not a person. No fluent speaker has reviewed this sheet. It does not satisfy the real-input test in spec section 8.

## Providers

- Language model (character, analyzer, reviewer, recap): gemma-4-E4B-it-Q8_0.gguf, local, through the proxy
- Speech to text: whisper.cpp via /api/stt/local
- Learner voice: macOS say -v Joana
- Character speech: none (no-audio stand-in). Latency below is time to first text, not to first audio.
- Level: A2

## Machine summary

- Scripted errors caught with the expected correction: 2 of 3
- Scripted errors missed: 1
- Corrections shown on lines without a scripted error: 0
- Other corrections shown on lines with a scripted error: 0
- Learner lines where the heard text differs from the script: 1 of 7
- Median latency: 1087 ms
- Steps done: greet, order. End reason: learner
- Loop errors: 0

- l2 (gender article): scripted "Queria uma café e um pastel de nata, por favor.", expected correction "um café", caught
- l4 (verb form): scripted "Eu não sabe quanto custa o galão.", expected correction "sei", caught
- l5 (missing contraction): scripted "Gosto muito de o café daqui.", expected correction "do café", missed, because the heard text is not the scripted line

These numbers come from a model-checked script, not from a person. A shown correction counts as wrong here only when it sits on a line the script made correct. The fluent reviewer decides what is right.

## Session, turn by turn

### Character line 1, greeting

> Bom dia! O que gostaria de tomar hoje?

- 4.0 words per sentence
- Latency: not measured for the greeting

### Learner line (l1)

- Scripted: Bom dia.
- Heard: Bom dia.
- Corrections shown: none
- Issues held or not shown: none

### Character line 2

> Um café e um pastel de nata, por favor.

- 9.0 words per sentence
- Latency: 937 ms

### Learner line (l2)

- Scripted: Queria uma café e um pastel de nata, por favor. (scripted error: gender article, expected "um café")
- Heard: Queria uma café e um pastel de nata, por favor.
- Corrections shown:
  - "uma café" to "um café" (grammar). Rule: Gender agreement. Café is a masculine noun in Portuguese, requiring the article 'um'.
- Issues held or not shown: none

### Character line 3

> Aqui está o seu café e o seu pastel. Mais alguma coisa?

- 6.0 words per sentence
- Latency: 1409 ms

### Learner line (l3)

- Scripted: Sim, é tudo. Quanto é?
- Heard: Sim, é tudo. Quanto é?
- Corrections shown: none
- Issues held or not shown: none

### Character line 4

> Quer a conta, por favor?

- 5.0 words per sentence
- Latency: 1890 ms

### Learner line (l4)

- Scripted: Eu não sabe quanto custa o galão. (scripted error: verb form, expected "sei")
- Heard: Eu não sabe quanto custa o galão.
- Corrections shown:
  - "sabe" to "sei" (grammar). Rule: Verb conjugation (saber). The correct conjugation for 'Eu' is 'sei', not 'sabe'.
- Issues held or not shown: none

### Character line 5

> O galão custa um euro e sessenta.

- 7.0 words per sentence
- Latency: 1473 ms

### Learner line (l5)

- Scripted: Gosto muito de o café daqui. (scripted error: missing contraction, expected "do café")
- Heard: Gosto muito de um café daqui. **(differs from the script)**
- Corrections shown: none
- Issues held or not shown:
  - "Gosto muito de" to "Queria" (register), verdict incorrect. The phrase is grammatically correct, although 'Queria' is more appropriate for making an order.

### Character line 6

> Fico feliz que goste. Quer pagar agora?

- 3.5 words per sentence
- Latency: 1087 ms

### Learner line (l6)

- Scripted: A conta, por favor. Obrigado.
- Heard: A conta? Por favor. Obrigado.
- Corrections shown: none
- Issues held or not shown: none

### Character line 7

> Aqui está a conta. Muito obrigada pela visita!

- 4.0 words per sentence
- Latency: 599 ms

### Learner line (l7)

- Scripted: Bom dia.
- Heard: Bom dia.
- Corrections shown: none
- Issues held or not shown: none

### Character line 8

> Bom dia! O que gostaria de tomar hoje?

- 4.0 words per sentence
- Latency: 334 ms

## Latency

Per reply (ms): 937, 1409, 1890, 1473, 1087, 599, 334
Median: 1087 ms

## End

Steps done: greet, order
End reason: learner

## Recap

### Phrases used

- Bom dia
- Quanto é?
- A conta, por favor

### Mistakes

- "Queria uma café e um pastel de nata, por favor." to "Queria um café e um pastel de nata, por favor." (rule: Gender agreement). Café is a masculine noun in Portuguese, requiring the article 'um'.
- "Eu não sabe quanto custa o galão." to "Eu não sei quanto custa o galão." (rule: Verb conjugation (saber)). The correct conjugation for 'Eu' is 'sei', not 'sabe'.

### Practise

1. Queria um café, por favor (unmet-target). Why: Use this to politely order something. Example: Eu queria um pão, por favor
2. Bom dia (target). Why: Say this when greeting someone in the morning. Example: Bom dia, como está
3. A conta, por favor (target). Why: Ask for the bill when you are finished eating. Example: A conta, por favor

Summary: 7 learner lines, 2 of 3 steps.

## Review sheet for a fluent European Portuguese speaker

Mark one box per row. Leave a box empty when unsure and write a note.

### Shown corrections

| # | Learner said | Correction shown | Right | Wrong | Note |
|---|---|---|---|---|---|
| 1 | Queria uma café e um pastel de nata, por favor. | uma café to um café |  |  |  |
| 2 | Eu não sabe quanto custa o galão. | sabe to sei |  |  |  |

### Character lines

| # | Line | Natural | Not natural | Error found |
|---|---|---|---|---|
| 1 | Bom dia! O que gostaria de tomar hoje? |  |  |  |
| 2 | Um café e um pastel de nata, por favor. |  |  |  |
| 3 | Aqui está o seu café e o seu pastel. Mais alguma coisa? |  |  |  |
| 4 | Quer a conta, por favor? |  |  |  |
| 5 | O galão custa um euro e sessenta. |  |  |  |
| 6 | Fico feliz que goste. Quer pagar agora? |  |  |  |
| 7 | Aqui está a conta. Muito obrigada pela visita! |  |  |  |
| 8 | Bom dia! O que gostaria de tomar hoje? |  |  |  |

### Recap items

| Item | Text | Accurate | Not accurate | Note |
|---|---|---|---|---|
| Phrase used | Bom dia |  |  |  |
| Phrase used | Quanto é? |  |  |  |
| Phrase used | A conta, por favor |  |  |  |
| Mistake | Queria uma café e um pastel de nata, por favor. to Queria um café e um pastel de nata, por favor. (Gender agreement) |  |  |  |
| Mistake | Eu não sabe quanto custa o galão. to Eu não sei quanto custa o galão. (Verb conjugation (saber)) |  |  |  |
| Practise | Queria um café, por favor, example: Eu queria um pão, por favor |  |  |  |
| Practise | Bom dia, example: Bom dia, como está |  |  |  |
| Practise | A conta, por favor, example: A conta, por favor |  |  |  |

### Anything the app missed



Reviewer name and date:

## What task 21 could and could not check here

- Checked by hand by the controller: the scene path in the browser with the sample room, not the cafe. The overlays, the failed state and the signage notice were seen there.
- Not checked: the latency comparison with and without the scene. It needs a real browser session with the cafe scene, which needs the paid scene export. Not done.
- This synthetic run has no scene at all, so its latency says nothing about the scene.
