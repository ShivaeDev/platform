import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { application } from "#test/application.ts";

export const webhooksFeature = application.trait(
	"app",
	"the app adds the queued webhook adoption feature beside notes, whose registration the server list finds",
	(engine) => {
		const app = join(engine.root, engine.app);
		const folder = join(app, "src/adoption/webhooks");
		mkdirSync(folder, { recursive: true });
		writeFileSync(
			join(folder, "feature.ts"),
			readFileSync(new URL("../../../../script/starter-published/adoption/webhooks/feature.ts.txt", import.meta.url)),
		);
	},
);
