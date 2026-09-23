extends Node
## LAB — global helpers for every prototype. Autoloaded as "Lab".
##
## When you dupe Lab_Base for a new experiment, edit EXPERIMENT_NUMBER and
## EXPERIMENT_NAME below. The debug overlay shows them.
##
## Hotkeys (keyboard / gamepad):
##   lab_restart  R  / Back      reload current scene
##   lab_debug    F1 / D-pad Up  toggle debug overlay
##   lab_slowmo   F2 / D-pad Dn  toggle slow motion
##   pause        Esc / Start    pause (also frees the mouse)

const EXPERIMENT_NUMBER := 0
const EXPERIMENT_NAME := "Lab_Base"

signal debug_toggled(visible: bool)
signal message(text: String)

var debug_visible := true
var slowmo := false
var paused := false
var slowmo_scale := 0.25


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	print("=== LAB :: Experiment #%d — %s ===" % [EXPERIMENT_NUMBER, EXPERIMENT_NAME])


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("lab_restart"):
		restart()
	elif event.is_action_pressed("lab_debug"):
		debug_visible = not debug_visible
		debug_toggled.emit(debug_visible)
	elif event.is_action_pressed("lab_slowmo"):
		slowmo = not slowmo
		Engine.time_scale = slowmo_scale if slowmo else 1.0
	elif event.is_action_pressed("pause"):
		toggle_pause()


func restart() -> void:
	Engine.time_scale = 1.0
	slowmo = false
	paused = false
	get_tree().paused = false
	get_tree().reload_current_scene()


func toggle_pause() -> void:
	paused = not paused
	get_tree().paused = paused
	if paused:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


## Print + push a line to the debug overlay's message log. Great for
## "coin collected", "state -> WALLRUN", etc. while prototyping.
func say(text: String) -> void:
	print(text)
	message.emit(text)


# ---------------------------------------------------------------------------
# Input helpers — stick-first. Anything (a character, a ship, a cursor, a
# card hand) can pull input from here without owning its own input code.
# ---------------------------------------------------------------------------

## Left stick / WASD. x = right(+), y = forward(+). Radial deadzone from the
## action deadzones, length clamped to 1, magnitude preserved for analog walk.
func get_move_input() -> Vector2:
	return Input.get_vector("move_left", "move_right", "move_back", "move_forward")


## Right stick / arrow keys. x = right(+), y = up(+).
func get_look_input() -> Vector2:
	return Input.get_vector("look_left", "look_right", "look_down", "look_up")


## Response curve for a stick vector: keeps direction, curves magnitude.
## exponent 1.0 = linear, 2.0 = fine control near center, fast at the edge.
func curve_stick(v: Vector2, exponent: float) -> Vector2:
	var m := v.length()
	if m <= 0.0001:
		return Vector2.ZERO
	return (v / m) * pow(minf(m, 1.0), exponent)


## Turn a 2D move input into a world-space XZ direction relative to a camera
## (or any) basis. Result length matches the input length.
func move_to_world(move: Vector2, cam_basis: Basis) -> Vector3:
	var fwd := -cam_basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var right := cam_basis.x
	right.y = 0.0
	right = right.normalized()
	return right * move.x + fwd * move.y


func gamepad_name() -> String:
	var pads := Input.get_connected_joypads()
	if pads.size() > 0:
		return Input.get_joy_name(pads[0])
	return "no gamepad"
