extends CharacterBody3D
## LAB base 3D character controller. Camera-relative, stick-first, tuned by feel.
##
## Jump is defined in designer units — HEIGHT and TIME TO APEX — and gravity /
## takeoff velocity are derived from them. Change the two numbers, the arc
## follows. Every export can be tweaked live while the game runs.
##
## Swap this out freely per experiment. It's a starting point, not a rule.

@export_group("Ground")
@export var walk_speed := 6.0
@export var sprint_speed := 10.0
@export var ground_accel := 45.0
@export var ground_decel := 60.0
@export var turn_speed := 14.0 ## how fast the visual rotates to face movement

@export_group("Air")
@export var jump_height := 2.0
@export var time_to_apex := 0.38
@export var fall_gravity_mult := 1.7 ## heavier on the way down = snappier feel
@export var jump_cut_mult := 0.45 ## release jump early -> velocity.y *= this
@export var coyote_time := 0.12
@export var jump_buffer := 0.12
@export var air_accel := 18.0
@export var air_decel := 4.0
@export var max_fall_speed := 30.0

@export_group("Feel")
@export var stick_curve := 1.4 ## 1 = linear, higher = more precision near center
@export var analog_walk := true ## half stick = half speed
@export var enabled := true
@export var kill_y := -25.0 ## fall below this -> restart

var gravity := 0.0
var jump_velocity := 0.0

var _coyote := 0.0
var _buffer := 0.0
var _jumping := false

@onready var visual: Node3D = $Visual


func _ready() -> void:
	add_to_group("player")
	_recalc_jump()


func _recalc_jump() -> void:
	gravity = 2.0 * jump_height / (time_to_apex * time_to_apex)
	jump_velocity = gravity * time_to_apex


func _physics_process(delta: float) -> void:
	if not enabled:
		return
	_recalc_jump() # cheap — lets you tune jump_height/time_to_apex while running

	var on_floor := is_on_floor()

	# --- timers -----------------------------------------------------------
	_coyote = coyote_time if on_floor else maxf(_coyote - delta, 0.0)
	if Input.is_action_just_pressed("jump"):
		_buffer = jump_buffer
	else:
		_buffer = maxf(_buffer - delta, 0.0)

	# --- vertical ---------------------------------------------------------
	if on_floor:
		_jumping = false
		if velocity.y < 0.0:
			velocity.y = 0.0
	else:
		var g := gravity * (fall_gravity_mult if velocity.y < 0.0 else 1.0)
		velocity.y = maxf(velocity.y - g * delta, -max_fall_speed)

	if _buffer > 0.0 and _coyote > 0.0:
		velocity.y = jump_velocity
		_buffer = 0.0
		_coyote = 0.0
		_jumping = true

	if _jumping and velocity.y > 0.0 and Input.is_action_just_released("jump"):
		velocity.y *= jump_cut_mult

	# --- horizontal -------------------------------------------------------
	var move := Lab.curve_stick(Lab.get_move_input(), stick_curve)
	var cam := get_viewport().get_camera_3d()
	var basis := cam.global_basis if cam else global_basis
	var wish := Lab.move_to_world(move, basis)
	var mag := wish.length()
	var has_input := mag > 0.001

	var dir := wish.normalized() if has_input else Vector3.ZERO
	var top_speed := sprint_speed if Input.is_action_pressed("sprint") else walk_speed
	var speed := 0.0
	if has_input:
		speed = top_speed * (minf(mag, 1.0) if analog_walk else 1.0)

	var target_vel := dir * speed
	var horiz := Vector3(velocity.x, 0.0, velocity.z)
	var rate: float
	if on_floor:
		rate = ground_accel if has_input else ground_decel
	else:
		rate = air_accel if has_input else air_decel
	horiz = horiz.move_toward(target_vel, rate * delta)
	velocity.x = horiz.x
	velocity.z = horiz.z

	# --- facing -----------------------------------------------------------
	if has_input:
		var target_yaw := atan2(-dir.x, -dir.z)
		visual.rotation.y = lerp_angle(visual.rotation.y, target_yaw, 1.0 - exp(-turn_speed * delta))

	move_and_slide()

	if global_position.y < kill_y:
		Lab.say("fell out of the world — restart")
		Lab.restart()


## Picked up by the debug overlay.
func get_debug_lines() -> PackedStringArray:
	var h := Vector2(velocity.x, velocity.z).length()
	return PackedStringArray([
		"speed %.2f   vy %.2f" % [h, velocity.y],
		"floor %s   coyote %.2f   buffer %.2f" % [is_on_floor(), _coyote, _buffer],
		"jump h %.1f  apex %.2fs  g %.1f  v0 %.1f" % [jump_height, time_to_apex, gravity, jump_velocity],
	])
