import { createHash } from "node:crypto";

export function payloadKey(parts: readonly string[], payload: object): string {
	return JSON.stringify(parts.map((part) => [part, typeof Reflect.get(payload, part), String(Reflect.get(payload, part))]));
}

export function payloadJobId(queue: string, parts: readonly string[], payload: object): string {
	const bytes = createHash("sha256")
		.update(JSON.stringify([queue, payloadKey(parts, payload)]))
		.digest();
	bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x80, 6);
	bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
	const hex = bytes.subarray(0, 16).toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
