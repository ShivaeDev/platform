import type { ResourceNames } from "./names.ts";

export function resourceRegistration({ name, camel, pascal }: ResourceNames) {
	return `import { resolve } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { Migrator } from "effect/sql";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { Create, List, ${pascal}Contract } from "#modules/${name}/${name}.ts";
import { ${pascal}Service } from "./Service.ts";

const boundaryOptions = { unexpected: (message: string) => new InternalServerError({ message }) };

const handlers = ${pascal}Contract.application.toLayer(
	Effect.gen(function* () {
		const service = yield* ${pascal}Service;
		return ${pascal}Contract.application.of({
			"${name}.create": (input) =>
				Effect.flatMap(SessionUser, ({ id }) => service.create(input, id).pipe(rpcBoundary(Create.error, boundaryOptions))),
			"${name}.list": () => Effect.flatMap(SessionUser, ({ id }) => service.list(id).pipe(rpcBoundary(List.error, boundaryOptions))),
		});
	}),
);

export const ${camel}Registration = {
	group: ${pascal}Contract,
	handlers,
	migrations: { loader: Migrator.fromFileSystem(resolve(import.meta.dirname, "migrations")).pipe(Effect.provide(NodeServices.layer)) },
	name: "${name}",
	services: ${pascal}Service.layer,
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
