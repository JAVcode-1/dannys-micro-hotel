import type { PoolClient } from "pg";
import type { BookingQuote } from "@staytrack/shared";

// Shared persistence only; callers own pricing, capacity and authorization.
export async function insertBookedItems(
  client: PoolClient,
  reservationId: string,
  quote: BookingQuote,
  claimIds: number[],
) {
  for (const [index, item] of quote.items.entries()) {
    await client.query(
      `insert into staytrack.room_bookings
      (reservation_id,item_index,claim_id,category_code,start_at,end_at,adult_count,child_count,
      base_centavos,extra_bed_centavos,total_centavos,pricing_snapshot)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
        reservationId,
        index,
        claimIds[index],
        item.category,
        item.startAt,
        item.endAt,
        item.adults,
        item.children,
        item.baseCentavos,
        item.extraBedCentavos,
        item.totalCentavos,
        JSON.stringify(item.packages),
      ],
    );
  }
}
