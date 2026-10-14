import { describe, expect, it } from "vitest";
import { positionAt } from "./board";

describe("positionAt", () => {
  it("empty column starts at 1000", () => expect(positionAt([], 0)).toBe(1000));
  it("top of column goes before first card", () => expect(positionAt([{ position: 1000 }], 0)).toBe(0));
  it("bottom of column goes after last card", () => expect(positionAt([{ position: 1000 }], 1)).toBe(2000));
  it("between two cards uses midpoint", () =>
    expect(positionAt([{ position: 1000 }, { position: 2000 }], 1)).toBe(1500));
});
