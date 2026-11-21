---
"@shivaedev/server": minor
"@shivaedev/react": minor
---

### Added

- `@shivaedev/server`: when the host closes an RPC socket because a message exceeds `maxBodySize` or `MAX_BODY_SIZE`, it logs one warning with the limit, the message size and the RPC path, annotated as `rpc.maxBodySize`, `rpc.messageSize` and `url.path`, and none of the message's content. The size is `unknown` when the Node listener's WebSocket server refuses the message before the host reads it.
- `@shivaedev/react`: `UnexpectedFailure` has the kind `"tooLarge"` for a command whose socket the host closed with code 1009 because the message was over its body limit, and `NoticeHost`'s default wording for it is `What you sent is too large for the server. Try again with something smaller.` instead of the lost-connection message. An application's own `failure` wording can tell it apart from `"connection"`; a `switch` over `kind` that lists every kind needs a `"tooLarge"` case.
