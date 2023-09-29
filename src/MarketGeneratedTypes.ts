export type Ticker = string;

export type Left<T> = { tag: "left"; value: T };
export type Right<T> = { tag: "right"; value: T };
export type Either<L, R> = Left<L> | Right<R>;

export function Left<T>(data: T): Left<T> {
  return {
    tag: "left",
    value: data,
  };
}

export function Right<T>(data: T): Right<T> {
  return {
    tag: "right",
    value: data,
  };
}

export function match<T, L, R>(
  input: Either<L, R>,
  left: (left: L) => T,
  right: (right: R) => T
) {
  switch (input.tag) {
    case "left":
      return left(input.value);
    case "right":
      return right(input.value);
  }
}

export function isRight<L, R>(either: Either<L, R>): either is Right<R> {
  return either.tag === "right";
}

export function isLeft<L, R>(either: Either<L, R>): either is Left<L> {
  return either.tag === "left";
}
