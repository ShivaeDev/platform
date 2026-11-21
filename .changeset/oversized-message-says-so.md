---
"@shivaedev/server": minor
"@shivaedev/react": minor
---

### Added

- `@shivaedev/server`: when the host closes an RPC socket because a message exceeds `maxBodySize` or `MAX_BODY_SIZE`, it logs one warning with the limit, the message size and the RPC path, annotated as `rpc.maxBodySize`, `rpc.messageSize` and `url.path`, and none of the message's content. The size is `unknown` when the Node listener's WebSocket server refuses the message before the host reads it.
- `@shivaedev/react`: `NoticeHost`'s default wording for a command whose socket the host closed with code 1009, because the message was over its body limit, is `What you sent is too large for the server. Try again with something smaller.` instead of the lost-connection message.

### Breaking

- `@shivaedev/react`: `UnexpectedFailure["kind"]` has the new member `"tooLarge"` for that failure, so an application's own `failure` wording can tell it apart from `"connection"`. To migrate, add a `"tooLarge"` case to a `switch` over `kind` that lists every kind, or let its default branch show `failure.message`.
