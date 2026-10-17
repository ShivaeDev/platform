import type { BoardWork, Priority } from "#policy.ts";

export function boardWork(
	id: string,
	approved: Readonly<Record<string, string>>,
	revisions: ReadonlyMap<string, string> = new Map(),
	dependencies: ReadonlyMap<string, readonly string[]> = new Map(),
	areas: ReadonlyMap<string, readonly string[]> = new Map(),
	statuses: ReadonlyMap<string, string> = new Map(),
	priorities: ReadonlyMap<string, Priority> = new Map(),
): BoardWork {
	const priority = priorities.get(id);
	const revision = revisions.get(id) ?? `board-${id}`;
	return {
		approved: approved[id] === revision,
		areas: areas.get(id),
		context: `Work ${id}: ${revisions.get(id) ?? `board-${id}`}`,
		dependsOn: dependencies.get(id) ?? (id === "dependent" ? ["one"] : []),
		...(priority === undefined ? {} : { priority }),
		revision: revisions.get(id) ?? `board-${id}`,
		sourcePath: `board/${id}.md`,
		status: statuses.get(id),
		workId: id,
	};
}
