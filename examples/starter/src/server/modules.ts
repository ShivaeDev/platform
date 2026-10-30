import { Layer, type Redacted } from "effect";
import { RpcGroup } from "effect/rpc";
import { mergeAdminRegistrations } from "@shivaedev/admin/server/mergeAdminRegistrations.ts";
import type { QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import { notesRegistration } from "#modules/notes/server/registration.ts";
import { foundationRegistration } from "./foundationRegistration.ts";

const features = [notesRegistration] as const;
const modules = [
	foundationRegistration(features.flatMap((module: { readonly queues: readonly QueueDefinition[] }) => module.queues)),
	...features,
] as const;
const admin = mergeAdminRegistrations(...modules);

export const serverModules = {
	admin,
	group: RpcGroup.make().merge(...modules.map((module) => module.group)),
	handlers: admin.handlers,
	migrations: modules.map((module) => module.migrations),
	services: (url: Redacted.Redacted<string>, max?: number) => {
		const clientCacheKey = Symbol("app/producer");
		return Layer.mergeAll(Layer.empty, ...modules.map((module) => module.services(url, max, clientCacheKey)));
	},
};
