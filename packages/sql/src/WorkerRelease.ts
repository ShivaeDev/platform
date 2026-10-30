import { Effect, Semaphore } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";

export const makeWorkerRelease = Effect.fn("EffectSql.makeWorkerRelease")(function* () {
	const mutex = Semaphore.makeUnsafe(1);
	const controls = new Set<(active: boolean) => Effect.Effect<void, unknown>>();
	let active = false;
	const locked = mutex.withPermits(1);
	function register<E>(control: (active: boolean) => Effect.Effect<void, E>) {
		const attach = Effect.gen(function* () {
			controls.add(control);
			yield* control(active);
		});
		const detach = Effect.sync(() => {
			controls.delete(control);
		});
		return Effect.acquireRelease(locked(attach), () => locked(detach));
	}
	return {
		service: { register },
		setActive: (next: boolean) =>
			locked(
				Effect.gen(function* () {
					if (next === active) {
						return;
					}
					active = next;
					yield* Effect.forEach(controls, (control) => control(active), { concurrency: "unbounded", discard: true });
				}),
			).pipe(Effect.uninterruptible),
	};
});

export const WorkerRelease = defineService({
	id: "@shivaedev/sql/WorkerRelease",
	initialize: makeWorkerRelease(),
	methods: ({ service }) => ({ register: genericMethod(service.register) }),
	requires: [],
});
