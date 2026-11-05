import { Context, Effect, Layer, Scheduler } from "effect";

export class LiveDispatcher extends Context.Service<LiveDispatcher, { readonly dispatcher: Scheduler.SchedulerDispatcher }>()(
	"@shivaedev/contract/LiveDispatcher",
) {
	static readonly layer = Layer.effect(
		this,
		Effect.map(Scheduler.Scheduler, (scheduler) => ({ dispatcher: scheduler.makeDispatcher() })),
	);
}
