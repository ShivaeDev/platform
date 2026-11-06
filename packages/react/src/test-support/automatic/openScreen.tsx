import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, Layer } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Socket from "effect/socket/Socket";
import { act } from "react";
import { render } from "@shivaedev/test-story/client/adapters/react.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { connect } from "./connect.ts";
import { Notes, Read } from "./screen.tsx";

export async function openScreen(url: string, runtime: Atom.RuntimeFactory) {
	window.location.href = url;
	const sockets: Socket.WebSocketLike[] = [];
	const reconnected = Promise.withResolvers<void>();
	const addresses: string[] = [];
	const socketConstructor = Layer.effect(
		Socket.WebSocketConstructor,
		Effect.map(Socket.WebSocketConstructor, (make) => (address, options) => {
			const socket = make(address, options);
			sockets.push(socket);
			if (sockets.length > 1) {
				socket.addEventListener("open", () => reconnected.resolve(), { once: true });
			}
			addresses.push(address);
			return socket;
		}),
	).pipe(Layer.provide(layerWebSocketConstructor));
	const client = connect(url, socketConstructor, runtime);
	const separate: Awaited<ReturnType<typeof render>>[] = [];
	let owner: AtomRegistry.AtomRegistry | undefined;
	const view = await render(
		<SessionBoundary
			connect={(_session, registry) => {
				owner = registry;
				return client;
			}}
			identify={(session) => session}
			recheck={() => undefined}
			session="alice"
		>
			{(current) => <Notes client={current} />}
		</SessionBoundary>,
	);
	function button(label: string) {
		const found = [...view.container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
		if (found === undefined) {
			throw new Error(`Missing button ${label}`);
		}
		return found;
	}
	return {
		...view,
		addresses,
		click: async (label: string) => {
			await act(() => button(label).click());
		},
		client,
		closePrimary: view.unmount,
		drop: async () => {
			await act(() => {
				for (const socket of sockets) {
					socket.close(4000);
				}
			});
		},
		openSeparate: async () => {
			separate.push(
				await render(
					<SessionBoundary connect={() => client} identify={(session) => session} recheck={() => undefined} session="alice">
						{() => <Read client={client} id={2} />}
					</SessionBoundary>,
				),
			);
		},
		query: (id: number) => {
			if (owner === undefined) {
				throw new Error("The session registry is not mounted");
			}
			return owner.get((id === 1 ? client.api : client.preview).get.query({ id }));
		},
		reconnected: reconnected.promise,
		rename: async (title: string) => {
			await act(() => {
				const input = view.container.querySelector<HTMLInputElement>('[aria-label="Title"]');
				const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
				if (input === null || setter === undefined) {
					throw new Error("Missing title input");
				}
				setter.call(input, title);
				input.dispatchEvent(new Event("input", { bubbles: true }));
			});
			await act(() => button("Rename").click());
		},
		separateContainer: () => {
			const root = separate[0];
			if (root === undefined) {
				throw new Error("No separate screen is open");
			}
			return root.container;
		},
		unmount: async () => {
			for (const root of separate) {
				await root.unmount();
			}
			await view.unmount();
		},
	};
}
