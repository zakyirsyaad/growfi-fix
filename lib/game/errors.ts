export class GameError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "GameError";
    this.status = status;
  }
}

export function assertGame(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) {
    throw new GameError(message, status);
  }
}
