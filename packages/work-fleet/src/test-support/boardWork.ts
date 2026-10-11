import type { BoardWork } from "#policy.ts";

export function boardWork(
	id: string,
	approved: Readonly<Record<string, string>>,
	revisions: ReadonlyMap<string, string> = new Map(),
	dependencies: ReadonlyMap<string, readonly string[]> = new Map(),
): BoardWork {
	const revision = revisions.get(id) ?? `board-${id}`;
	return {
		approved: approved[id] === revision,
		context: `Work ${id}: ${revisions.get(id) ?? `board-${id}`}`,
		dependsOn: dependencies.get(id) ?? (id === "dependent" ? ["one"] : []),
		revision: revisions.get(id) ?? `board-${id}`,
		sourcePath: `board/${id}.md`,
		workId: id,
	};
}
