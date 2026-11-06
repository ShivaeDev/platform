import { type LiveBound, LiveConnection } from "#automaticLive.ts";
import type { clientOperations } from "#clientOperations.ts";
import type { Declared } from "#contract.ts";
import type { CommandShape, QueryShape, StreamShape } from "#operation.ts";

export function bindOperations(
	declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[], "session" | undefined>,
	operations: ReturnType<typeof clientOperations>,
	subscription: LiveBound[typeof LiveConnection],
) {
	const { name, queries, commands, streams } = declaration;
	return Object.assign(
		Object.fromEntries([
			...queries.map((query) => [query.name, operations.query(`${name}.${query.name}`, query)] as const),
			...commands.map((command) => [command.name, operations.command(`${name}.${command.name}`, command)] as const),
			...streams.map((stream) => [stream.name, operations.stream(`${name}.${stream.name}`)] as const),
		]),
		{ [LiveConnection]: subscription },
	);
}
