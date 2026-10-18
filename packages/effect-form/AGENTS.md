# @shivaedev/effect-form

You are changing the package that keeps a form's input values, decoded submission and server baseline together. Inputs hold strings and optional values; services need domain values; refreshes and saves arrive while someone is still typing. One Schema and one form session should be enough to handle that without a second validation model or lost edits. How to use it is in [README.md](./README.md).

## Which way to lean

When goals conflict, they win in this order:

1. **Native Schema and atoms stay visible.** Schema owns decoding and validation. The caller supplies the atom runtime; failures keep their typed channel. Do not add a parallel schema, runtime or submission engine.
2. **A person's edits survive.** Receive server values per field, keep an edited field, and retain edits made during a save. A save must not replace a newer received baseline. Revert has one meaning: restore that baseline.
3. **Input and domain values stay distinct.** Fields hold encoded values, handlers receive decoded values, and a submission carries the encoded snapshot captured before decoding. Normalizing a server result is a separate receive, not a silent rewrite of input.
4. **Feedback belongs to the value it describes.** Old checks and late field rejections must not attach to new input. Schema and submit handlers own authoritative validity; advisory checks provide feedback.
5. **One small form model.** Keep the core independent of React and adapt it with thin hooks. Edit nested values through top-level fields, report feedback by path, and use caller-supplied keys for top-level array element identity. Query acquisition, entity identity and create/edit orchestration belong to `effect-react`; UI wording, input rendering and the end of an editing session belong to the application, and drafts never move between entities, sessions or devices. Independently editable nested fields require a maintainer scope decision.
