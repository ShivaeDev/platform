import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import { fleetDeliverable } from "#board/fleetField.ts";

export function briefEditPrompt(previous: string | undefined, current: string, brief = current): string {
	const before = boardApi.metadataParse(previous ?? "");
	const after = boardApi.metadataParse(current);
	const criteria = new Map((before.fields.criteria ?? []).map(({ id, text }) => [id, text]));
	const next = new Map((after.fields.criteria ?? []).map(({ id, text }) => [id, text]));
	const changes = [...new Set([...criteria.keys(), ...next.keys()])].flatMap((id) =>
		criteria.get(id) === next.get(id) ? [] : [`Criterion ${id}: ${criteria.get(id) ?? "(added)"} -> ${next.get(id) ?? "(removed)"}`],
	);
	if (before.body !== after.body) {
		changes.push(...bodyChanges(before.body, after.body));
	}
	for (const field of ["kind", "relationships"] as const) {
		if (JSON.stringify(before.fields[field]) !== JSON.stringify(after.fields[field])) {
			changes.push(`The ${field} changed.`);
		}
	}
	if (fleetDeliverable(before) !== fleetDeliverable(after)) {
		changes.push("The deliverable changed.");
	}
	return ["Fleet approved an edited brief. Apply this correction to your running work.", "What changed:", ...changes, "Full new brief:", brief].join(
		"\n\n",
	);
}

function bodyChanges(before: string, after: string): readonly string[] {
	const removed = before.split("\n");
	const added = after.split("\n");
	while (removed.length > 0 && added.length > 0 && removed[0] === added[0]) {
		removed.shift();
		added.shift();
	}
	while (removed.length > 0 && added.length > 0 && removed.at(-1) === added.at(-1)) {
		removed.pop();
		added.pop();
	}
	return [`Previous title/body excerpt:\n${removed.join("\n") || "(empty)"}`, `New title/body excerpt:\n${added.join("\n") || "(empty)"}`];
}
