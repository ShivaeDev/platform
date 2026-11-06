import { modelFiles } from "#test/serviceModelFiles.ts";

export function ownedServiceFiles(captured = false) {
	return modelFiles(
		`Effect.gen(function* () {
 const scope = yield* Scope.make();
 const attachments = new Map<string, Scope.Closeable>();
 const pending = new Map<string, Deferred.Deferred<void>>();
 const admission = yield* Ref.make(true);
 const handle = yield* Effect.acquireRelease(Effect.sync(() => ({ close: () => {} })), (handle) => Effect.sync(() => handle.close()));
 ${captured ? "const store = yield* Store;" : ""}
 return {
  scope, attachments, pending, handle,
  admit: () => Ref.get(admission),
  close: () => Scope.close(scope, Exit.void),
  ${captured ? "read: () => store.read()," : ""}
 };
})`,
		`(state: {
 readonly attachments: ReadonlyMap<string, unknown>;
 readonly pending: ReadonlyMap<string, unknown>;
 readonly admit: () => Effect.Effect<boolean>;
}) => Effect.fn("Inventory.read")(function* () {
 return { accepted: yield* state.admit(), attachments: state.attachments.size, pending: state.pending.size };
})`,
		"read(state)",
	).map((file) => ({
		...file,
		content: file.path.endsWith("initialize.ts")
			? file.content.replace("Context, Effect, Ref, Scope, Semaphore", "Context, Deferred, Effect, Exit, Ref, Scope, Semaphore")
			: file.content,
	}));
}
