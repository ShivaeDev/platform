import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { vi } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import * as metadata from "@shivaedev/work-board/metadata/parse.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { approvedWorkIds } from "#host/admission.ts";
import { resolveHost } from "#host/config.ts";
import { boardReads } from "#test/boardReads.ts";

it.effect("excludes generated status from task parsing and retains authored work at the same path", () =>
	Effect.gen(function* () {
		const fixture = yield* boardReads(1);
		const fs = yield* FileSystem.FileSystem;
		yield* fs.makeDirectory(`${fixture.root}/fleet`);
		yield* fixture.write("fleet/status.md", statusMarkdown([]));
		const parse = vi.spyOn(metadata, "metadataParse");
		yield* Effect.addFinalizer(() => Effect.sync(() => parse.mockRestore()));
		const ids = approvedWorkIds(resolveHost(fixture.root, { provider: "local" })).pipe(Effect.provide(fixture.services));
		expect(yield* withBoardReadPass(ids)).toEqual(["item.0"]);
		expect(parse).toHaveBeenCalledTimes(1);
		yield* fixture.write("fleet/status.md", fixture.source("authored.status"));
		expect(yield* withBoardReadPass(ids)).toEqual(["item.0", "authored.status"]);
		expect(parse).toHaveBeenCalledTimes(3);
	}).pipe(Effect.provide(NodeServices.layer)),
);
