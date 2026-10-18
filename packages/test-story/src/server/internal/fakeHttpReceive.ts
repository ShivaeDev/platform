import type { IncomingMessage, ServerResponse } from "node:http";
import type { FakeHttpReply, FakeHttpRequest, FakeHttpRoute, FakeHttpServiceOptions } from "#fakeHttpService.ts";
import type { fakeHttpControls } from "#internal/fakeHttpControls.ts";
import { fakeHttpSend } from "#internal/fakeHttpSend.ts";

function match(route: FakeHttpRoute, method: string, pathname: string) {
	if ((route.method ?? "GET").toUpperCase() !== method) {
		return;
	}
	const pattern = route.path.split("/");
	const segments = pathname.split("/");
	if (pattern.length !== segments.length) {
		return;
	}
	const params: Record<string, string> = {};
	for (const [index, part] of pattern.entries()) {
		const segment = segments[index] ?? "";
		if (part.startsWith(":")) {
			params[part.slice(1)] = segment;
		} else if (part !== segment) {
			return;
		}
	}
	return params;
}

function decodeParams(params: Record<string, string>) {
	try {
		for (const [name, value] of Object.entries(params)) {
			params[name] = decodeURIComponent(value);
		}
		return true;
	} catch {
		return false;
	}
}

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

export async function fakeHttpReceive(
	incoming: IncomingMessage,
	response: ServerResponse,
	options: FakeHttpServiceOptions,
	requests: FakeHttpRequest[],
	controls: ReturnType<typeof fakeHttpControls>,
	tell: (line: string) => void,
) {
	try {
		const path = incoming.url ?? "/";
		const url = new URL(path, "http://127.0.0.1");
		const method = incoming.method ?? "GET";
		const found = Object.entries(options.routes).flatMap(([name, route]) => {
			const params = match(route, method, url.pathname);
			return params ? [{ name, params, route }] : [];
		})[0];
		const chunks: Buffer[] = [];
		for await (const chunk of incoming) {
			chunks.push(Buffer.from(chunk));
		}
		const params = found?.params ?? {};
		const request: FakeHttpRequest = {
			body: Buffer.concat(chunks),
			headers: incoming.headers,
			method,
			params,
			path,
			query: url.searchParams,
		};
		requests.push(request);
		tell(`fake HTTP received ${method} ${path}`);
		if (!decodeParams(params)) {
			tell(`fake HTTP rejected ${method} ${path} with 400`);
			await fakeHttpSend(response, { status: 400 });
			return;
		}
		if (options.guard && !options.guard(request)) {
			tell(`fake HTTP rejected ${method} ${path} with 401`);
			await fakeHttpSend(response, { status: 401 });
			return;
		}
		if (!found) {
			tell(`fake HTTP answered ${method} ${path} with 404`);
			await fakeHttpSend(response, { status: 404 });
			return;
		}
		controls.arrive(found.name, response);
		if (!(await controls.pause(found.name, response))) {
			return;
		}
		const reply = controls.takeReply(found.name) ?? pageReply(found.route, request);
		tell(`fake HTTP answered ${method} ${path} with ${reply.status ?? 200}`);
		await fakeHttpSend(response, reply, controls.stallBody(found.name));
	} catch (error) {
		tell(`fake HTTP could not answer: ${String(error)}`);
		if (response.headersSent) {
			response.destroy();
		} else {
			await fakeHttpSend(response, { status: 500 });
		}
	}
}
