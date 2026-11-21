// An application's server registrations as it writes them, one per module folder, and a kit's own registration, which the server must never serve. Paths are relative to the project; the kit writes package.json and tsconfig.json.
const APP_MODULE = 'import type { AppModule } from "@shivaedev/server/AppModule.ts";';

export type RegistrationShape =
	| "built by a function call"
	| "in the group and handlers form with no annotation"
	| "through a separate export list"
	| "typed : AppModule"
	| "typed through a namespace import"
	| "with no annotation"
	| "written satisfies AppModule";

function bodyOf(module: string) {
	return `{\n\tmodule: ${module},\n\tservices: ${module}.layer,\n}`;
}

export function registrationOf(name: string, module: string, shape: RegistrationShape = "written satisfies AppModule") {
	const imported = `import { ${module} } from "#modules/${module.toLowerCase()}/${module}.ts";\n\n`;
	switch (shape) {
		case "built by a function call":
			return `import { registration } from "#server/registration.ts";\n${imported}export const ${name} = registration(${module});\n`;
		case "in the group and handlers form with no annotation":
			return `${imported}export const ${name} = { group: ${module}, handlers: ${module}.handlers, name: "${name}", services: ${module}.layer };\n`;
		case "through a separate export list":
			return `${APP_MODULE}\n${imported}const registered = ${bodyOf(module)} satisfies AppModule;\n\nexport { registered as ${name} };\n`;
		case "typed : AppModule":
			return `${APP_MODULE}\n${imported}export const ${name}: AppModule = ${bodyOf(module)};\n`;
		case "typed through a namespace import":
			return `import type * as Server from "@shivaedev/server/AppModule.ts";\n${imported}export const ${name} = ${bodyOf(module)} satisfies Server.AppModule;\n`;
		case "with no annotation":
			return `${imported}export const ${name} = ${bodyOf(module)};\n`;
		case "written satisfies AppModule":
			return `${APP_MODULE}\n${imported}export const ${name} = ${bodyOf(module)} satisfies AppModule;\n`;
	}
}

export const REGISTRATIONS_PROJECT: Readonly<Record<string, string>> = {
	"src/modules/archive/server/registration.ts": registrationOf("archiveRegistration", "Archive"),
	"src/modules/notes/server/registration.ts": registrationOf("notesRegistration", "Notes"),
	"src/modules/notes/test-support/host.ts": registrationOf("hostRegistration", "Notes"),
	"src/modules/tags/server/registration.ts": registrationOf("tagsRegistration", "Tags"),
	"src/server/modules.ts": `import { modules } from "#generated/server/modules.ts";

export const served = modules;
`,
	"src/server/registration.ts": `${APP_MODULE}

export function serverRegistration(modules: readonly AppModule[]) {
	return { group: Foundation, handlers: Foundation.handlers, name: "foundation", services: Foundation.layer(modules) } satisfies AppModule;
}
`,
};
