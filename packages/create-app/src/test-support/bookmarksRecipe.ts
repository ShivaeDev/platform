import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { application } from "./application.ts";

export const bookmarksRecipe = application.trait(
	"app",
	"the app adds the guide's bookmarks registration with a two-operation contract and service",
	(engine) => {
		const guide = readFileSync(new URL("../../../../docs/framework/add-a-feature.md", import.meta.url), "utf8");
		const recipe = guide.split("## 6. Register the server module")[1]?.split("```ts\n")[1]?.split("```")[0];
		if (recipe === undefined) {
			throw new Error("The add-a-feature guide has no registration recipe");
		}
		const folder = join(engine.root, engine.app, "src/modules/bookmarks");
		mkdirSync(join(folder, "server"), { recursive: true });
		writeFileSync(join(folder, "server/registration.ts"), recipe);
		const modules = join(engine.root, engine.app, "src/server/modules.ts");
		writeFileSync(
			modules,
			`import { bookmarksRegistration } from "#modules/bookmarks/server/registration.ts";\n${readFileSync(modules, "utf8")}`.replace(
				"const modules = [",
				"const modules = [bookmarksRegistration, ",
			),
		);
		writeFileSync(join(folder, "server/Service.ts"), 'export { NotesService as BookmarksService } from "#modules/notes/server/Service.ts";\n');
		writeFileSync(
			join(folder, "bookmarks.ts"),
			`import { contract } from "@shivaedev/contract/contract.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { Create, List } from "#modules/notes/notes.ts";
export { Create, List };
export const Bookmarks = contract("bookmarks", { commands: [Create], queries: [List] }).middleware(AuthenticatedUser);
`,
		);
	},
);
