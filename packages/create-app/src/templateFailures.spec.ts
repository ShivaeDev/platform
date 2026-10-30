import { Schema } from "effect";
import { expect } from "vitest";
import { application } from "#test/application.ts";
import { malformedManifest, malformedPackedManifest, templateFailures } from "#test/templateFailures.ts";

application.it(
	"the CLI logs a malformed manifest's failed step, file and decode cause",
	[malformedPackedManifest],
	function* ({ createApp, diagnosticLog }) {
		yield* createApp("demo", "--no-git");

		const logged = yield* diagnosticLog();
		expect(logged).toContain("CreateAppError: Failed to render template file package.json");
		expect(logged).toContain("SchemaError");
		expect(logged).toContain('["dependencies"]["effect"]');
	},
);

templateFailures.it(
	"a failed pack names its step and file and retains the non-enumerable decode cause",
	[malformedManifest],
	function* ({ pack, failure }) {
		yield* pack();

		const error = failure();
		expect(error?.message).toBe("Failed to prepare template file package.json");
		expect(error?.cause).toBeInstanceOf(Schema.SchemaError);
		expect(Object.getOwnPropertyDescriptor(error, "cause")).toMatchObject({ enumerable: false });
	},
);

templateFailures.it(
	"a malformed packed manifest fails rendering with a decode cause naming the file",
	[malformedManifest],
	function* ({ render, failure }) {
		yield* render();

		const error = failure();
		expect(error?.message).toBe("Failed to render template file package.json");
		expect(error?.cause).toBeInstanceOf(Schema.SchemaError);
		expect(Object.getOwnPropertyDescriptor(error, "cause")).toMatchObject({ enumerable: false });
	},
);
