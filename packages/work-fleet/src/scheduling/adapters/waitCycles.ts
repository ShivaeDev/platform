export const WAIT_CYCLE = "Stuck: wait cycle: ";

interface WaitNode {
	readonly item: string;
	readonly mergePrs?: readonly string[] | undefined;
	readonly pr?: string | undefined;
	readonly reason?: string | undefined;
	readonly repairing?: boolean | undefined;
	readonly sweepItem?: string | undefined;
	readonly waiting: boolean;
}

export function waitGroups(records: Iterable<WaitNode>): readonly (readonly WaitNode[])[] {
	const nodes = [...records];
	const byId = new Map(nodes.filter((record) => record.waiting).map((record) => [record.item, record]));
	const byPr = new Map(nodes.filter((record) => record.pr !== undefined).map((record) => [record.pr, record.item]));
	const edges = new Map(
		[...byId.values()].map((record) => {
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
	const indices = new Map<string, number>();
	const low = new Map<string, number>();
	const stack: string[] = [];
	const active = new Set<string>();
	const groups: WaitNode[][] = [];
	function visit(id: string) {
		const index = indices.size;
		indices.set(id, index);
		low.set(id, index);
		stack.push(id);
		active.add(id);
		for (const next of edges.get(id) ?? []) {
			connect(id, next, index);
		}
		if (low.get(id) !== index) {
			return;
		}
		const members = popMembers(id);
		if (members.length > 1 || edges.get(id)?.includes(id)) {
			groups.push(
				members
					.sort((left, right) => left.localeCompare(right))
					.flatMap((key) => {
						const node = byId.get(key);
						return node === undefined ? [] : [node];
					}),
			);
		}
	}
	function connect(id: string, next: string, index: number) {
		if (!indices.has(next)) {
			visit(next);
			low.set(id, Math.min(low.get(id) ?? index, low.get(next) ?? index));
		} else if (active.has(next)) {
			low.set(id, Math.min(low.get(id) ?? index, indices.get(next) ?? index));
		}
	}
	function popMembers(id: string) {
		const members: string[] = [];
		let member: string | undefined;
		do {
			member = stack.pop();
			if (member !== undefined) {
				active.delete(member);
				members.push(member);
			}
		} while (member !== id);
		return members;
	}
	for (const id of byId.keys()) {
		if (!indices.has(id)) {
			visit(id);
		}
	}
	return groups;
}

export function waitCycles(records: Iterable<WaitNode>): ReadonlyMap<string, { readonly attentionOwner: "orchestrator"; readonly blocker: string }> {
	const cycles = new Map<string, { readonly attentionOwner: "orchestrator"; readonly blocker: string }>();
	for (const group of waitGroups(records)) {
		const first = group[0];
		const repairable = group.some((node) => node.repairing && /^waiting for area .+ held by /u.test(node.reason ?? ""));
		if (first === undefined || repairable) {
			continue;
		}
		cycles.set(first.item, {
			attentionOwner: "orchestrator",
			blocker: `${WAIT_CYCLE}${[...group, first].map((node) => (node.pr === undefined ? node.item : `${node.item} (${node.pr})`)).join(" -> ")}`,
		});
	}
	return cycles;
}
