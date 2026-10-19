import type { ServerResponse } from "node:http";
import type { FakeHttpReply, FakeHttpRequest, FakeHttpRoute } from "#fakeHttpService.ts";
import type { fakeHttpControls } from "#internal/fakeHttpControls.ts";
import { fakeHttpSend, fakeHttpStrike } from "#internal/fakeHttpSend.ts";

function pageReply(route: FakeHttpRoute, request: FakeHttpRequest): FakeHttpReply {
	if (route.reply) {
		return route.reply(request);
	}
	const page = Number(request.query.get("page") ?? "1");
	if (!Number.isInteger(page) || page < 1) {
		return { body: { error: "page must be a positive integer" }, status: 400 };
	}
	return { body: { items: route.pages[page - 1] ?? [], next: page < route.pages.length ? page + 1 : null } };
}

export async function fakeHttpAnswer(
	name: string,
	route: FakeHttpRoute,
	request: FakeHttpRequest,
	response: ServerResponse,
	controls: ReturnType<typeof fakeHttpControls>,
	tell: (line: string) => void,
) {
	const { method, path } = request;
	controls.arrive(name, request, response);
	if (!(await controls.pause(name, response))) {
		return;
	}
	const before = controls.takeFault(name, request, "before");
	if (before && before.kind !== "status") {
		tell(`fake HTTP ${name} fault ${before.kind} before reply`);
		await fakeHttpStrike(response, before);
		return;
	}
	let reply = before?.reply ?? pageReply(route, request);
	const after = before ? undefined : controls.takeFault(name, request, "after");
	if (after) {
		tell(`fake HTTP ${name} fault ${after.kind} after reply`);
		if (after.kind !== "status") {
			await fakeHttpStrike(response, after, reply);
			return;
		}
		reply = after.reply;
	}
	tell(`fake HTTP answered ${method} ${path} with ${reply.status ?? 200}`);
	await fakeHttpSend(response, reply, controls.stallBody(name, request));
}
