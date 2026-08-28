# Contributing

## The rule that matters most

**Never invent political or economic data.** If a source does not establish it, it does
not go in. An empty section that says "not yet supported" is a correct answer. A
plausible-looking fabricated candidate is not, and it is the specific failure this
project exists to avoid.

## Adding a policy

1. Add an entry to `pipeline/policies.py` with a parameter delta, an evidence status, at
   least one tier 1 or tier 2 source, and every assumption stated in plain English.
2. Run `npm run data` to regenerate the grid. Never hand-edit `src/data/grid.json`; CI
   will catch it.
3. Add a test asserting the effect for at least one household where you can derive the
   answer from statute independently.

If the effect is zero for every household in the covered range, the policy does not
belong in the catalogue yet — either extend the grid so it bites somewhere real, or leave
it out. A row that always reads $0 teaches the user nothing and looks like a bug.

## Separating fact from model

Keep these distinct in code and in copy:

- **Fact** — what the source explicitly establishes
- **Model** — what the engine computes from facts
- **Assumption** — what we assume, stated on the policy page
- **Forecast** — what we predict, always with lowered confidence

Blending them is the main way a tool like this becomes dishonest without anyone deciding
to lie.

## Precision

Match precision to evidence. Ranges over point estimates when the evidence is thin.
`format.ts` enforces the rounding; do not route around it.

## Interface

Keyboard reachable with visible focus. No meaning carried by colour alone. Readable at
375px. No red/blue partisan colour language anywhere — the palette is deliberately
neutral and should stay that way.

## Tests

`npm test` must pass. New calculation code needs a test that could actually fail. The
regression fixtures for distinct household types exist to enforce the product's core
claim — that different finances produce different answers — so do not weaken them to make
a build green. If a fixture fails, the more likely explanation is that the model is
wrong or the coverage is too narrow. That is what happened during the initial build:
a failing fixture correctly revealed that SALT cap repeal was worth zero to every
household in the original grid.
