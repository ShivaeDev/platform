import { Context, Effect } from "effect";
import { expectTypeOf } from "vitest";
import type { Emit } from "#health.ts";
import type { Options, State } from "#model.ts";
import type { WatchEvent } from "#outputEvent.ts";
import { watch } from "#program.ts";
import { poll } from "#watcher/poll.ts";
import type { Watcher } from "#watcher/service.ts";

class Consumer extends Context.Service<Consumer, object>()("@shivaedev/pr-watch/types/Consumer") {}
class Diagnostics extends Context.Service<Diagnostics, object>()("@shivaedev/pr-watch/types/Diagnostics") {}

const emit: Emit<"consumer-failure", Consumer> = (_event: WatchEvent) => Consumer.pipe(Effect.andThen(Effect.fail("consumer-failure" as const)));
function diagnostic(_message: unknown) {
	return Diagnostics.pipe(Effect.andThen(Effect.fail("diagnostic-failure" as const)));
}

function callbackTypes(options: Options, state: State) {
	const running = watch(options, { heartbeat: 0, once: true }, emit, diagnostic);
	const polling = poll(options, state, emit, diagnostic);

	expectTypeOf<Effect.Services<typeof running>>().toEqualTypeOf<Context.Service.Identifier<typeof Watcher> | Consumer | Diagnostics>();
	expectTypeOf<Effect.Services<typeof polling>>().toEqualTypeOf<Context.Service.Identifier<typeof Watcher> | Consumer | Diagnostics>();
	expectTypeOf<Extract<Effect.Error<typeof running>, "consumer-failure" | "diagnostic-failure">>().toEqualTypeOf<
		"consumer-failure" | "diagnostic-failure"
	>();
	expectTypeOf<Extract<Effect.Error<typeof polling>, "consumer-failure" | "diagnostic-failure">>().toEqualTypeOf<
		"consumer-failure" | "diagnostic-failure"
	>();
}

void callbackTypes;
