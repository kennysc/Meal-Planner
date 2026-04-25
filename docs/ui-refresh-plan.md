# UI Refresh Plan

## How To Use This File
- Work through tasks in order unless a dependency forces a different sequence.
- Tick each task as soon as it is complete.
- If a task changes scope, update this file before continuing.
- After each completed phase:
  - pause
  - ask for testing/validation
  - commit the finished phase
  - ask whether to keep going

## Execution Rules
- [ ] Tick completed tasks in this file immediately after finishing them.
- [ ] Pause after each phase and ask the user to test the changes.
- [ ] After feedback is addressed and the phase is accepted, create a git commit.
- [ ] After committing, ask whether to continue to the next phase.
- [ ] Do not start the next phase automatically if testing feedback is still pending.
- [ ] Keep changes consistent across desktop, tablet, and mobile.
- [ ] Prefer improving shared patterns over one-off fixes.
- [ ] Test keyboard-only behavior for every changed modal, tab, editor, picker, and action area.
- [ ] Prefer shared structure/classes/components when multiple flows need the same UI behavior.

---

## Phase 1: Responsive Layout Foundation
Goal: make the app behave predictably at phone, tablet, and desktop sizes.

- [x] Define 3 responsive tiers in CSS:
  - phone: `0-639px`
  - tablet: `640-1023px`
  - desktop: `1024px+`
- [x] Refactor the current `960px` breakpoint into the new 3-tier system.
- [x] Make the app header wrap gracefully instead of hiding overflow.
- [x] Rework header layout so title, week label, and utility controls remain usable at narrow widths.
- [x] Improve mobile tab bar behavior and spacing.
- [x] Make mobile tab navigation feel consistent with desktop navigation.
- [x] Adjust main layout so tablet does not collapse too aggressively into phone behavior.
- [x] Keep shopping, planner, recipes, and history usable across all 3 tiers.

### Pause / Test / Commit
- [x] Pause and ask the user to test Phase 1 across multiple screen sizes.
- [x] Address feedback from Phase 1 testing.
- [x] Commit Phase 1.
- [ ] Ask whether to continue.

---

## Phase 2: Shared Surface, Spacing, and Interaction System
Goal: make cards, panels, controls, and actions visually consistent.

- [x] Standardize spacing tokens for compact, regular, and spacious areas.
- [x] Standardize border radius usage for:
  - pills
  - controls
  - cards
  - modals
- [x] Standardize button hierarchy:
  - primary
  - secondary
  - ghost
  - icon
  - link/icon-link
- [x] Standardize focus, hover, active, and disabled states.
- [x] Align panel header spacing and typography across the app.
- [x] Make section titles, metadata, and support text visually consistent.

### Pause / Test / Commit
- [x] Pause and ask the user to test Phase 2.
- [x] Address feedback from Phase 2 testing.
- [x] Commit Phase 2.
- [ ] Ask whether to continue.

---

## Phase 3: Modal System Unification
Goal: make all modals behave and look like one system.

- [x] Define a shared modal structure:
  - header
  - optional subheader/meta
  - scrollable body
  - footer actions
- [x] Standardize modal widths by type:
  - small confirm
  - medium utility/picker
  - large editor
- [x] Standardize modal footer action order.
- [x] Ensure all modals have safe vertical scrolling.
- [x] Ensure no modal introduces horizontal scrolling.
- [x] Align close buttons, titles, and internal spacing across all modals.
- [x] Add modal accessibility basics consistently:
  - `role="dialog"`
  - `aria-modal="true"`
  - labelled title via `aria-labelledby` or equivalent
  - meaningful close button labels
- [x] Standardize keyboard behavior:
  - Escape closes dismissible modals
  - focus moves into the modal when opened
  - focus returns to the opener when closed when practical
  - tab navigation stays inside the active modal
- [x] Standardize backdrop behavior across modals; decide which flows close on backdrop click and keep it consistent.
- [x] Prevent background page scrolling while a modal is open.
- [x] Apply the shared modal pattern to:
  - recipe editor modal
  - settings modal
  - week picker modal
  - meal action modal
  - ingredient confirm modal
  - ingredient picker modal
- [x] Keep Phase 3 focused on the shared modal shell and behavior; leave flow-specific content polish for later phases unless needed for consistency.

### Pause / Test / Commit
- [x] Pause and ask the user to test Phase 3.
- [x] Address feedback from Phase 3 testing.
- [x] Commit Phase 3.
- [ ] Ask whether to continue.

---

## Phase 4: Planner Screen Refinement
Goal: make the planner clearer, more stable, and more responsive.

- [x] Standardize planner header layout across desktop and mobile planner views.
- [x] Improve planner grid spacing and alignment.
- [x] Make meal cards visually consistent in all states.
- [x] Improve empty meal tile treatment without adding placeholder text.
- [x] Ensure day labels and meal cards align cleanly in desktop view.
- [x] Improve mobile dinner/supper layouts so week context remains clear.
- [x] Verify planner interactions remain usable on touch and desktop.
- [x] Check tile hit areas and visual affordance for clickable meals.

### Pause / Test / Commit
- [x] Pause and ask the user to test Phase 4.
- [x] Address feedback from Phase 4 testing.
- [x] Commit Phase 4.
- [ ] Ask whether to continue.

---

## Phase 5: Recipes Screen Layout and Information Hierarchy
Goal: make recipe search, creation, and browsing consistent and scalable.

- [x] Redesign recipe toolbar into clearer visual groups.
- [x] Improve toolbar behavior on tablet and phone.
- [x] Rework recipe layout by breakpoint:
  - desktop: split form/list
  - tablet: more balanced or stacked layout
  - phone: stacked flow
- [x] Improve recipe card hierarchy:
  - title
  - supporting text
  - tags
  - ingredients
  - metadata
- [x] Ensure the add-recipe form and edit-recipe modal feel like the same editor.
- [x] Normalize section ordering and spacing between add/edit experiences.
- [x] Review favorite badge, metadata, and open-link placement for consistency.
- [x] Verify recipe empty, loading, error, locked/editable, and disabled states are visually clear.

### Pause / Test / Commit
- [x] Pause and ask the user to test Phase 5.
- [x] Address feedback from Phase 5 testing.
- [x] Commit Phase 5.
- [ ] Ask whether to continue.

---

## Phase 6: Dense Editor Cleanup
Goal: make tags, ingredients, and inline suggestions feel intentional and consistent.

- [ ] Standardize compact editing styles for:
  - ingredient table
  - inline tag editing
  - suggestion popovers
- [ ] Ensure ingredient table works at all screen sizes without overflow.
- [ ] Improve row spacing, readability, and focus handling in the ingredient table.
- [ ] Ensure remove controls align cleanly with rows.
- [ ] Review tag pill creation and removal behavior for consistency.
- [ ] Make suggestion popovers visually consistent across:
  - ingredient names
  - groups
  - tags
  - recipe-name suggestions if applicable
- [ ] Constrain popover width/height and prevent clipping at modal edges.
- [ ] Verify all inline editing patterns work in both editable and locked modes.
- [ ] Verify keyboard navigation and focus visibility for ingredient cells, tag editing, and suggestion selection.

### Pause / Test / Commit
- [ ] Pause and ask the user to test Phase 6.
- [ ] Address feedback from Phase 6 testing.
- [ ] Commit Phase 6.
- [ ] Ask whether to continue.

---

## Phase 7: Shopping, History, Settings, and Secondary Flows
Goal: bring the rest of the app up to the same consistency level.

- [ ] Improve shopping list row hierarchy and spacing.
- [ ] Make shopping interactions clearer on small screens.
- [ ] Add better visual affordance for drag/reorder if that behavior remains, and verify it works on touch devices.
- [ ] Improve history card hierarchy and active-state treatment.
- [ ] Polish settings modal content after it uses the unified modal pattern.
- [ ] Improve week picker density, spacing, responsiveness, and keyboard/touch selection.
- [ ] Polish ingredient confirm/picker modal content after they use the shared modal system.
- [ ] Verify shopping/history/settings/week picker empty, disabled, and error-adjacent states are understandable.

### Pause / Test / Commit
- [ ] Pause and ask the user to test Phase 7.
- [ ] Address feedback from Phase 7 testing.
- [ ] Commit Phase 7.
- [ ] Ask whether to continue.

---

## Final QA
- [ ] Test phone layout thoroughly.
- [ ] Test tablet layout thoroughly.
- [ ] Test desktop layout thoroughly.
- [ ] Test all modals for scrolling and action accessibility.
- [ ] Test keyboard-only navigation through tabs, modals, calendar, recipe editor, suggestions, and shopping actions.
- [ ] Test Escape/backdrop behavior and focus return for every modal.
- [ ] Test that the page behind modals does not scroll while a modal is open.
- [ ] Test planner, recipes, shopping, history, settings, and week picker flows.
- [ ] Verify visual consistency across buttons, inputs, pills, tables, cards, and modals.
- [ ] Verify French and English UI still fit correctly.
- [ ] Verify light/dark/accent contrast for text, buttons, focus rings, badges, selected tabs, and selected calendar days.
- [ ] Do a final polish pass for spacing, typography, and alignment.

### Final Pause / Test / Commit
- [ ] Pause and ask the user for final validation.
- [ ] Address final feedback.
- [ ] Create final commit for the UI refresh.
- [ ] Ask whether any follow-up UI polish should be done.
