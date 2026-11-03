import { Context, Effect } from "effect";
import { expectTypeOf } from "vitest";
import type { Emit } from "#health.ts";
import type { Options, State } from "#model.ts";
import type { WatchEvent } from "#outputEvent.ts";
import { watch } from "#program.ts";
import type { Watcher } from "#Watcher.ts";

class Consumer extends Context.Service<Consumer, object>()("@types/Consumer") {}
class Diagnostics extends Context.Service<Diagnostics, object>()("@types/Diagnostics") {}

const emit: Emit<"consumer-failure", Consumer> = (_event: WatchEvent) => Consumer.pipe(Effect.andThen(Effect.fail("consumer-failure" as const)));
function diagnostic(_message: unknown) {
	return Diagnostics.pipe(Effect.andThen(Effect.fail("diagnostic-failure" as const)));
}

function callbackTypes(options: Options, state: State, watcher: typeof Watcher.Service) {
	const running = watch(options, { heartbeat: 0, once: true }, emit, diagnostic);
	const polling = watcher.poll(options, state, emit, diagnostic);

	expectTypeOf<Effect.Services<typeof running>>().toEqualTypeOf<Context.Service.Identifier<typeof Watcher> | Consumer | Diagnostics>();
	expectTypeOf<Effect.Services<typeof polling>>().toEqualTypeOf<Consumer | Diagnostics>();
	expectTypeOf<Extract<Effect.Error<typeof running>, "consumer-failure" | "diagnostic-failure">>().toEqualTypeOf<
		"consumer-failure" | "diagnostic-failure"
	>();
	expectTypeOf<Extract<Effect.Error<typeof polling>, "consumer-failure" | "diagnostic-failure">>().toEqualTypeOf<
		"consumer-failure" | "diagnostic-failure"
	>();
}

void callbackTypes;
