import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sensitiveErrorField } from "#test/app-host/sensitiveErrorField.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const fields = ["cause", "message", "name", "stack"] as const;
const kinds = ["defect", "failure"] as const;

for (const field of fields) {
	for (const kind of kinds) {
		host.it(
			`a sensitive Error ${field} from a ${kind} is masked in the reported Error and absent from the client answer`,
			[sensitiveErrorField(field)],
			function* ({ answerMentions, callRpc, reportedErrorField, reportMentions }) {
				const secret = `private-inner-${field}`;

				yield* callRpc("errorField", { field, kind, value: secret });

				yield* outcomes({
					"leaked into reports": [reportMentions(secret), []],
					"leaked into the answer": [answerMentions(secret), []],
					"reported error": [reportedErrorField(field), [`an Error whose ${field} is <redacted>`]],
				});
			},
		);
	}
}

host.it(
	"masking a sensitive Error cause keeps the reported Error's public message",
	[sensitiveErrorField("cause")],
	function* ({ callRpc, reportedErrorField }) {
		yield* callRpc("errorField", { field: "cause", kind: "failure", value: "private-inner-cause" });

		expect(yield* reportedErrorField("message")).toEqual(["an Error whose message is public detail"]);
	},
);

const exceptionStacks = [
	["cause", "an exception stack with the field masked", expect.stringContaining("<redacted>")],
	["message", "an exception stack with the field masked", expect.stringContaining("<redacted>")],
	["name", "an exception stack with the field masked", expect.stringContaining("<redacted>")],
	["stack", "only the Error header as the exception stack", "Error: public detail"],
] as const;

for (const protocol of ["http/json", "http/protobuf"]) {
	for (const [field, shape, stack] of exceptionStacks) {
		for (const kind of kinds) {
			host.it(
				`a ${protocol} export shows ${shape} for a ${kind} with a sensitive Error ${field}`,
				[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), sensitiveErrorField(field)],
				function* ({ callRpc, close, exceptionStack, exportMentions }) {
					const secret = `private-inner-${field}`;

					yield* callRpc("errorField", { field, kind, value: secret });

					yield* close();

					yield* outcomes({
						"exception stack": [exceptionStack("errorField"), stack],
						"leaked secrets": [exportMentions(secret), []],
					});
				},
			);
		}
	}
}
