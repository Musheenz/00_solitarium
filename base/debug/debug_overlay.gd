extends CanvasLayer
## LAB debug overlay. Shows experiment tag, fps, time scale, gamepad,
## whatever the player reports via get_debug_lines(), and the last few
## Lab.say() messages. Toggle with lab_debug (F1 / D-pad Up).

@onready var label: Label = $Panel/VBox/Stats
@onready var log_label: Label = $Panel/VBox/Log

var _log: PackedStringArray = []
var _player: Node


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	visible = Lab.debug_visible
	Lab.debug_toggled.connect(func(v: bool) -> void: visible = v)
	Lab.message.connect(_on_message)


func _on_message(text: String) -> void:
	_log.append(text)
	while _log.size() > 6:
		_log.remove_at(0)
	log_label.text = "\n".join(_log)


func _process(_delta: float) -> void:
	if not visible:
		return
	if _player == null or not is_instance_valid(_player):
		var players := get_tree().get_nodes_in_group("player")
		_player = players[0] if players.size() > 0 else null

	var lines := PackedStringArray()
	lines.append("EXP #%d  %s" % [Lab.EXPERIMENT_NUMBER, Lab.EXPERIMENT_NAME])
	var state := ""
	if Lab.paused:
		state = "  PAUSED"
	elif Lab.slowmo:
		state = "  SLOW-MO"
	lines.append("fps %d   time x%.2f%s" % [Engine.get_frames_per_second(), Engine.time_scale, state])
	lines.append("pad: %s" % Lab.gamepad_name())
	if _player and _player.has_method("get_debug_lines"):
		lines.append_array(_player.get_debug_lines())
	lines.append("")
	lines.append("F1 debug   F2 slowmo   R restart   Esc pause   C cam")
	label.text = "\n".join(lines)
