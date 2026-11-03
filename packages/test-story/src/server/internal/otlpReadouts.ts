import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { OtlpExport, OtlpSpan } from "#server/otlpReceiver.ts";

const parseJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

function contains(value: unknown, secrets: readonly string[]): boolean {
	if (typeof value === "object" && value !== null) {
		return Object.entries(value).some(([key, item]) => contains(key, secrets) || contains(item, secrets));
	}
	return secrets.some((secret) => String(value).includes(secret));
}

export function exportsSecret(requests: readonly OtlpExport[], secret: string) {
	const formEncoded = new URLSearchParams({ secret }).toString().slice("secret=".length);
	const secrets = [secret, encodeURIComponent(secret), formEncoded];
	return requests.some(({ body, headers }) => {
		if (secrets.some((value) => body.includes(Buffer.from(value)))) {
			return true;
		}
		if (headers["content-type"]?.split(";")[0]?.trim() === "application/json") {
			return Option.exists(parseJson(body.toString()), (value) => contains(value, secrets));
		}
		return false;
	});
}

function text(attributes: OtlpSpan["attributes"], key: string) {
	return attributes.find((attribute) => attribute.key === key)?.value.stringValue;
}

export function queries(spans: readonly OtlpSpan[]) {
	return spans.flatMap((span) => {
		const query = text(span.attributes, "db.query.text") ?? text(span.attributes, "db.statement");
		return query === undefined ? [] : [query];
	});
}

export function errors(spans: readonly OtlpSpan[]) {
	return spans.flatMap((span) => {
		const service = text(span.resourceAttributes, "service.name");
		const exceptions = span.events
			.filter((event) => event.name === "exception")
			.map((event) => ({
				message: text(event.attributes, "exception.message") ?? span.status.message ?? span.name,
				operation: span.name,
				service,
				type: text(event.attributes, "exception.type"),
			}));
		return exceptions.length > 0 || span.status.code !== 2
			? exceptions
			: [{ message: span.status.message ?? span.name, operation: span.name, service, type: undefined }];
	});
}
