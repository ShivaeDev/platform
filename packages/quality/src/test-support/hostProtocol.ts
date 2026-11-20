import type { SeedFile } from "#testing/adapters/tree.ts";

const PUBLIC_CONFIG = {
	content: [
		'import { Effect, type Schema } from "effect";',
		'import { contract } from "#contract.ts";',
		'import { query } from "#operation.ts";',
		"",
		"export function publicConfig<T, E>(schema: Schema.Codec<T, E>) {",
		'\treturn contract("platform.publicConfig", {',
		'\t\tqueries: [query("get", { readPolicy: () => Effect.succeed(true), reads: () => [], success: schema })],',
		"\t});",
		"}",
	]
		.join("\n")
		.concat("\n"),
	path: "packages/contract/src/publicConfig.ts",
};

const LIVE_SYNC = {
	content: [
		'import { Schema } from "effect";',
		'import { contract } from "#contract.ts";',
		'import { LIVE_SYNC_COMMAND, LIVE_SYNC_CONTRACT } from "#liveSyncRpc.ts";',
		'import { command } from "#operation.ts";',
		"",
		"// A command that writes nothing: its sync token alone travels the change channel, behind every earlier commit.",
		"export const LiveSync = contract(LIVE_SYNC_CONTRACT, {",
		"\tcommands: [command(LIVE_SYNC_COMMAND, { invalidates: () => [], success: Schema.Void })],",
		"});",
	]
		.join("\n")
		.concat("\n"),
	path: "packages/contract/src/LiveSync.ts",
};

const HOST_VERSION = {
	content: [
		'import { Schema } from "effect";',
		'import { contract } from "#contract.ts";',
		'import { stream } from "#operation.ts";',
		"",
		'export const HostVersion = contract("platform.hostVersion", {',
		'\tstreams: [stream("watch", { reads: () => [], success: Schema.String })],',
		"});",
	]
		.join("\n")
		.concat("\n"),
	path: "packages/contract/src/HostVersion.ts",
};

export const HOST_PROTOCOL: readonly SeedFile[] = [PUBLIC_CONFIG, LIVE_SYNC, HOST_VERSION];
