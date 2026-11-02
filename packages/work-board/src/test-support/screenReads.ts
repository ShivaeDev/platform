import { Deferred, Effect, PubSub } from "effect";
import { act } from "react";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import type { BoardFixtureOptions } from "./BoardFixtureOptions.ts";
import { requestAvailability } from "./screenAvailability.tsx";
import type { ScreenEngine } from "./screenEngine.ts";

export function screenOptions(engine: ScreenEngine, options?: BoardFixtureOptions) {
	const configured = {
		...options,
		afterRead: (url: string) =>
			Effect.suspend(() => {
				const read = engine.heldRefresh;
				if (!read || read.started || url !== read.url) {
					return options?.afterRead?.(url) ?? Effect.void;
				}
				read.started = true;
				return PubSub.publish(engine.transportEvents, undefined).pipe(
					Effect.andThen(Deferred.await(read.gate)),
					Effect.andThen(read.failed ? Effect.fail(new InternalServerError({ message: "Internal server error" })) : Effect.void),
					Effect.ensuring(
						Effect.sync(() => {
							read.finished = true;
						}).pipe(Effect.andThen(PubSub.publish(engine.transportEvents, undefined))),
					),
				);
			}),
		beforeRead: (kind: "document", url: string) => {
			engine.pageRequests.push(url);
			return engine.documentFailed
				? Effect.fail(new InternalServerError({ message: "Internal server error" }))
				: (options?.beforeRead?.(kind, url) ?? Effect.void);
		},
		beforeRequest: (files: readonly string[]) => requestAvailability(engine, files),
		...(engine.fleet ? { fleet: engine.fleet } : {}),
	};
	if (!engine.heldRead) {
		return configured;
	}
	const read = engine.heldRead;
	return {
		...configured,
		beforeRead: (kind: "document", url: string) => {
			const available = configured.beforeRead(kind, url);
			if (url !== read.url) {
				return available;
			}
			return available.pipe(
				Effect.andThen(
					Effect.sync(() => {
						read.started = true;
					}),
				),
				Effect.andThen(Deferred.succeed(read.startedSignal, undefined)),
				Effect.andThen(Deferred.await(read.gate)),
			);
		},
	};
}
export function screenReadVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		pauseRead: (url: string, failed = false) => {
			tell(`the next completed document read for ${url} waits before delivery`);
			engine.heldRefresh = { failed, finished: false, gate: Deferred.makeUnsafe<void>(), started: false, url };
		},

		readPageRequests: () => {
			tell("the reader inspects page requests");
			return [...engine.pageRequests];
		},
		releaseRead: async () => {
			const read = engine.heldRead;
			if (!read) {
				throw new Error("The story has no paused document read");
			}
			tell(`the document read for ${read.url} resumes`);
			await act(() => Promise.resolve().then(() => Effect.runSync(Deferred.succeed(read.gate, undefined))));
		},
		releaseRefresh: async () => {
			tell("the older document result arrives");
			const read = engine.heldRefresh;
			if (!read) {
				throw new Error("No document refresh is paused");
			}
			await act(() => Promise.resolve().then(() => Effect.runSync(Deferred.succeed(read.gate, undefined))));
		},
	};
}
