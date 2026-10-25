import { Layer, type Redacted } from "effect";
import { RpcGroup } from "effect/rpc";
import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/server/client.ts";
import { notesRegistration } from "#modules/notes/server/registration.ts";

const foundationServices: (url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory, max?: number) => Layer.Layer<never> = () =>
	Layer.empty;
const modules = [{ group: RpcGroup.make(), handlers: Layer.empty, services: foundationServices }, notesRegistration];

export const serverModules = {
	group: RpcGroup.make().merge(...modules.map((module) => module.group)),
	handlers: Layer.mergeAll(Layer.empty, ...modules.map((module) => module.handlers)),
	services: (url: Redacted.Redacted<string>, clientFactory?: PgBossClientFactory, max?: number) =>
		Layer.mergeAll(Layer.empty, ...modules.map((module) => module.services(url, clientFactory, max))),
};
