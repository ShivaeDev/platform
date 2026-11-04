import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hostOptions } from "#test/app-host/story.ts";
import { hostVerbs } from "#test/app-host/verbs.ts";
import { readLocalTraces } from "#test/localTraces.ts";

export const localTraceHost = storyKit({
	...hostOptions(),
	*create() {
		const state = yield* hostOptions().create();
		const root = mkdtempSync(join(tmpdir(), "platform-local-host-"));
		state.cleanup.push(() => rmSync(root, { force: true, recursive: true }));
		const path = join(root, "traces.db");
		state.env = { "NODE_ENV": "development", "PLATFORM_TRACE_INDEXED_ATTRIBUTES": "orderId,privateField", "PLATFORM_TRACE_STORE": path };
		state.config.sensitiveKeys = ["privateField"];
		state.routes = HttpRouter.add(
			"GET",
			"/checkout",
			Effect.gen(function* () {
				yield* Effect.annotateCurrentSpan({ orderId: "order-42", privateField: "hidden-span" });
				yield* Effect.logInfo("password=hidden-log").pipe(Effect.annotateLogs({ privateField: "hidden-annotation" }));
				return HttpServerResponse.text("saved");
			}).pipe(Effect.withSpan("checkout")),
		);
		return { ...state, path };
	},
	name: "locally traced app host",
	verbs: (state, story) => ({
		...hostVerbs(state, story),
		storedTraces: () => Effect.sync(() => readLocalTraces(state.path)),
		storeExists: () => Effect.sync(() => existsSync(state.path)),
	}),
});
