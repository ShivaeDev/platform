// An application's client modules as it writes them, one per module folder, beside a server registration and a kit's own module, neither of which the client's list may import. Paths are relative to the project; the kit writes package.json and tsconfig.json.
import { registrationOf } from "#test/registrationsProject.ts";

const CLIENT_MODULE = 'import { clientModule } from "@shivaedev/react/client/module.ts";';

export type ClientModuleShape = "built by clientModule" | "exporting something else" | "in server code" | "through a namespace import";

export function clientModuleFile(module: string, shape: ClientModuleShape = "built by clientModule") {
	const name = `${module.toLowerCase()}Module`;
	switch (shape) {
		case "built by clientModule":
		case "in server code":
			return `${CLIENT_MODULE}\n\nexport const ${name} = clientModule({}, () => ({}));\n`;
		case "exporting something else":
			return `export const ${name} = { routes: () => [] };\n`;
		case "through a namespace import":
			return `import * as Client from "@shivaedev/react/client/module.ts";\n\nexport const ${name} = Client.clientModule({}, () => ({}));\n`;
	}
}

export function clientModulePath(module: string, shape: ClientModuleShape = "built by clientModule") {
	return `src/modules/${module.toLowerCase()}/${shape === "in server code" ? "server/clientModule.tsx" : "client/module.tsx"}`;
}

export const CLIENT_MODULES_PROJECT: Readonly<Record<string, string>> = {
	"src/client/modules.ts": `import { modules } from "#generated/client/modules.ts";

export const listed = modules;
`,
	[clientModulePath("Archive")]: clientModuleFile("Archive"),
	[clientModulePath("Notes")]: clientModuleFile("Notes"),
	"src/modules/notes/server/registration.ts": registrationOf("notesRegistration", "Notes"),
	"src/modules/notes/test-support/app.tsx": clientModuleFile("Fake"),
	[clientModulePath("Tags")]: clientModuleFile("Tags"),
};
