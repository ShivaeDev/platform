import type { ResourceNames } from "#resource/names.ts";

export function resourceRegistration({ name, camel, pascal }: ResourceNames) {
	return `import { resolve } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import * as MigratorFileSystem from "effect/sql/MigratorFileSystem";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { Create, List, ${pascal}Contract } from "#modules/${name}/${name}.ts";
import { ${pascal}Repository } from "./Repository.ts";
import { ${camel}Service } from "./service.ts";

const boundaryOptions = { unexpected: (message: string) => new InternalServerError({ message }) };

const handlers = ${pascal}Contract.application.toLayer({
	"${name}.create": (input) =>
		Effect.gen(function* () {
			const service = yield* ${camel}Service;
			return yield* service.create(input);
		}).pipe(rpcBoundary(Create.error, boundaryOptions)),
	"${name}.list": () =>
		Effect.gen(function* () {
			const service = yield* ${camel}Service;
			return yield* service.list();
		}).pipe(rpcBoundary(List.error, boundaryOptions)),
});

export const ${camel}Registration = {
	group: ${pascal}Contract,
	handlers,
	migrations: { loader: MigratorFileSystem.fromFileSystem(resolve(import.meta.dirname, "migrations")).pipe(Effect.provide(NodeServices.layer)) },
	name: "${name}",
	requestServices: ${camel}Service.layer,
	services: ${pascal}Repository.layer,
} satisfies AppModule;
`;
}

export function resourceClient({ name, pascal }: ResourceNames) {
	return `import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { ${pascal}Contract } from "#modules/${name}/${name}.ts";

export function make${pascal}Client(url: string, options: Omit<ClientOptions, "url"> & { readonly registry?: AtomRegistry.AtomRegistry } = {}) {
	return makeClient(${pascal}Contract, { url, ...options });
}
`;
}
