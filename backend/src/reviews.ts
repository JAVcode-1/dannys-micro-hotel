import type { PublishedReviewPage } from "@staytrack/shared";
import type { PoolClient } from "pg";
import { randomBytes } from "node:crypto";
import { BookingError } from "./booking-quote.js";
import type { GuestIdentity } from "./guest-auth.js";
import {
  loadReviewEligibility,
  lockReviewReservation,
  reviewDigest,
  verifiedReviewGrant,
  type ReviewAction,
} from "./review-access.js";

type Access = { guest: GuestIdentity; reservation: string } | { token: string };

async function authorize(
  client: PoolClient,
  access: Access,
  action: ReviewAction,
) {
  const reservation =
    "guest" in access
      ? access.reservation
      : await verifiedReviewGrant(client, access.token, action);
  if (!reservation) throw new BookingError("Review access denied.", 403);
  await lockReviewReservation(client, reservation);
  if ("guest" in access) {
    const owner = await client.query(
      "select 1 from staytrack.reservations where id=$1 and owner_auth_user_id=$2 and verified_email=$3",
      [reservation, access.guest.id, access.guest.email],
    );
    if (!owner.rowCount) throw new BookingError("Review access denied.", 403);
  }
  const eligibility = await loadReviewEligibility(client, reservation);
  if (!eligibility.first_checkout)
    throw new BookingError("Review access denied.", 403);
  return { reservation, eligibility };
}

export async function submitGuestReview(
  client: PoolClient,
  access: Access,
  input: {
    key: string;
    stars: number;
    comment: string | null;
    consent: boolean;
  },
) {
  if (
    !input.consent ||
    !Number.isInteger(input.stars) ||
    input.stars < 1 ||
    input.stars > 5
  )
    throw new BookingError("Choose a rating and agree to public submission.");
  const { reservation, eligibility } = await authorize(
    client,
    access,
    "review",
  );
  const hash = reviewDigest(
    JSON.stringify([input.stars, input.comment, input.consent]),
  );
  const previous = await client.query<{
    id: string;
    request_key: string;
    request_hash: string;
  }>(
    "select id,request_key,request_hash from staytrack.guest_reviews where reservation_id=$1",
    [reservation],
  );
  if (previous.rows[0]) {
    const row = previous.rows[0];
    if (row.request_key === input.key && row.request_hash === hash)
      return { id: row.id, replayed: true };
    throw new BookingError("This reservation already has a rating.", 409);
  }
  if (!eligibility.public_open)
    throw new BookingError("The review submission period has closed.", 410);
  const inserted = await client.query<{ id: string }>(
    `insert into staytrack.guest_reviews(reservation_id,stars,comment,alias,request_key,request_hash)
      values ($1,$2,$3,$4,$5,$6) returning id`,
    [
      reservation,
      input.stars,
      input.comment,
      "Guest " + randomBytes(5).toString("hex"),
      input.key,
      hash,
    ],
  );
  return { id: inserted.rows[0].id, replayed: false };
}

export async function submitPrivateFeedback(
  client: PoolClient,
  access: Access,
  input: {
    key: string;
    message: string;
    followUp: boolean;
  },
) {
  const { reservation } = await authorize(client, access, "feedback");
  const hash = reviewDigest(JSON.stringify([input.message, input.followUp]));
  const previous = await client.query<{ id: string; request_hash: string }>(
    "select id,request_hash from staytrack.private_feedback where reservation_id=$1 and request_key=$2",
    [reservation, input.key],
  );
  if (previous.rows[0]) {
    if (previous.rows[0].request_hash !== hash)
      throw new BookingError("Request differs from the original.", 409);
    return { id: previous.rows[0].id, replayed: true };
  }
  const inserted = await client.query<{ id: string }>(
    `insert into staytrack.private_feedback(reservation_id,message,follow_up_email,request_key,request_hash)
      select r.id,$2,case when $3 then coalesce(r.verified_email,c.email) end,$4,$5
      from staytrack.reservations r left join staytrack.review_contacts c on c.reservation_id=r.id
      where r.id=$1 returning id`,
    [reservation, input.message, input.followUp, input.key, hash],
  );
  return { id: inserted.rows[0].id, replayed: false };
}

export async function withdrawGuestReview(
  client: PoolClient,
  access: Access,
  key: string,
) {
  const { reservation } = await authorize(client, access, "withdrawal");
  const { rows } = await client.query<{ id: string; status: string }>(
    "select id,status from staytrack.guest_reviews where reservation_id=$1 for update",
    [reservation],
  );
  const review = rows[0];
  if (!review) throw new BookingError("Review access denied.", 403);
  if (review.status === "withdrawn") return;
  await client.query(
    "update staytrack.guest_reviews set status='withdrawn' where id=$1",
    [review.id],
  );
  await client.query(
    `insert into staytrack.review_events(review_id,actor_auth_user_id,actor_grant_digest,action,previous_status,next_status,request_key,request_hash)
      values($1,$2,$3,'withdraw',$4,'withdrawn',$5,$6)`,
    [
      review.id,
      "guest" in access ? access.guest.id : null,
      "token" in access ? reviewDigest(access.token) : null,
      review.status,
      key,
      reviewDigest("withdraw"),
    ],
  );
}

export async function publishedReviews(client: PoolClient, page: number) {
  const { rows } = await client.query<PublishedReviewPage>(
    `
    with published as (
      select r.id,r.alias,r.stars,r.comment,r.submitted_at published_at,p.message reply
      from staytrack.guest_reviews r left join staytrack.review_replies p on p.review_id=r.id
      where r.status='published'
    ), page as (
      select * from published order by published_at desc,id desc offset $1 limit 20
    )
    select (select coalesce(json_agg(page order by published_at desc,id desc),'[]') from page) reviews,
      count(*)::int count,round(avg(stars),2)::float average,
      array(select (select count(*)::int from published p where p.stars=s)
        from generate_series(1,5) s order by s) distribution
    from published`,
    [(page - 1) * 20],
  );
  return rows[0];
}
