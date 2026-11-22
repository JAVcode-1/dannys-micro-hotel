-- Additive candidate, after 027. Local disposable verification only; hosted apply requires approval.
-- The shared original payment is counted once. Hall receipts below are additional
-- staff-verified collections, never copies of the original online transaction.
create or replace view staytrack.reservation_base_financials with (security_invoker=true) as
 select r.id as reservation_id,r.total_centavos as original_centavos,
   (credits.amount+hall.credit)::bigint as cancellation_credit_centavos,
   (r.total_centavos+hall.extra-credits.amount-hall.credit)::bigint as net_charge_centavos,
   (receipts.amount+hall.received)::bigint as collected_centavos,
   (refunds.amount+hall.refunded)::bigint as refunded_centavos,
   (credits.amount+hall.approved-refunds.amount-hall.refunded)::bigint as refund_due_centavos,
   (r.total_centavos+hall.extra-credits.amount-hall.credit-receipts.amount-hall.received+refunds.amount+hall.refunded)::bigint as balance_centavos
 from staytrack.reservations r
 cross join lateral(select coalesce(sum(d.refund_centavos),0)::bigint as amount from staytrack.cancellation_decisions d
   join staytrack.room_bookings b on b.id=d.room_booking_id where b.reservation_id=r.id and d.approved) credits
 cross join lateral(select case when r.channel='walk_in' then coalesce((select sum(amount_centavos) from staytrack.walkin_ledger where reservation_id=r.id and kind='payment'),0)
   else coalesce((select sum(v.amount_centavos) from staytrack.verified_online_payments v join staytrack.payment_submissions p on p.id=v.submission_id where p.reservation_id=r.id and p.status='confirmed'),0) end::bigint as amount) receipts
 cross join lateral(select coalesce(sum(f.amount_centavos),0)::bigint as amount from staytrack.refund_transfers f
   join staytrack.room_bookings b on b.id=f.room_booking_id where b.reservation_id=r.id) refunds
 cross join lateral(select
   coalesce(sum(case when h.status='cancelled' then coalesce(q.total_centavos,o.original_centavos) else 0 end),0)::bigint credit,
   coalesce(sum(coalesce(q.total_centavos,o.original_centavos)-o.original_centavos+coalesce(ot.amount_centavos,0)),0)::bigint extra,
   coalesce(sum(p.amount),0)::bigint received,
   coalesce(sum(a.amount),0)::bigint approved,
   coalesce(sum(t.amount),0)::bigint refunded
   from staytrack.online_hall_items o join staytrack.hall_reservations h on h.id=o.hall_reservation_id
   left join lateral(select total_centavos from staytrack.hall_revisions where reservation_id=h.id order by id desc limit 1) q on true
   left join staytrack.hall_overtime_charges ot on ot.reservation_id=h.id
   left join lateral(select sum(amount_centavos) amount from staytrack.hall_receipts where reservation_id=h.id) p on true
   left join lateral(select sum(amount_centavos) amount from staytrack.hall_refund_approvals where reservation_id=h.id) a on true
   left join lateral(select sum(a.amount_centavos) amount from staytrack.hall_refund_approvals a
     join staytrack.hall_refund_transfers t on t.approval_id=a.id where a.reservation_id=h.id) t on true
   where o.reservation_id=r.id) hall;
revoke all on staytrack.reservation_base_financials from public,anon,authenticated;
