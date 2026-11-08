import { createHash } from "node:crypto";
import { posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Data, Effect } from "effect";
import { decodeDeclarations } from "#imports/fences/declarations.ts";
import type { Fence } from "#imports/fences/model.ts";
import type { WorkspacePackage } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";

const BOUNDARY_FILE = "quality.fences.config.ts";

class BoundaryFailure extends Data.TaggedError("BoundaryFailure")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

function messageOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

const boundaryAt = Effect.fn("Fences.boundaryAt")(function* (inputs: RuleInputs, file: string) {
	const text = yield* inputs.readText(file);
	if (text === undefined) {
		return [];
	}
	const url = pathToFileURL(resolve(inputs.root, file));
	url.searchParams.set("content", createHash("sha256").update(text).digest("hex"));
	const loaded: unknown = yield* Effect.tryPromise({
		catch: (cause) => new BoundaryFailure({ cause, message: messageOf(cause) }),
		try: () => import(url.href),
	});
	if (typeof loaded !== "object" || loaded === null || !("default" in loaded)) {
		return yield* new BoundaryFailure({ message: "export an array of fence() declarations as the default export" });
	}
	const decoded = decodeDeclarations(loaded.default);
	if (decoded._tag === "Invalid") {
		return yield* new BoundaryFailure({ message: `export an array of fence() declarations:\n${decoded.issues.join("\n")}` });
	}
	return decoded.value;
});

const loadBoundary = Effect.fn("Fences.loadBoundary")(function* (
	inputs: RuleInputs,
	directory: string,
): Effect.fn.Return<readonly Fence[], BoundaryFailure> {
	const file = posix.join(directory, BOUNDARY_FILE);
	return yield* Effect.mapError(
		boundaryAt(inputs, file),
		(cause) => new BoundaryFailure({ cause, message: `cannot load boundary at ${file}: ${cause.message}` }),
	);
});

export const discoverFences = Effect.fn("Fences.discoverFences")(function* (inputs: RuleInputs, packages: readonly WorkspacePackage[]) {
	const boundaries = yield* Effect.forEach([".", ...packages.map((owner) => owner.directory)], (directory) => loadBoundary(inputs, directory), {
		concurrency: "unbounded",
	});
	return boundaries.flat();
});
