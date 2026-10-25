import { Context, Effect, type Scope, Semaphore } from "effect";

export class WorkerRelease extends Context.Service<
	WorkerRelease,
	{
		readonly register: <E>(control: (active: boolean) => Effect.Effect<void, E>) => Effect.Effect<void, E, Scope.Scope>;
	}
>()("@shivaedev/effect-sql/WorkerRelease") {}

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
		service: WorkerRelease.of({ register }),
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
