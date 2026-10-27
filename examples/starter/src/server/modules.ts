import { Layer, type Redacted } from "effect";
import { RpcGroup } from "effect/rpc";
import { mergeReadPolicies } from "@shivaedev/contract/readPolicy.ts";
import type { PgBossClientFactory } from "@shivaedev/jobs/server/client.ts";
import { notesRegistration } from "#modules/notes/server/registration.ts";

const foundationServices: (url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory, max?: number) => Layer.Layer<never> = () =>
	Layer.empty;
const modules = [{ group: RpcGroup.make(), handlers: Layer.empty, readPolicies: {}, services: foundationServices }, notesRegistration];

export const serverModules = {
	group: RpcGroup.make().merge(...modules.map((module) => module.group)),
	handlers: Layer.mergeAll(Layer.empty, ...modules.map((module) => module.handlers)),
	readPolicy: mergeReadPolicies(...modules.map((module) => module.readPolicies)),
	services: (url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory, max?: number) =>
		Layer.mergeAll(Layer.empty, ...modules.map((module) => module.services(url, clientFactory, max))),
};
