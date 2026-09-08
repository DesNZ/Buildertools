# Chippy PWA

A clean, self-contained Vue PWA for metric construction calculations and scaled drafting-style diagrams.

## Run with Docker

```bash
docker compose up --build -d
```

Then open:

```text
http://localhost:8080
```

## Included calculators

- Concrete: slabs, strip footings, post holes, circular slabs, concrete stairs, kerb/gutter, square and round columns
- Gravel
- Soil
- Asphalt
- Stairs
- Roof Pitch & Rafter
- Raked Wall
- Baluster Spacing
- Decking, including last-board rip width
- Fence Pickets
- Wainscoting
- Check Square
- Diagonal
- General Triangle: SSS, SAS, ASA/AAS and SSA
- Right Triangle
- Dumpy Level
- Equal Spacing
- Running Measurements
- Arc
- Slope & Fall
- Linear Cut List

## App design

- Metric-only
- Fully client-side calculations
- No API or database
- Offline PWA support
- Live scaled construction diagrams
- Drafting-style dimension lines and labels
- Favourites and calculation history stored locally in the browser

## Notes

Post-hole concrete subtracts the embedded post displacement by default. The post-hole diagram also shows undisturbed soil below the concrete for clarity.

The diagrams are calculation aids, not engineering drawings. Verify critical structural dimensions and applicable building-code requirements before construction.
