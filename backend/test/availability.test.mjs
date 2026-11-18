import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateRooms } from "../dist/availability.js";

const rooms = [
  { id: 1, category: "double_standard", ready: true },
  { id: 2, category: "double_standard", ready: true },
  { id: 3, category: "family_executive", ready: true },
];
const item = (id, start, end, roomId = null) => ({
  id,
  category: "double_standard",
  start: start * 60000,
  end: end * 60000,
  bufferMinutes: 15,
  roomId,
});

test("half-open intervals include cleaning buffer and allow the exact buffered boundary", () => {
  assert.equal(
    allocateRooms(
      [rooms[0]],
      [item("old", 0, 60, 1)],
      [],
      [item("new", 60, 90)],
    ),
    null,
  );
  assert.equal(
    allocateRooms(
      [rooms[0]],
      [item("old", 0, 60, 1)],
      [],
      [item("new", 75, 90)],
    )[0],
    1,
  );
});

test("joint feasibility accounts for room-specific maintenance and roomless prior claims", () => {
  const claims = [item("prior", 0, 60)];
  const blocks = [{ roomId: 1, start: 0, end: 75 * 60000 }];
  assert.deepEqual(
    allocateRooms(rooms, claims, blocks, [item("later", 75, 90)]),
    [1],
  );
  assert.equal(
    allocateRooms(rooms, claims, blocks, [item("overlap", 30, 45)]),
    null,
  );
});

test("different cart schedules are assigned together without changing other items", () => {
  const cart = [
    item("early", 0, 60),
    item("late", 75, 135),
    item("family", 0, 60),
  ];
  cart[2].category = "family_executive";
  assert.deepEqual(
    allocateRooms(rooms, [item("fixed", 0, 60, 1)], [], cart),
    [2, 1, 3],
  );
});

test("fixed room conflicts and immediate non-ready rooms are unavailable", () => {
  assert.equal(
    allocateRooms(rooms, [item("a", 0, 60, 1), item("b", 30, 90, 1)], [], []),
    null,
  );
  assert.equal(
    allocateRooms(
      [{ ...rooms[0], ready: false }],
      [],
      [],
      [item("now", 0, 60)],
      0,
    ),
    null,
  );
});
