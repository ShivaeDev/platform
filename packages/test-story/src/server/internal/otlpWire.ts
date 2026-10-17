export type WireValue = bigint | Buffer;

class WireReader {
	offset = 0;
	readonly bytes: Buffer;
	constructor(bytes: Buffer) {
		this.bytes = bytes;
	}
	varint() {
		let value = 0n;
		for (let shift = 0n; shift < 70n && this.offset < this.bytes.length; shift += 7n) {
			const byte = this.bytes.readUInt8(this.offset);
			this.offset += 1;
			value |= BigInt(byte & 127) << shift;
			if (byte < 128) {
				return value;
			}
		}
		throw new Error("Invalid OTLP protobuf varint");
	}
	read(size: number) {
		if (size < 0 || size > this.bytes.length - this.offset) {
			throw new Error("Invalid OTLP protobuf field length or wire type");
		}
		const value = this.bytes.subarray(this.offset, this.offset + size);
		this.offset += size;
		return value;
	}
	field(wire: number): WireValue {
		switch (wire) {
			case 0:
				return this.varint();
			case 1:
				return this.read(8);
			case 2:
				return this.read(Number(this.varint()));
			case 5:
				return this.read(4);
			default:
				throw new Error("Invalid OTLP protobuf wire type");
		}
	}
}

export function wireFields(bytes: Buffer) {
	const reader = new WireReader(bytes);
	const fields: { number: number; value: WireValue; wire: number }[] = [];
	while (reader.offset < bytes.length) {
		const tag = Number(reader.varint());
		if (tag < 8) {
			throw new Error("Invalid OTLP protobuf field");
		}
		const wire = tag & 7;
		fields.push({ number: tag >>> 3, value: reader.field(wire), wire });
	}
	return fields;
}
