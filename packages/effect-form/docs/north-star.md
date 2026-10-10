# North star

## The problem

A form has three different kinds of values. An input holds encoded data, such as a numeric string or an omitted optional field. A service receives decoded domain data. The server sends a baseline that may change while the person editing still has local input. Treating all three as one object either moves decoding into every component or lets a refresh erase unfinished work.

Submission introduces another race. The person can edit while a schema decodes or a save runs; a refresh can arrive before the save finishes; the server can normalize the submitted values. A successful save says that one submitted snapshot was accepted. It does not say that every value currently on screen was saved, or that an older snapshot may replace a newer baseline.

The package owns this one form session. Root Platform guidance makes it the path for forms, while native Schema owns codecs and validation, native atoms own runtime state, and `effect-react` owns the composition with queries and save commands.

## The ideal

Define field data once with `Schema.Struct`. Inputs use its encoded types; submission uses its decoded types. The form runs handlers and checks in the supplied atom runtime, so their application dependencies remain explicit. A caller can use the core without React, and React hooks read and write the same form.

A received value merges per field. A field equal to its baseline adopts the received value; a locally edited field stays as it is. Revert restores the latest baseline, including the absence of optional keys. A successful save accepts its submitted encoded snapshot without erasing edits made afterwards. If a refresh arrived during the save, it remains the baseline, while fields still equal to the accepted submission can adopt the next refresh.

Feedback describes current input. A check result appears only when its input is still the field's value and the check has completed. A server rejection for an older submitted value does not become the error on a newer edit. General submission failures remain available to the application rather than acquiring guessed field locations or package-owned wording.

## What good looks like

- A numeric input stays a string while edited and reaches a handler as the number its codec defines.
- Invalid submission fails before the handler runs, and a field rejection can be corrected and retried.
- A refresh updates a clean field beside a dirty one without discarding the dirty input.
- A successful save accepts exactly its submission; newer edits remain dirty.
- A later server baseline survives an earlier save completing, and revert restores that later baseline.
- The form, its runtime and its registry have explicit owners. A component preserves the form for one editing session rather than recreating it on each render.

## Trade-offs

**Preserve editing intent before normalizing the display.** Submission accepts encoded input as saved. A caller that wants the normalized saved row on screen receives that row explicitly. This keeps form mechanics separate from the application's choice of canonical server values.

**Authoritative validation before advisory feedback.** The schema and handler decide whether a submission is accepted. Debounced checks are useful for early feedback, but they are not a second validation model or a promise that a server will accept the value.

**Native pieces before convenience.** Keep the atom result, refs and runtime available rather than replacing them with package-specific equivalents. React hooks are adapters, not another implementation of draft state.

**A small field model before a general form language.** Address top-level schema keys. A nested editor can use a whole encoded value as a field; path-addressed nested fields, field arrays and a general form language require a separate scope decision.

## What it leaves out

- Rendering inputs, accessible labels, error presentation or product wording.
- Acquiring queries, choosing entity keys or coordinating create and edit screens; `effect-react` composes those jobs with this form.
- Transport, authentication, authorization, persistence and live-update delivery.
- Deciding when an editing session ends, or carrying drafts between entities, sessions or devices.
- A replacement for Schema codecs, atom runtimes or native result handling.
