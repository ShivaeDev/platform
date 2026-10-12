import { NodeServices } from "@effect/platform-node";
import { Effect, Path, PlatformError, Schema } from "effect";
import { expect, vi } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { MermaidMissing, mermaidRoot, nativeAsset } from "./assets.ts";

vi.mock("node:module", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:module")>();
	return {
		...actual,
		createRequire: () => ({
			resolve: () => {
				throw new InternalServerError({ message: "Missing dependency" });
			},
		}),
	};
});

it.live("reports Mermaid resolution failures as a Schema error with reinstall instructions", function* () {
	const failure = yield* mermaidRoot().pipe(Effect.provide(NodeServices.layer), Effect.flip);
	expect(Schema.is(MermaidMissing)(failure)).toBe(true);
	expect(failure).toBeInstanceOf(MermaidMissing);
	expect(failure.message).toContain("Reinstall Work Board and restart it");
});

it.live("reports an invalid bundle location as a failure instead of a host defect", function* () {
	const path = yield* Path.Path.pipe(Effect.provide(NodeServices.layer));
	const failure = yield* nativeAsset().pipe(
		Effect.provideService(Path.Path, {
			...path,
			fromFileUrl: () => Effect.fail(new PlatformError.BadArgument({ description: "Invalid module URL", method: "fromFileUrl", module: "Path" })),
		}),
		Effect.provide(NodeServices.layer),
		Effect.flip,
	);
	expect(failure).toBeInstanceOf(InternalServerError);
	expect(failure).toMatchObject({ message: "The browser asset location is invalid. Reinstall Work Board and restart it." });
});
