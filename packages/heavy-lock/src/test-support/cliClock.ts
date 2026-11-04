import process from "node:process";
import { Clock, Config, Duration, Effect } from "effect";

let now = Effect.runSync(Config.Number("HEAVY_LOCK_STORY_TIME"));
const sleepers = new Map<() => void, number>();

process.on("message", (time: number) => {
	now = time;
	for (const [wake, at] of sleepers) {
		if (at <= now) {
			sleepers.delete(wake);
			wake();
		}
	}
	if (sleepers.size === 0) {
		process.channel?.unref();
	}
});
process.channel?.unref();

function millis() {
	return now;
}
function nanos() {
	return BigInt(now) * 1_000_000n;
}

// A preload keeps the real CLI entrypoint while controlling its outside-process clock.
Object.assign(Effect.runSync(Clock.Clock), {
	currentTimeMillis: Effect.sync(millis),
	currentTimeMillisUnsafe: millis,
	currentTimeNanos: Effect.sync(nanos),
	currentTimeNanosUnsafe: nanos,
	monotonicTimeNanos: Effect.sync(nanos),
	monotonicTimeNanosUnsafe: nanos,
	sleep: (duration: Duration.Duration) =>
		Effect.callback<void>((resume) => {
			process.channel?.ref();
			function wake() {
				resume(Effect.void);
			}
			const at = now + Duration.toMillis(duration);
			sleepers.set(wake, at);
			process.send?.(at);
			return Effect.sync(() => {
				sleepers.delete(wake);
				if (sleepers.size === 0) {
					process.channel?.unref();
				}
			});
		}),
} satisfies Clock.Clock);
