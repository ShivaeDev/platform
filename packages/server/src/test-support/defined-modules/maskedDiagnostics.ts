import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Cause, Effect, Layer, Option, Stream } from "effect";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import type { OtlpSpan } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { Members } from "#test/defined-modules/members.ts";
import { Readings } from "#test/defined-modules/readings.ts";
import { rpcClient } from "#test/defined-modules/rpcClient.ts";
import { spanAttribute } from "#test/spanAttribute.ts";

export interface DiagnosedHost {
	readonly collector?: { readonly untilSpan: (name: string) => Effect.Effect<OtlpSpan, unknown> };
	readonly logs: readonly { readonly cause: Cause.Cause<unknown>; readonly message: readonly unknown[] }[];
	readonly url: string;
}

// The members and readings modules mark fields sensitive; these verbs drive them and read what their diagnostics recorded.
export function maskedDiagnosticsVerbs(host: DiagnosedHost, story: { readonly tell: (line: string) => void }) {
	function logged(message: string) {
		return Effect.sync(() => host.logs.find((entry) => entry.message[0] === message)?.message[1] ?? `no log ${message}`);
	}
	function exported(span: string, attribute: string) {
		return Effect.gen(function* () {
			if (host.collector === undefined) {
				return yield* Effect.die("Give the host a collector before reading its exported spans");
			}
			return spanAttribute(yield* host.collector.untilSpan(span), attribute);
		});
	}
	return {
		auditMember: (id: number) => {
			story.tell(`alice audits member ${id} through members.audit, whose handler dies holding the member's row`);
			return answered(Effect.flatMap(rpcClient(Members, host.url, "alice"), (call) => call("members.audit", { id })));
		},
		exportedMemberSpan: () => exported("Members.show", "member"),
		exportedReadingsSpan: () => exported("Readings.latest", "readings"),
		joinMember: (name: string, address: string) => {
			story.tell(`alice adds the member ${name} living at ${address} through members.join`);
			return answered(Effect.flatMap(rpcClient(Members, host.url, "alice"), (call) => call("members.join", { address, name })));
		},
		loggedDefect: () =>
			Effect.sync(
				() =>
					host.logs.flatMap(({ cause, message }) => (message[0] === "RPC defect" ? cause.reasons.filter(Cause.isDieReason) : []))[0]?.defect
					?? "no RPC defect was logged",
			),
		loggedGoal: () => logged("goal read"),
		loggedMember: () => logged("member shown"),
		loggedReadings: () => logged("readings read"),
		readGoal: () => {
			story.tell("alice reads her pulse goal through readings.goal, whose handler logs the goal and returns it as a plain object");
			return answered(Effect.flatMap(rpcClient(Readings, host.url, "alice"), (call) => call("readings.goal", {})));
		},
		readLatest: () => {
			story.tell("alice reads every reading through readings.latest, whose handler logs the readings and annotates its span with them");
			return answered(Effect.flatMap(rpcClient(Readings, host.url, "alice"), (call) => call("readings.latest", {})));
		},
		recordReading: (day: string, pulse: number) => {
			story.tell(
				`alice records a pulse of ${pulse} on ${day} through readings.record, whose handler dies holding the stored reading when the day has one`,
			);
			return answered(Effect.flatMap(rpcClient(Readings, host.url, "alice"), (call) => call("readings.record", { day, pulse })));
		},
		showMember: (id: number) => {
			story.tell(`alice reads member ${id} through members.show, whose handler logs the member's row`);
			return answered(Effect.flatMap(rpcClient(Members, host.url, "alice"), (call) => call("members.show", { id })));
		},
		subscribeToLatest: () =>
			Effect.gen(function* () {
				story.tell("alice subscribes to readings.latest through readings.$changes over a WebSocket and takes its first result");
				const protocol = RpcClient.layerProtocolSocket().pipe(
					Layer.provide([layerWebSocket(host.url.replace(/^http/u, "ws"), { headers: { authorization: "alice" } }), RpcSerialization.layerNdjson]),
				);
				const call = yield* Effect.flatMap(Layer.build(protocol), (services) =>
					RpcClient.make(Readings, { flatten: true }).pipe(Effect.provideContext(services)),
				);
				const first = yield* call("readings.$changes", { queries: [{ payload: {}, query: "latest" }] }).pipe(
					Stream.filter((update) => update._tag === "Result"),
					Stream.runHead,
				);
				return Option.match(first, { onNone: () => "no result", onSome: (update) => update.value });
			}),
	};
}
