import { expect, test } from "vitest";
import { EventMachine } from "./eventMachine.ts";

test("reduces state and notifies subscribers", () => {
  const machine = new EventMachine(0, (n, e: "inc" | "dec") => (e === "inc" ? n + 1 : n - 1));
  const seen: string[] = [];
  const off = machine.subscribe((e) => seen.push(e));
  machine.send("inc");
  off();
  machine.send("inc");
  expect(machine.state).toBe(2);
  expect(seen).toEqual(["inc"]);
});
