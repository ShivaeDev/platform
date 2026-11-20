import type { ServerResponse } from "node:http";
import * as Effect from "effect/Effect";
import type { FakeHttpRequestRecord } from "#server/fakeHttpService.ts";
import { recordedSignals } from "#server/recordedSignals.ts";

export const fakeHttpSignals = Effect.gen(function* () {
	const received = yield* recordedSignals<FakeHttpRequestRecord>();
	const completed = yield* recordedSignals<FakeHttpRequestRecord>();
	const abandoned = yield* recordedSignals<FakeHttpRequestRecord>();
	return {
		abandoned: abandoned.stream,
		close: () => {
			received.end();
			completed.end();
			abandoned.end();
		},
		completed: completed.stream,
		received: received.stream,
		record: (request: FakeHttpRequestRecord, response: ServerResponse) => {
			response.once("finish", () => completed.push(request));
			response.once("close", () => {
				if (!response.writableFinished) {
					abandoned.push(request);
				}
			});
			received.push(request);
		},
	};
});
