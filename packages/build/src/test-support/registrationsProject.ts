// An application's server registrations as it writes them, one per module folder, and a kit's own registration, which the server must never serve. Paths are relative to the project; the kit writes package.json and tsconfig.json.
const APP_MODULE = 'import type { AppModule } from "@shivaedev/server/AppModule.ts";';

export function registrationOf(name: string, module: string, annotation: "satisfies AppModule" | ": AppModule" | "none" = "satisfies AppModule") {
	const declared = annotation === ": AppModule" ? `${name}: AppModule` : name;
	const written = annotation === "satisfies AppModule" ? " satisfies AppModule" : "";
	return `${annotation === "none" ? "" : `${APP_MODULE}\n`}import { ${module} } from "#modules/${module.toLowerCase()}/${module}.ts";

export const ${declared} = {
	module: ${module},
	services: ${module}.layer,
}${written};
`;
}

export const REGISTRATIONS_PROJECT: Readonly<Record<string, string>> = {
	"src/modules/archive/server/registration.ts": registrationOf("archiveRegistration", "Archive"),
	"src/modules/notes/server/registration.ts": registrationOf("notesRegistration", "Notes"),
	"src/modules/notes/test-support/host.ts": registrationOf("hostRegistration", "Notes"),
	"src/modules/tags/server/registration.ts": registrationOf("tagsRegistration", "Tags"),
	"src/server/modules.ts": `import { modules } from "#generated/server/modules.ts";

export const served = modules;
`,
};
