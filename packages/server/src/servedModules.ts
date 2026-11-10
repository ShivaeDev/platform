import { Context, Effect, Option } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { DefinedModule } from "@shivaedev/contract/defineModule.ts";
import { ServedReadPolicy } from "@shivaedev/contract/servedReadPolicy.ts";
import { QueryDefinition } from "@shivaedev/contract/serverMetadata.ts";
import { HandWrittenModuleHandlers } from "#HandWrittenModuleHandlers.ts";

// Only the test-support helper for fakes provides it, so a production host never opts a module out of its generated handlers.
export class ReplacedModuleHandlers extends Context.Service<ReplacedModuleHandlers, string>()("@shivaedev/server/ReplacedModuleHandlers") {}

export const servedModules = Effect.fnUntraced(function* <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	const services = yield* Effect.context<never>();
	const handWritten = new Map<string, string[]>();
	for (const rpc of group.requests.values()) {
		const module = Context.getOption(rpc.annotations, DefinedModule);
		if (Option.isNone(module) || Option.isNone(Context.getOption(rpc.annotations, QueryDefinition))) {
			continue;
		}
		const handler = Context.getOption(services, Context.Service<Rpc.Handler<string>>(rpc.key));
		const generated = Option.exists(
			handler,
			({ context }) =>
				Option.isSome(Context.getOption(context, ServedReadPolicy))
				|| Option.contains(Context.getOption(context, ReplacedModuleHandlers), module.value),
		);
		if (!generated) {
			handWritten.set(module.value, [...(handWritten.get(module.value) ?? []), rpc._tag]);
		}
	}
	const [first] = [...handWritten].toSorted(([left], [right]) => left.localeCompare(right));
	if (first !== undefined) {
		const [module, queries] = first;
		return yield* new HandWrittenModuleHandlers({ module, queries: queries.toSorted() });
	}
});
