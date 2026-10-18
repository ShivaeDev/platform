import { DateTime, Effect, Schema } from "effect";
import { TimestampReadout } from "./TimestampReadout.ts";

function day(instant: DateTime.Utc) {
	return DateTime.formatUtc(instant, { day: "numeric", locale: "en-US", month: "short" });
}

export function timestampScreen(root: HTMLElement, url: string, run: <A>(effect: Effect.Effect<A>) => Promise<A>) {
	root.innerHTML = '<button>Run timestamp job</button><output id="host"></output><output id="worker"></output><output id="screen"></output>';
	const button = root.querySelector("button");
	const host = root.querySelector("#host");
	const worker = root.querySelector("#worker");
	const screen = root.querySelector("#screen");
	if (!(button && host && worker && screen)) {
		throw new Error("The timestamp screen could not mount");
	}
	let pending = false;
	const controller = new AbortController();
	button.addEventListener("click", () => {
		pending = true;
		void run(
			Effect.gen(function* () {
				const reply = yield* Effect.promise(async () => {
					const response = await fetch(url, { method: "POST", signal: controller.signal });
					if (!response.ok) {
						throw new Error(`Timestamp job failed: HTTP ${response.status}`);
					}
					return Schema.decodeUnknownSync(TimestampReadout)(await response.json());
				});
				host.textContent = `Host: ${day(DateTime.makeUnsafe(reply.hostAt))}`;
				worker.textContent = `Worker: since ${day(DateTime.makeUnsafe(reply.workerAt))}`;
				screen.textContent = `Screen: ${day(yield* DateTime.now)}`;
			}),
		)
			.catch((error: unknown) => {
				screen.textContent = String(error);
			})
			.finally(() => {
				pending = false;
			});
	});
	return { close: () => controller.abort(), pending: () => pending };
}
