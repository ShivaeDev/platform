import { resolve } from "node:path";
import { Layer, type Redacted } from "effect";
import { RpcGroup } from "effect/rpc";
import { notesRegistration } from "#modules/notes/server/registration.ts";

const foundationServices: (url: Redacted.Redacted<string>, max?: number) => Layer.Layer<never> = () => Layer.empty;
const modules = [
	{ group: RpcGroup.make(), handlers: Layer.empty, migrations: resolve(import.meta.dirname, "migrations"), services: foundationServices },
	notesRegistration,
];

export const serverModules = {
	group: RpcGroup.make().merge(...modules.map((module) => module.group)),
	handlers: Layer.mergeAll(Layer.empty, ...modules.map((module) => module.handlers)),
	migrations: modules.map((module) => module.migrations),
	services: (url: Redacted.Redacted<string>, max?: number) => Layer.mergeAll(Layer.empty, ...modules.map((module) => module.services(url, max))),
};
