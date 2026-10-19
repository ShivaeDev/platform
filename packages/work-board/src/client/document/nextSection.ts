// A message task runs without the clamping that nested timers get, so a long document does not idle between its sections.
export function nextSection() {
	return new Promise<void>((resolve) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = () => {
			channel.port1.close();
			resolve();
		};
		channel.port2.postMessage(undefined);
	});
}
