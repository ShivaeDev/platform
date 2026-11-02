import type { ServerResponse } from "node:http";
import type { FakeHttpRequestRecord } from "#fakeHttpService.ts";
import { recordedSignals } from "#internal/recordedSignals.ts";

export function fakeHttpSignals() {
	const received = recordedSignals<FakeHttpRequestRecord>();
	const completed = recordedSignals<FakeHttpRequestRecord>();
	const abandoned = recordedSignals<FakeHttpRequestRecord>();
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
}
