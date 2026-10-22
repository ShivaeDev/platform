function task(id: string, fields: string) {
	return `---\nid: ${id}\nkind: task\n${fields}\n---\n# ${id}\n\nKeep this body.  \n`;
}
export const migrationReplacementFixture = {
	"already.md": task("old.already", "status: dropped"),
	"comma.md": task("old.comma", "status: dropped\nnext_action: Superseded by task.current, task.other, which."),
	"current.md": task(
		"task.current",
		"status: ready\nrelationships:\n  - kind: relates_to # keep this comment\n    target: task.other\n  - kind: replaces\n    target: old.already",
	),
	"done.md": task("old.done", "status: done\nnext_action: Folded into task.current"),
	"dropped.md": task("old.dropped", "status: dropped\nnext_action: Superseded by `task.current`"),
	"field.md": task("old.field", "status: dropped\nreplaced_by: task.other"),
	"legacy.md": task("old.legacy", "status: superseded\nsuperseded_by: task.current"),
	"multiple.md": task("old.multiple", "status: done\nnext_action: Superseded by `task.current` and task.other."),
	"other.md": task("task.other", "status: ready"),
	"prose-pr.md": task("old.pr", "status: dropped\nnext_action: Superseded by task.current, PR 123 tracks it."),
	"prose-the.md": task("old.the", "status: dropped\nnext_action: Superseded by task.current, the release observer."),
	"prose-which.md": task("old.which", "status: dropped\nnext_action: Superseded by task.current, which handles releases."),
	"superseded.md": task("old.superseded", "status: superseded\nnext_action: Replaced by task.current."),
	"unknown.md": task("old.unknown", "status: dropped\nnext_action: Superseded by task.missing"),
	"unnamed.md": task("old.unnamed", "status: dropped\nnext_action: Work stopped."),
	"which.md": task("which", "status: ready"),
};
