export function pendingScreen(root: HTMLElement) {
	root.innerHTML = `<button id="load">Load news</button><output>Ready</output>
		<form><input name="email" type="email" required><button>Sign in</button></form>
		<input id="readonly" readonly value="locked"><textarea aria-label="draft"></textarea><span style="display:none">Hidden detail</span><button id="unavailable" disabled>Unavailable</button>`;
	const output = root.querySelector("output");
	const form = root.querySelector("form");
	const load = root.querySelector("#load");
	if (!(output && form && load)) {
		throw new Error("The fixture screen could not mount");
	}
	const display = output;
	let pending = false;
	let message = "Ready";
	let frames = 0;
	const observers = new Set<() => void>();
	const controller = new AbortController();
	function render() {
		display.textContent = message;
		frames += 1;
		for (const observe of observers) {
			observe();
		}
	}
	async function request(path: string, init?: RequestInit) {
		pending = true;
		message = "Loading";
		render();
		try {
			const response = await window.fetch(`https://identity.test${path}`, { ...init, signal: controller.signal });
			const body: unknown = await response.json();
			if (typeof body !== "string") {
				throw new Error("Expected a text response from the provider");
			}
			message = body;
		} catch (error) {
			message = String(error);
		} finally {
			render();
			pending = false;
		}
	}
	load.addEventListener("click", () => void request("/news"));
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const email = new FormData(form).get("email");
		void request("/session", { body: new URLSearchParams({ email: String(email) }), method: "POST" });
	});
	return {
		close: () => controller.abort(),
		pending: () => pending,
		repaint: render,
		waitFrames: (count: number) =>
			new Promise<void>((resolve) => {
				const target = frames + count;
				function observe() {
					if (frames >= target) {
						observers.delete(observe);
						resolve();
					}
				}
				observers.add(observe);
			}),
	};
}
