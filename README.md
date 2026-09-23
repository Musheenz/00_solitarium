# Lab_Base — prototyping template

Never build a game in here. Copy the whole folder, rename it, edit
`EXPERIMENT_NUMBER` / `EXPERIMENT_NAME` in `base/autoload/lab.gd`, go.

## Starting a new experiment
1. Copy `Lab_Base/` -> `NN_ExperimentName/` (keeps the godot_ai addon and all settings).
2. Open it in Godot, edit the two constants in `lab.gd`.
3. Add an entry to `_LOG.md`.
4. Build in `res://experiments/` (or anywhere) — `res://base/` is the shared toolkit, tear it up if the idea needs it.

## What's in the box
- `base/autoload/lab.gd` — **Lab** singleton. Restart / slow-mo / pause / debug hotkeys, `Lab.say()` on-screen log,
  stick-first input helpers (`get_move_input`, `get_look_input`, `curve_stick`, `move_to_world`).
  Anything can pull input from here: a character, a ship, a cursor, a card hand.
- `base/player/` — capsule CharacterBody3D. Camera-relative, analog walk, coyote time, jump buffer,
  variable jump, jump defined by height + time-to-apex. All exports tweakable live.
- `base/camera/` — orbit rig (Yaw > Pitch > SpringArm3D > Camera3D). Right stick with response curve,
  mouse look, wall collision, smooth follow, `cam_reset` snaps behind the player.
- `base/greybox/` — arena with fixed yardsticks: steps 0.5–3.0m, gaps 2–6m (from a 1m platform),
  a 4m wall, pillars for camera occlusion, a 20° ramp, a stair tower to 8m, red posts every 10m.
- `base/debug/` — overlay: fps, time scale, gamepad name, player stats, `Lab.say()` log.

## Input map (keyboard / gamepad)
| action | keyboard | pad |
|---|---|---|
| move_* | WASD | left stick |
| look_* | arrows | right stick |
| jump | Space | A |
| crouch | Ctrl | B |
| interact | E | X |
| action_alt | F | Y |
| action_primary | LMB | RT |
| action_secondary | RMB | LT |
| bumper_left / right | Q / Tab | LB / RB |
| sprint | Shift | L3 |
| cam_reset | C | R3 |
| pause | Esc | Start |
| lab_restart | R | Back |
| lab_debug | F1 | D-pad up |
| lab_slowmo | F2 | D-pad down |

Left-click captures the mouse; Esc (pause) releases it.
