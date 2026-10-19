import { expect } from "vitest";
import { sensitiveFailureTag } from "#test/app-host/sensitiveFailureTag.ts";
import { host } from "#test/app-host/story.ts";

const HTTP_OK = 200;

for (const source of ["schema", "host"] as const) {
	host.it(`hides ${source}-sensitive error tags in the RPC failure log`, [sensitiveFailureTag(source)], function* ({ postNdjson, logs }) {
		const value = "private-marker";
		const response = yield* postNdjson(
			`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: { _tag: value }, tag: "taggedFailure" })}\n`,
			false,
		);
		expect(response.status).toBe(HTTP_OK);
		expect(response.body).toContain('"_tag":"Fail"');
		expect(response.body).toContain('"detail":"public detail"');
		expect(response.body).not.toContain(value);
		expect(JSON.stringify(logs())).not.toContain(value);
		const failure = logs().find((entry) => Array.isArray(entry.message) && entry.message.includes("RPC failure"));
		expect(failure?.annotations).toMatchObject({
			"rpc.failure": "<redacted>",
			"rpc.method": "taggedFailure",
			"rpc.payload": { _tag: "<redacted>" },
		});
	});
}
