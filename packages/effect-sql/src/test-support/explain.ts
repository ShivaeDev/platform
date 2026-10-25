import type { SqlClient } from "effect/sql";

interface Plan {
	readonly "Actual Loops": number;
	readonly "Actual Rows": number;
	readonly "Node Type": string;
	readonly Plans?: readonly Plan[];
	readonly "Relation Name"?: string;
}

export function explain(sql: SqlClient.SqlClient, statement: readonly [string, readonly unknown[]]) {
	return sql.unsafe<{ readonly "QUERY PLAN": readonly { readonly Plan: Plan }[] }>(`EXPLAIN (ANALYZE, FORMAT JSON) ${statement[0]}`, statement[1]);
}

export function planNodes(plan: Plan): readonly Plan[] {
	return [plan, ...(plan.Plans ?? []).flatMap(planNodes)];
}
