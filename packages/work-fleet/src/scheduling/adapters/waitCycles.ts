export const WAIT_CYCLE = "Stuck: wait cycle: ";

interface WaitNode {
	readonly item: string;
	readonly mergePrs?: readonly string[] | undefined;
	readonly pr?: string | undefined;
	readonly reason?: string | undefined;
	readonly sweepItem?: string | undefined;
	readonly waiting: boolean;
}

export function waitCycles(records: Iterable<WaitNode>): ReadonlyMap<string, { readonly attentionOwner: "orchestrator"; readonly blocker: string }> {
	const nodes = [...records];
	const waiting = nodes.filter((record) => record.waiting);
	const byId = new Map(waiting.map((record) => [record.item, record]));
	const byPr = new Map(nodes.filter((record) => record.pr !== undefined).map((record) => [record.pr, record.item]));
	const edges = new Map(
		waiting.map((record) => {
			const areaOwner = /^waiting for area .+ (?:held by|queued ahead by) (?<owner>.+)$/u.exec(record.reason ?? "")?.groups?.owner;
			return [
				record.item,
				[
					...(areaOwner === undefined ? [] : [areaOwner]),
					...(record.sweepItem === undefined ? [] : [record.sweepItem]),
					...(record.mergePrs?.flatMap((pr) => {
						const id = byPr.get(pr);
						return id === undefined ? [] : [id];
					}) ?? []),
				].filter((id) => byId.has(id)),
			];
		}),
	);
	const reasons = new Map<string, string>();
	const visited = new Set<string>();
	function visit(id: string, path: readonly string[]): string | undefined {
		const index = path.indexOf(id);
		if (index !== -1) {
			return `${WAIT_CYCLE}${[...path.slice(index), id]
				.map((member) => {
					const pr = byId.get(member)?.pr;
					return pr === undefined ? member : `${member} (${pr})`;
				})
				.join(" -> ")}`;
		}
		if (visited.has(id)) {
			return reasons.get(id);
		}
		visited.add(id);
		for (const next of edges.get(id) ?? []) {
			const reason = visit(next, [...path, id]);
			if (reason !== undefined) {
				reasons.set(id, reason);
				return reason;
			}
		}
		return undefined;
	}
	for (const record of waiting) {
		visit(record.item, []);
	}
	return new Map([...reasons].map(([id, blocker]) => [id, { attentionOwner: "orchestrator", blocker }]));
}
