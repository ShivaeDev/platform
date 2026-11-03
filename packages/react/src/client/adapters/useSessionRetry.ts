import { RegistryContext } from "@effect/atom-react";
import { Effect, Fiber, Schedule } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useEffect, useMemo } from "react";
import type { SessionBoundaryProps } from "#client/sessionBoundary.ts";
import { useLatestCallback } from "#internal/adapters/useLatestCallback.ts";

export function useSessionRetry(recheck: SessionBoundaryProps<unknown, unknown>["recheck"], identity: string | undefined): () => void {
	const registry = useContext(RegistryContext);
	const latest = useLatestCallback(() => (Effect.isEffect(recheck) ? recheck : Effect.sync(recheck)));
	const retry = useMemo(() => {
		let running: Fiber.Fiber<unknown, unknown> | undefined;
		function stop() {
			if (running) {
				Effect.runFork(Fiber.interrupt(running));
				running = undefined;
			}
		}
		function start() {
			if (running || identity === undefined) {
				return;
			}
			const fiber = Effect.runFork(
				Effect.suspend(latest).pipe(
					Effect.retry(Schedule.min([Schedule.exponential("1 second"), Schedule.spaced("30 seconds")])),
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			);
			running = fiber;
			fiber.addObserver(() => {
				if (running === fiber) {
					running = undefined;
				}
			});
		}
		function resume() {
			if (running && window.document.visibilityState === "visible") {
				stop();
				start();
			}
		}
		return { resume, start, stop };
	}, [latest, registry, identity]);
	useEffect(() => {
		window.addEventListener("online", retry.resume);
		window.addEventListener("visibilitychange", retry.resume);
		return () => {
			window.removeEventListener("online", retry.resume);
			window.removeEventListener("visibilitychange", retry.resume);
			retry.stop();
		};
	}, [retry]);
	return retry.start;
}
