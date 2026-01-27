# ev-drill-trainer — Requirements

Created: 2026-01-27T21:50:26Z
Updated: 2026-01-27T21:54:00Z

## Project Description
Build a web app (Next.js + TypeScript) that drills poker decision points (spots) and grades every user action by EV loss vs a solver strategy baseline. Opponents act by sampling from solver mixed frequencies. Must integrate an open-source solver via an adapter (service/WASM/hybrid to be decided), cache solver outputs by canonical node hash, and use deterministic RNG seeding. Must not copy GTOWizard UI/text/assets/branding/datasets. Modes: Spot Quiz, Hand Play, Review/Mistakes by EV loss, Targeted Drill. Toggles: preflop/postflop, streets, positions, stack depth presets, board buckets, tree restrictions, feedback verbosity.

## 1. Training Modes
- When the user selects Spot Quiz mode, the system shall present a single decision point and require a single action selection before proceeding.
- When the user selects Hand Play mode, the system shall present a sequential series of decision points for one hand until terminal action is reached.
- When the user selects Review/Mistakes mode, the system shall present previously graded decisions ordered by highest EV loss first.
- When the user selects Targeted Drill mode, the system shall generate decision points matching the active configuration toggles.
- When the user switches modes, the system shall preserve the current configuration toggles unless the user changes them.

## 2. Decision Grading
- When the user selects an action, the system shall grade the action by EV loss relative to the solver strategy baseline for the current node.
- When the solver baseline indicates multiple actions, the system shall calculate EV loss using the baseline EV for the optimal action at that node.
- When a decision is graded, the system shall store the EV loss value with the decision record.
- When the user reviews a decision, the system shall display the EV loss value as the primary performance metric.
- When secondary metrics are shown, the system shall ensure they do not override the EV loss ranking or grading.

## 3. Opponent Policy Execution
- When an opponent action is required, the system shall sample the opponent action from the solver mixed frequencies for the current node.
- When sampling opponent actions, the system shall use a deterministic RNG seed provided by the session configuration.
- When the same seed and configuration are used, the system shall reproduce the same sequence of opponent actions.

## 4. Solver Integration
- The system shall integrate an open-source solver through an adapter that can be implemented as a service, WASM module, or hybrid approach.
- When the system requests solver output for a node, the system shall use a canonical node hash to identify that node.
- When solver output for a canonical node hash exists in cache, the system shall reuse the cached output.
- When solver output for a canonical node hash is not in cache, the system shall request solver output and store it in cache under that hash.

## 5. Configuration Toggles
- When the user sets preflop/postflop toggles, the system shall restrict generated decision points to the selected phases.
- When the user selects streets, the system shall restrict generated decision points to the selected streets.
- When the user selects positions, the system shall restrict generated decision points to the selected positions.
- When the user selects stack depth presets, the system shall restrict generated decision points to the selected stack depths.
- When the user selects board buckets, the system shall restrict generated decision points to the selected board categories.
- When the user applies tree restrictions, the system shall restrict generated decision points to trees consistent with those restrictions.
- When the user sets feedback verbosity, the system shall adjust the detail level of displayed feedback accordingly.

## 6. Review and Progress Tracking
- When a decision is graded, the system shall add it to a review queue with its EV loss value.
- When the user views review progress, the system shall summarize performance using EV loss as the primary metric.
- When the user filters review items, the system shall allow filtering by mode, phase, street, position, and stack depth.

## 7. UI/Content Originality
- The system shall not include GTOWizard proprietary UI, text, assets, branding, datasets, or solver outputs.
- When presenting labels, explanations, or visuals, the system shall use original content created for this product.

## 8. Platform and Compatibility
- The system shall be delivered as a web application using Next.js (App Router), TypeScript, and Tailwind CSS.
- When users access the system from modern desktop or mobile browsers, the system shall render the training flow and grading feedback.

## Status
Requirements generated (pending review).
