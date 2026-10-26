import type { Item } from "./items.ts";

export function goalTasks(items: readonly Item[], goal: string): readonly Item[] {
	const goals = new Set([goal]);
	const tasks = new Map<string, Item>();
	function collect(id: string) {
		for (const item of items) {
			const fields = item.document.parsed.fields;
			if (!fields.relationships?.some((link) => link.kind === "implements" && link.target.split("#")[0] === id)) {
				continue;
			}
			if (fields.kind === "task" && fields.status !== "dropped") {
				tasks.set(item.id, item);
			}
			if (fields.kind === "goal" && fields.status !== "dropped" && !goals.has(item.id)) {
				goals.add(item.id);
				collect(item.id);
			}
		}
	}
	collect(goal);
	return [...tasks.values()];
}
