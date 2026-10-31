import { Effect } from "effect";
import type { QueryEngine, Table } from "./queryEngine.ts";

interface PlanNode {
	readonly "Actual Loops": number;
	readonly "Actual Rows": number;
	readonly "Index Cond"?: string;
	readonly "Index Name"?: string;
	readonly "Node Type": string;
	readonly Plans?: readonly PlanNode[];
	readonly "Relation Name"?: string;
}

function planNodes(plan: PlanNode): readonly PlanNode[] {
	return [plan, ...(plan.Plans ?? []).flatMap(planNodes)];
}

export function queryPlan(engine: QueryEngine, table: Table, preferIndexes = false) {
	const explain = Effect.gen(function* () {
		const [statement] = engine.statements;
		if (statement === undefined) {
			return yield* Effect.die(new Error("Read rows before explaining the read"));
		}
		const [result] = yield* Effect.orDie(
			engine.sql.unsafe<{ readonly "QUERY PLAN": readonly { readonly Plan: PlanNode }[] }>(
				`explain (analyze, format json) ${statement[0]}`,
				statement[1],
			),
		);
		const nodes = planNodes(result?.["QUERY PLAN"][0]?.Plan ?? { "Actual Loops": 0, "Actual Rows": 0, "Node Type": "none" });
		return { nodes, scans: nodes.filter((node) => node["Relation Name"] === engine.tables[table] && node["Actual Loops"] > 0) };
	});
	return preferIndexes
		? engine.sql.withTransaction(engine.sql`set local enable_seqscan = off`.pipe(Effect.andThen(explain))).pipe(Effect.orDie)
		: explain;
}
