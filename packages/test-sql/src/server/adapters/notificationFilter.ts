import { Transform } from "node:stream";

export function notificationFilter(dropped: () => void) {
	let pending = Buffer.alloc(0);
	const filter = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			pending = Buffer.concat([pending, chunk]);
			while (pending.length >= 5) {
				const length = pending.readInt32BE(1) + 1;
				if (pending.length < length) {
					break;
				}
				if (pending[0] === 65) {
					dropped();
				} else {
					filter.push(pending.subarray(0, length));
				}
				pending = pending.subarray(length);
			}
			callback();
		},
	});
	return filter;
}
