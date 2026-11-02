import { crc32, deflateRawSync } from "node:zlib";

export interface ArchiveEntry {
	readonly compressed?: boolean;
	readonly content: string | Uint8Array;
	readonly declaredSize?: number;
	readonly path: string;
	readonly symlink?: boolean;
}

export function zipArchive(entries: readonly ArchiveEntry[]) {
	const local: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const entry of entries) {
		const name = Buffer.from(entry.path);
		const content = Buffer.from(entry.content);
		const data = entry.compressed ? deflateRawSync(content) : content;
		const header = Buffer.alloc(30);
		header.writeUInt32LE(0x04_03_4b_50, 0);
		header.writeUInt16LE(20, 4);
		header.writeUInt16LE(0x8_00, 6);
		header.writeUInt16LE(entry.compressed ? 8 : 0, 8);
		header.writeUInt32LE(crc32(content), 14);
		header.writeUInt32LE(data.byteLength, 18);
		header.writeUInt32LE(entry.declaredSize ?? content.byteLength, 22);
		header.writeUInt16LE(name.byteLength, 26);
		const record = Buffer.alloc(46);
		record.writeUInt32LE(0x02_01_4b_50, 0);
		record.writeUInt16LE(0x3_14, 4);
		header.copy(record, 6, 4, 30);
		record.writeUInt32LE(((entry.symlink ? 0o12_0777 : 0o10_0644) << 16) >>> 0, 38);
		record.writeUInt32LE(offset, 42);
		local.push(header, name, data);
		central.push(record, name);
		offset += header.byteLength + name.byteLength + data.byteLength;
	}
	const directory = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06_05_4b_50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(directory.byteLength, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...local, directory, end]);
}
