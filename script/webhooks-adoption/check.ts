import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { command } from "#package-check/io.ts";

export const checkWebhooks = Effect.fn("Adoption.checkWebhooks")(function* (root: string, app: string, database: string) {
	const fs = yield* FileSystem.FileSystem;
	const fixtures = join(root, "script/webhooks-adoption/fixtures");
	for (const [source, target] of [
		["feature.ts.txt", "src/server/webhooks.ts"],
		["routes.ts.txt", "src/server/webhookRoutes.ts"],
		["story.ts.txt", "src/test-support/webhooks.ts"],
		["adoption.spec.ts.txt", "src/server/webhooks.spec.ts"],
	] as const) {
		yield* fs.copyFile(join(fixtures, source), join(app, target));
	}
	const modules = join(app, "src/server/modules.ts");
	yield* fs.writeFileString(
		modules,
		`import { webhooksRegistration } from "#server/webhooks.ts";\n${yield* fs.readFileString(modules)}`.replace(
			"[serverRegistration()]",
			"[serverRegistration(), webhooksRegistration]",
		),
	);
	const host = join(app, "src/server/applicationHost.ts");
	yield* fs.writeFileString(
		host,
		`import { webhookRoutes } from "#server/webhookRoutes.ts";\n${yield* fs.readFileString(host)}`.replace(
			"Layer.mergeAll(routes, authEmailRoutes,",
			"Layer.mergeAll(webhookRoutes.pipe(Layer.provide(Layer.succeedContext(serviceContext))), routes, authEmailRoutes,",
		),
	);
	yield* Effect.log("Generated app with webhooks: typecheck and focused PostgreSQL/HTTP stories.");
	yield* Effect.log(yield* command(app, "pnpm", ["run", "typecheck"]));
	yield* Effect.log(yield* command(app, "env", [`TEST_DATABASE_URL=${database}`, "pnpm", "test", "src/server/webhooks.spec.ts", "--maxWorkers=1"]));
});
