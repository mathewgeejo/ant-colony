# Sandboxels parity checklist

Reference: official controls, checked 2026-11-14:
https://raw.githubusercontent.com/R74nCom/sandboxels/main/controls.txt
Reference application source identifies version 1.13.2:
https://github.com/R74nCom/sandboxels/blob/main/index.html

Checked means the stated basic action exists in this game. It does not certify identical semantics, every submenu, or catalog parity. Partial rows stay unchecked until their differences are resolved and verified.

## Main buttons, first pass

- [ ] Mobile Shift toggle: missing; touch cannot latch intensified tools or line mode.
- [x] Pause/play: implemented; browser checked.
- [x] Single step: implemented; browser checked.
- [x] Decrease brush size: implemented.
- [x] Increase brush size: implemented.
- [x] Reset canvas: implemented; browser checked, with additional Undo support.
- [x] Replace existing particles: implemented.
- [ ] Element selector: search works for our registry only; full catalog missing.
- [ ] Edit mode: selected-cell editor exists; not the complete reference editing toolkit.
- [ ] Element information: our material properties exist; reference catalog/reaction information is incomplete.
- [ ] Saves: local save/load and portable files work; reference formats and complete save-menu parity are missing.
- [ ] Mods: species JSON import is NOT a Sandboxels mod manager. Material/behavior mod support missing.
- [ ] Settings: our settings work; full reference settings parity has not been inventoried.

## Additional controls and interactions

- [x] TPS adjustment, bounded by simulation budget.
- [x] Fullscreen button; deployment permission behavior still requires manual verification.
- [x] Hide/restore interface; browser checked.
- [x] PNG capture; browser checked.
- [x] Held brush continuously places matter; browser checked.
- [x] Right-button erase and middle-button material pick.
- [x] Line drawing.
- [x] Stronger Heat/Cool/Shock with Shift.
- [ ] Shift behavior for Mix and Smash.
- [ ] Copy a particle's properties when picking.
- [ ] Secondary element and previous-element selection.
- [ ] Complete reference keyboard and wheel bindings: current wheel zoom and several keys differ.
- [ ] Normal/thermal/basic/streak/outline view parity: temperature exists, other overlays are different.
- [ ] Hide-canvas control (separate from hiding the interface).
- [ ] Image insertion through clipboard and file drop.
- [ ] Save insertion through clipboard and file drop.
- [ ] Quick-save/reload shortcuts and complete cancellation behavior.
- [ ] Extra manual element controls and every nested menu button: inventory still required.

## Elements and reactions — not complete

- [ ] Freeze an upstream revision for a reproducible catalog comparison.
- [ ] Inventory every built-in element, including hidden products and tools, by stable key/category.
- [ ] Map each key to an exact implementation, approximation, or missing entry.
- [ ] Inventory contact reactions, products, probabilities and temperature/charge conditions.
- [ ] Inventory phase transitions, combustion products, powered behavior and custom update rules.
- [ ] Implement missing entries and mechanics without substituting renamed generic materials.
- [ ] Verify reaction products, quantities, trigger conditions and absence of reactions when conditions fail.
- [ ] Verify browser selection, rendering, painting, persistence and performance for the expanded catalog.

Current game: 58 paintable materials plus air. Generic gravity, density, phase changes, fire, conduction, corrosion and explosions do NOT constitute full element or reaction parity. Existing 40 engine tests and 16 browser checks certify only their documented cases, not this entire checklist.

Preserve the user's meadow canvas and pixel controls. Do not run a packaging build without the user's instruction or a known build error. Read upstream licensing before incorporating source or assets; this checklist does not authorize copying the reference implementation.
