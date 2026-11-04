import { fileURLToPath } from "node:url";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryLinks } from "#test/ruleStory.ts";

export const rpcBoundaryResolves = [
	effectResolves(),
	repositoryLinks("node_modules/@shivaedev/errors", fileURLToPath(new URL("../../../errors", import.meta.url))),
];

export const rpcBoundaryImports = [
	'import { Effect, Schema } from "effect";',
	'import { Rpc, RpcGroup } from "effect/rpc";',
	'import { rpcBoundary as expose } from "@shivaedev/errors/boundary.ts";',
	'import * as Boundaries from "@shivaedev/errors/rpcBoundaryHandlers.ts";',
	'const Api = RpcGroup.make(Rpc.make("Read", { success: Schema.String, error: Schema.String }));',
	'const options = { unexpected: () => "unavailable" };',
];
