# GrowFi Realtime Production Plan

## Current State

Socket.IO state is held in process memory:

- connected players
- movement positions
- global chat history
- pending trade invites
- chat and invite rate limits

This is acceptable for a single MVP server only.

## Production Requirements

- Use Socket.IO Redis adapter for multi-instance fanout.
- Store important chat/trade invite events in Redis or Postgres.
- Keep ephemeral movement in Redis with short TTL.
- Use Redis-backed rate limits.
- Add disconnect/reconnect recovery for active room state.

## Implementation Order

1. Add Redis dependency already used by API rate limiter.
2. Add Socket.IO Redis adapter.
3. Move pending trade invites to Redis with expiry.
4. Move global chat history to Redis list with capped length.
5. Add metrics for active sockets, rooms, dropped messages, and auth failures.
