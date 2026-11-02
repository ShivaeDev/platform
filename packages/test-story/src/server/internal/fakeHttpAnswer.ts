import type { ServerResponse } from "node:http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { FakeHttpReply, FakeHttpRequest, FakeHttpRoute } from "#fakeHttpService.ts";
import type { fakeHttpControls } from "#internal/fakeHttpControls.ts";
import { fakeHttpSend, fakeHttpStrike } from "#internal/fakeHttpSend.ts";

function pageReply(route: FakeHttpRoute, request: FakeHttpRequest): FakeHttpReply {
	if (route.reply) {
		return route.reply(request);
	}
	const page = Number(request.query.get("page") ?? "1");
	if (!Number.isInteger(page) || page < 1) {
		return { body: { error: "page must be a positive integer" }, status: HttpStatus.fromLiteral("BadRequest") };
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
	const before = controls.takeFault(name, request, "before");
	let reply: FakeHttpReply = {};
	if (!before) {
		reply = pageReply(route, request);
	} else if (before.kind === "status") {
		reply = controls.reply(before.reply, request);
	}
	const after = before ? undefined : controls.takeFault(name, request, "after");
	if (after?.kind === "status") {
		reply = controls.reply(after.reply, request);
	}
	if (!(await controls.pause(name, request, response))) {
		return;
	}
	if (before && before.kind !== "status") {
		tell(`fake HTTP ${name} fault ${before.kind} before reply`);
		await fakeHttpStrike(response, before);
		return;
	}
	if (after) {
		tell(`fake HTTP ${name} fault ${after.kind} after reply`);
		if (after.kind !== "status") {
			await fakeHttpStrike(response, after, reply);
			return;
		}
	}
	tell(`fake HTTP answered ${method} ${path} with ${reply.status ?? HttpStatus.fromLiteral("OK")}`);
	await fakeHttpSend(response, reply, controls.stallBody(name, request));
}
