function task(id: string, fields: string) {
	return `---\nid: ${id}\nkind: task\n${fields}\n---\n# ${id}\n\nKeep this body.  \n`;
}
export const migrationReplacementFixture = {
	"already.md": task("old.already", "status: dropped"),
	"current.md": task(
		"task.current",
		"status: ready\nrelationships:\n  - kind: relates_to # keep this comment\n    target: task.other\n  - kind: replaces\n    target: old.already",
	),
	"dropped.md": task("old.dropped", "status: dropped\nnext_action: Superseded by `task.current`"),
	"field.md": task("old.field", "status: dropped\nreplaced_by: task.other"),
	"legacy.md": task("old.legacy", "status: superseded\nsuperseded_by: task.current"),
	"other.md": task("task.other", "status: ready"),
	"superseded.md": task("old.superseded", "status: superseded\nnext_action: Replaced by task.current."),
	"unknown.md": task("old.unknown", "status: dropped\nnext_action: Superseded by task.missing"),
	"unnamed.md": task("old.unnamed", "status: dropped\nnext_action: Work stopped."),
};
