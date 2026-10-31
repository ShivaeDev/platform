import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ambiguousFields, conflictingFields, scopedFields } from "#test/app-host/fieldScope.ts";
import { host, startupFails } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

host.it(
	"ambiguous state sensitivity refuses registration and names the success and failure schemas",
	[ambiguousFields, startupFails],
	function* ({ startupFailureMessage }) {
		expect(yield* startupFailureMessage()).toContain(
			'Sensitive field "state" in schema ambiguousState.success.state conflicts with public field in schema ambiguousState.error[0].state',
		);
	},
);

for (const [kind, privateSchema, publicSchema] of [
	["nested", "conflictingState.success.private.state", "conflictingState.success.public.state"],
	["record", "conflictingState.success.private.state", "conflictingState.success.public[state]"],
	["encoded", "conflictingState.success.encoded.wireState", "conflictingState.error.wireState"],
	["selfEncoded", "conflictingState.success.encoded.visible", "conflictingState.success.visible"],
	["middleware", "conflictingState.success.state", "conflictingState.middleware[0].error.state"],
] as const) {
	host.it(
		`a ${kind} field collision refuses registration and names both schema paths`,
		[conflictingFields(kind), startupFails],
		function* ({ startupFailureMessage }) {
			const message = yield* startupFailureMessage();

			expect(message).toContain(`schema ${privateSchema} conflicts with public field in schema ${publicSchema}`);
		},
	);
}

for (const [method, fail, expected] of [
	["privateState", false, { received: { state: "private-state" } }],
	["privateState", true, { rejected: expect.objectContaining({ _tag: "Conflict", message: "Private call rejected" }) }],
	["publicState", false, { received: { state: "active" } }],
	["publicState", true, { rejected: { _tag: "Blocked", state: "active" } }],
	["containedState", false, { received: { output: { _tag: "PrivateOutput", state: "private-state" }, state: "active" } }],
	["containedState", true, { rejected: { _tag: "Blocked", state: "active" } }],
	["optionalState", false, { received: { output: { _tag: "PrivateOutput", state: "private-state" }, state: "active" } }],
	["optionalState", true, { rejected: { _tag: "Blocked", state: "active" } }],
] as const) {
	host.it(
		`the native client decodes a ${fail ? "failed" : "successful"} ${method} call in a group with private and public state schemas`,
		[scopedFields],
		function* ({ readState }) {
			const answer = yield* readState(method, fail);

			expect(answer).toEqual(expected);
		},
	);
}

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`private fields are redacted in logs and ${protocol} traces while public state outside a private field and in another RPC stays readable`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), scopedFields],
		function* ({ close, diagnosticLog, exportMentions, logMentions, readState, spanAttributes }) {
			yield* readState("privateState");
			yield* readState("publicState");
			yield* readState("containedState");
			yield* readState("optionalState");

			yield* close();

			yield* outcomes([
				["private log", () => diagnosticLog("private state"), expect.objectContaining({ state: "<redacted>" })],
				["public log", () => diagnosticLog("public state"), expect.objectContaining({ state: "active" })],
				["contained log", () => diagnosticLog("contained state"), expect.objectContaining({ output: "<redacted>", state: "active" })],
				["optional log", () => diagnosticLog("optional state"), expect.objectContaining({ output: "<redacted>", state: "active" })],
				["private span", () => spanAttributes("privateState"), [expect.objectContaining({ state: "<redacted>" })]],
				["public span", () => spanAttributes("publicState"), [expect.objectContaining({ state: "active" })]],
				["contained span", () => spanAttributes("containedState"), [expect.objectContaining({ output: "<redacted>", state: "active" })]],
				["optional span", () => spanAttributes("optionalState"), [expect.objectContaining({ output: "<redacted>", state: "active" })]],
				["private log leaks", () => logMentions("private-state"), []],
				["private trace leaks", () => exportMentions("private-state"), []],
			]);
		},
	);
}
