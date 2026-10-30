import { Schema } from "effect";
import { expect } from "vitest";
import { application } from "#test/application.ts";
import { malformedManifest, templateFailures } from "#test/templateFailures.ts";

application.it("the CLI logs a malformed manifest's failed step, file and decode cause", [], function* ({ pack, replacePacked, cli }) {
	const files = yield* pack();
	replacePacked("package.json", JSON.stringify({ ...JSON.parse(files["package.json"] ?? "{}"), dependencies: { effect: 42 } }));

	const result = yield* cli(["demo", "--no-git"]);

	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain("CreateAppError: Failed to render template file package.json");
	expect(result.stderr).toContain("SchemaError");
	expect(result.stderr).toContain('["dependencies"]["effect"]');
});

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
