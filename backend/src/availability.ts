export type Room = { id: number; category: string; ready: boolean };
export type Occupancy = {
  id: string;
  category: string;
  start: number;
  end: number;
  bufferMinutes: number;
  roomId: number | null;
};
export type RoomBlock = { roomId: number; start: number; end: number | null };

type Range = { start: number; end: number };
const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end;
const validRange = (start: number, end: number) =>
  Number.isSafeInteger(start) && Number.isSafeInteger(end) && start < end;

/** Returns internal room assignments for cart items, or null when no joint allocation exists. */
export function allocateRooms(
  rooms: Room[],
  existing: Occupancy[],
  blocks: RoomBlock[],
  cart: Occupancy[],
  now: number = Date.now(),
): number[] | null {
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  if (
    roomById.size !== rooms.length ||
    !Number.isSafeInteger(now) ||
    [...existing, ...cart].some(
      (item) =>
        !validRange(item.start, item.end) ||
        !Number.isSafeInteger(item.bufferMinutes) ||
        item.bufferMinutes < 0 ||
        !Number.isSafeInteger(item.end + item.bufferMinutes * 60000) ||
        (item.roomId !== null && !roomById.has(item.roomId)),
    ) ||
    blocks.some(
      (block) =>
        !roomById.has(block.roomId) ||
        !Number.isSafeInteger(block.start) ||
        (block.end !== null && !validRange(block.start, block.end)),
    )
  )
    return null;

  const used = new Map<number, Range[]>();
  for (const room of rooms) used.set(room.id, []);
  for (const block of blocks)
    used.get(block.roomId)!.push({
      start: block.start,
      end: block.end ?? Infinity,
    });

  const all = [...existing, ...cart];
  const assigned = new Array<number>(all.length);
  const choices = all.map((item) =>
    item.roomId === null
      ? rooms.filter((room) => room.category === item.category)
      : [roomById.get(item.roomId)!].filter(
          (room) => room.category === item.category,
        ),
  );
  const order = all
    .map((_, index) => index)
    .sort(
      (a, b) =>
        choices[a].length - choices[b].length || all[a].start - all[b].start,
    );

  function search(position: number): boolean {
    if (position === order.length) return true;
    const index = order[position];
    const item = all[index];
    const range = {
      start: item.start,
      end: item.end + item.bufferMinutes * 60000,
    };
    for (const room of choices[index]) {
      // A room may be sold for a future stay while currently being cleaned;
      // staff still must mark it Ready before immediate access.
      if (index >= existing.length && item.start <= now && !room.ready)
        continue;
      const occupied = used.get(room.id)!;
      if (occupied.some((other) => overlaps(range, other))) continue;
      occupied.push(range);
      assigned[index] = room.id;
      if (search(position + 1)) return true;
      occupied.pop();
    }
    return false;
  }
  return search(0) ? assigned.slice(existing.length) : null;
}
