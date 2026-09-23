extends Node3D
## LAB base orbit camera. Right stick / mouse orbit, spring-arm wall
## collision, smooth follow, stick response curve.
##
## Tree:  CameraRig > Yaw > Pitch > SpringArm3D > Camera3D
##
## Follows `target` (falls back to the first node in group "player").
## cam_reset (C / R3) snaps behind the target's facing.
## Left-click captures the mouse; pause (Esc / Start) releases it.

@export var target: NodePath

@export_group("Follow")
@export var follow_speed := 14.0
@export var height_offset := 1.3
@export var arm_length := 5.5

@export_group("Orbit")
@export var yaw_speed_deg := 220.0
@export var pitch_speed_deg := 130.0
@export var stick_curve := 2.0 ## 2 = precise near center, fast at the rim
@export var invert_y := false
@export var pitch_min_deg := -70.0 ## camera high, looking down
@export var pitch_max_deg := 25.0 ## camera low, looking up
@export var default_pitch_deg := -18.0
@export var mouse_sens_deg := 0.12 ## degrees per pixel

@onready var yaw: Node3D = $Yaw
@onready var pitch: Node3D = $Yaw/Pitch
@onready var arm: SpringArm3D = $Yaw/Pitch/SpringArm3D
@onready var cam: Camera3D = $Yaw/Pitch/SpringArm3D/Camera3D

var _target: Node3D
var _mouse_delta := Vector2.ZERO


func _ready() -> void:
	add_to_group("camera_rig")
	top_level = true
	_target = get_node_or_null(target) as Node3D
	if _target == null:
		var players := get_tree().get_nodes_in_group("player")
		if players.size() > 0:
			_target = players[0] as Node3D
	pitch.rotation.x = deg_to_rad(default_pitch_deg)
	arm.spring_length = arm_length
	if _target:
		global_position = _target.global_position + Vector3.UP * height_offset
		if _target is CollisionObject3D:
			arm.add_excluded_object((_target as CollisionObject3D).get_rid())
		reset_behind_target()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
			_mouse_delta += (event as InputEventMouseMotion).relative
	elif event is InputEventMouseButton and event.is_pressed():
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED and not Lab.paused:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event.is_action_pressed("cam_reset"):
		reset_behind_target()


func _process(delta: float) -> void:
	# Camera stays responsive during slow-mo.
	var dt := delta / maxf(Engine.time_scale, 0.0001)

	if _target:
		var goal := _target.global_position + Vector3.UP * height_offset
		global_position = global_position.lerp(goal, 1.0 - exp(-follow_speed * dt))

	var look := Lab.curve_stick(Lab.get_look_input(), stick_curve) # x right, y up
	var yaw_delta := -look.x * deg_to_rad(yaw_speed_deg) * dt
	var pitch_delta := look.y * deg_to_rad(pitch_speed_deg) * dt

	yaw_delta += -_mouse_delta.x * deg_to_rad(mouse_sens_deg)
	pitch_delta += -_mouse_delta.y * deg_to_rad(mouse_sens_deg)
	_mouse_delta = Vector2.ZERO

	if invert_y:
		pitch_delta = -pitch_delta

	yaw.rotation.y += yaw_delta
	pitch.rotation.x = clampf(pitch.rotation.x + pitch_delta,
		deg_to_rad(pitch_min_deg), deg_to_rad(pitch_max_deg))


func reset_behind_target() -> void:
	if _target == null:
		return
	var vis := _target.get_node_or_null("Visual") as Node3D
	yaw.rotation.y = vis.global_rotation.y if vis else _target.global_rotation.y
	pitch.rotation.x = deg_to_rad(default_pitch_deg)


## Yaw-only basis: handy for "move relative to camera heading" without pitch.
func get_flat_basis() -> Basis:
	return yaw.global_basis
