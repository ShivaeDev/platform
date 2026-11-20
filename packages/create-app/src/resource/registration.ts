import type { ResourceNames } from "#resource/names.ts";

export function resourceRegistration({ name, camel, pascal }: ResourceNames) {
	return `import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { migrationsIn } from "@shivaedev/server/adapters/migrationsIn.ts";
import { ${pascal} } from "#modules/${name}/${pascal}.ts";
import { ${pascal}Repository } from "#modules/${name}/server/Repository.ts";

export const ${camel}Registration = {
	migrations: migrationsIn(import.meta.dirname),
	module: ${pascal},
	services: ${pascal}Repository.layer,
} satisfies AppModule;
`;
}

export function resourceClient({ name, pascal }: ResourceNames) {
	return `import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { ${pascal} } from "#generated/modules/${name}/${pascal}.ts";

export function make${pascal}Client(url: string, options: Omit<ClientOptions, "url"> & { readonly registry?: AtomRegistry.AtomRegistry } = {}) {
	return makeClient(${pascal}, { url, ...options });
}
`;
}
