import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { application } from "#test/application.ts";

export const webhooksFeature = application.trait("app", "the app registers the queued webhook adoption feature beside notes", (engine) => {
	const app = join(engine.root, engine.app);
	const folder = join(app, "src/adoption/webhooks");
	mkdirSync(folder, { recursive: true });
	writeFileSync(
		join(folder, "feature.ts"),
		readFileSync(new URL("../../../../script/starter-published/adoption/webhooks/feature.ts.txt", import.meta.url)),
	);
	const modules = join(app, "src/server/modules.ts");
	writeFileSync(
		modules,
		`import { webhooksRegistration } from "#adoption/webhooks/feature.ts";\n${readFileSync(modules, "utf8")}`.replace(
			"const modules = [",
			"const modules = [webhooksRegistration, ",
		),
	);
});
