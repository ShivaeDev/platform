import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Schedule } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useEffect, useMemo } from "react";
import type { SessionBoundaryProps } from "#client/sessionBoundary.ts";
import { useLatestCallback } from "#internal/adapters/useLatestCallback.ts";

const defaultRuntime = Atom.runtime(Layer.empty);

export function useSessionRetry(
	recheck: SessionBoundaryProps<unknown, unknown>["recheck"],
	identity: string | undefined,
	runtime: NonNullable<SessionBoundaryProps<unknown, unknown>["runtime"]> = defaultRuntime,
): () => void {
	const registry = useContext(RegistryContext);
	const latest = useLatestCallback(() => (Effect.isEffect(recheck) ? recheck : Effect.sync(recheck)));
	const retry = useMemo(() => {
		const task = runtime
			.fn(() =>
				Effect.suspend(latest).pipe(
					Effect.retry(Schedule.min([Schedule.exponential("1 second"), Schedule.spaced("30 seconds")])),
					Effect.provideService(AtomRegistry.AtomRegistry, registry),
				),
			)
			.pipe(Atom.setIdleTTL(0));
		function stop() {
			registry.set(task, Atom.Interrupt);
		}
		function start() {
			if (!registry.get(task).waiting && identity !== undefined) {
				registry.set(task, undefined);
			}
		}
		function resume() {
			if (registry.get(task).waiting && window.document.visibilityState === "visible") {
				stop();
				start();
			}
		}
		return { resume, start, stop, task };
	}, [latest, registry, identity, runtime]);
	useAtomValue(retry.task);
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
