import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Effect, Schema } from "effect";
import type { FleetHost } from "#host/config.ts";
import { type FleetConfiguration, FleetFailure } from "#policy.ts";

type Quota = FleetConfiguration["quota"];

const OBSERVATION_MS = 60_000;
// Admission counts submissions against this; while ordinary usage is allowed the provider imposes no smaller number.
const ORDINARY_USAGE = Number.MAX_SAFE_INTEGER;

const RateLimits = Schema.Struct({ ordinaryUsageAllowed: Schema.Boolean });

export function unlimitedQuota(now: () => number): Effect.Effect<Quota> {
	return Effect.sync(() => {
		const observedAt = now();
		return { available: ORDINARY_USAGE, expiresAt: observedAt + OBSERVATION_MS, observedAt };
	});
}

export function codexQuota(
	now: () => number,
	read: Effect.Effect<unknown, FleetFailure> = codexRateLimits,
): () => Effect.Effect<Quota, FleetFailure> {
	let cached: Quota | undefined;
	return () =>
		Effect.gen(function* () {
			if (cached !== undefined && cached.expiresAt > now()) {
				return cached;
			}
			const limits = yield* Schema.decodeUnknownEffect(RateLimits)(yield* read).pipe(
				Effect.mapError(() => new FleetFailure({ message: "Codex rate limits returned an unknown shape", reason: "integration" })),
			);
			const observedAt = now();
			cached = { available: limits.ordinaryUsageAllowed ? ORDINARY_USAGE : 0, expiresAt: observedAt + OBSERVATION_MS, observedAt };
			return cached;
		});
}

export function hostQuota(host: FleetHost, now: () => number): () => Effect.Effect<Quota, FleetFailure> {
	return host.quota === "unlimited" ? () => unlimitedQuota(now) : codexQuota(now);
}

function unavailable(message: string) {
	return Effect.fail(new FleetFailure({ message, reason: "integration" }));
}

const codexRateLimits = Effect.callback<unknown, FleetFailure>((resume) => {
	const child = spawn("codex", ["app-server", "--listen", "stdio://"], { stdio: ["pipe", "pipe", "ignore"] });
	const lines = createInterface({ input: child.stdout });
	let settled = false;
	function finish(result: Effect.Effect<unknown, FleetFailure>) {
		if (!settled) {
			settled = true;
			clearTimeout(timer);
			lines.close();
			child.kill();
			resume(result);
		}
	}
	const timer = setTimeout(() => finish(unavailable("Codex rate limits timed out")), 30_000);
	child.on("error", () => finish(unavailable("The codex CLI could not be started to read rate limits")));
	child.on("exit", () => finish(unavailable("The codex app-server exited before reporting rate limits")));
	lines.on("line", (line) => {
		let message: { readonly id?: unknown; readonly method?: unknown; readonly result?: unknown; readonly error?: unknown };
		try {
			message = JSON.parse(line);
		} catch {
			return;
		}
		if (message.id !== undefined && message.method !== undefined) {
			child.stdin.write(`${JSON.stringify({ error: { code: -32_601, message: "Quota reader approves nothing" }, id: message.id })}\n`);
		} else if (message.id === "initialize") {
			child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
			child.stdin.write(`${JSON.stringify({ id: "limits", method: "account/rateLimits/read", params: { excludeResetCreditDetails: true } })}\n`);
		} else if (message.id === "limits") {
			finish(message.error === undefined ? Effect.succeed(message.result) : unavailable("Codex refused to report rate limits"));
		}
	});
	child.stdin.write(
		`${JSON.stringify({ id: "initialize", method: "initialize", params: { capabilities: { experimentalApi: true }, clientInfo: { name: "work-fleet", version: "0.0.0" } } })}\n`,
	);
	return Effect.sync(() => finish(unavailable("Quota read interrupted")));
});
