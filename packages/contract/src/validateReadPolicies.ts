import { Context, Effect, Option } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { MissingReadPolicies } from "#readPolicyErrors.ts";
import { ChangesQueries, QueryDefinition } from "#serverMetadata.ts";

export const validateReadPolicies = Effect.fnUntraced(function* <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	const missing = new Set<string>();
	for (const rpc of group.requests.values()) {
		const query = Context.getOption(rpc.annotations, QueryDefinition);
		if (Option.isSome(query) && query.value.definition.readPolicy === undefined) {
			missing.add(rpc._tag);
		}
		const changes = Context.getOption(rpc.annotations, ChangesQueries);
		if (Option.isSome(changes)) {
			for (const definition of changes.value.queries) {
				if (definition.readPolicy === undefined) {
					missing.add(`${rpc._tag.slice(0, -"$changes".length)}${definition.name}`);
				}
			}
		}
	}
	if (missing.size > 0) {
		const queries = [...missing].sort((left, right) => left.localeCompare(right));
		return yield* new MissingReadPolicies({ message: `Declare a readPolicy on queries: ${queries.join(", ")}`, queries });
	}
});
