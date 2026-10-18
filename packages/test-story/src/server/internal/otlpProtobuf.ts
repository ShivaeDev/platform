import { type WireValue, wireFields } from "#internal/otlpWire.ts";

type Scalar = "string" | "hex" | "base64" | "number" | "integer" | "boolean" | "double" | "fixed64";
type Field = readonly [name: string, type: Scalar | (() => Descriptor), repeated?: boolean];
interface Descriptor {
	readonly [field: number]: Field;
}
const keyValue: Descriptor = { 1: ["key", "string"], 2: ["value", () => anyValue] };
const anyValue: Descriptor = {
	1: ["stringValue", "string"],
	2: ["boolValue", "boolean"],
	3: ["intValue", "integer"],
	4: ["doubleValue", "double"],
	5: ["arrayValue", () => ({ 1: ["values", () => anyValue, true] })],
	6: ["kvlistValue", () => ({ 1: ["values", () => keyValue, true] })],
	7: ["bytesValue", "base64"],
};
const event: Descriptor = { 1: ["timeUnixNano", "fixed64"], 2: ["name", "string"], 3: ["attributes", () => keyValue, true] };
const link: Descriptor = { 1: ["traceId", "hex"], 2: ["spanId", "hex"], 4: ["attributes", () => keyValue, true] };
const span: Descriptor = {
	1: ["traceId", "hex"],
	2: ["spanId", "hex"],
	4: ["parentSpanId", "hex"],
	5: ["name", "string"],
	6: ["kind", "number"],
	7: ["startTimeUnixNano", "fixed64"],
	8: ["endTimeUnixNano", "fixed64"],
	9: ["attributes", () => keyValue, true],
	11: ["events", () => event, true],
	13: ["links", () => link, true],
	15: ["status", () => ({ 2: ["message", "string"], 3: ["code", "number"] })],
};
const traces: Descriptor = {
	1: [
		"resourceSpans",
		() => ({
			1: ["resource", () => ({ 1: ["attributes", () => keyValue, true] })],
			2: ["scopeSpans", () => ({ 2: ["spans", () => span, true] }), true],
		}),
		true,
	],
};

function scalar(type: Scalar, value: WireValue): unknown {
	if (typeof value === "bigint") {
		switch (type) {
			case "number":
				return Number(value);
			case "integer":
				return BigInt.asIntN(64, value).toString();
			case "boolean":
				return value !== 0n;
			case "string":
			case "hex":
			case "base64":
			case "double":
			case "fixed64":
				throw new Error(`Invalid OTLP protobuf ${type} field`);
		}
	}
	switch (type) {
		case "string":
			return value.toString();
		case "hex":
			return value.toString("hex");
		case "base64":
			return value.toString("base64");
		case "double":
			return value.readDoubleLE();
		case "fixed64":
			return value.readBigUInt64LE().toString();
		case "number":
		case "integer":
		case "boolean":
			throw new Error(`Invalid OTLP protobuf ${type} field`);
	}
}

function fieldValue(type: Field[1], value: WireValue): unknown {
	if (typeof type === "string") {
		return scalar(type, value);
	}
	if (!Buffer.isBuffer(value)) {
		throw new Error("Invalid OTLP protobuf message field");
	}
	return message(value, type());
}

function message(bytes: Buffer, descriptor: Descriptor): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [name, , repeated] of Object.values(descriptor)) {
		if (repeated) {
			result[name] = [];
		}
	}
	for (const field of wireFields(bytes)) {
		const description = descriptor[field.number];
		if (description === undefined) {
			continue;
		}
		const [name, type, repeated] = description;
		const value = fieldValue(type, field.value);
		const previous = result[name];
		if (repeated && Array.isArray(previous)) {
			previous.push(value);
		} else {
			result[name] = value;
		}
	}
	return result;
}

export function otlpProtobuf(bytes: Buffer) {
	return message(bytes, traces);
}
