import type { ResourceNames } from "#resource/names.ts";

export function resourceRegistration({ name, camel, pascal }: ResourceNames) {
	return `import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { migrationsIn } from "@shivaedev/server/migrationsIn.ts";
import { ${pascal} } from "#modules/${name}/${pascal}.ts";
import { ${pascal}Repository } from "#modules/${name}/server/Repository.ts";

export const ${camel}Registration = {
	migrations: migrationsIn(import.meta.dirname),
	module: ${pascal},
	services: ${pascal}Repository.layer,
} satisfies AppModule;
`;
}
