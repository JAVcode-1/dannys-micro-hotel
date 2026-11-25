-- Preserve completed transfers at their historically recorded amounts.
alter table staytrack.refund_transfers
  drop constraint refund_transfers_pkey,
  add column id uuid not null default gen_random_uuid() primary key;
create index refund_transfers_room_booking_id_idx on staytrack.refund_transfers(room_booking_id);

alter table staytrack.hall_refund_transfers
  drop constraint hall_refund_transfers_pkey,
  add column id uuid not null default gen_random_uuid() primary key,
  add column amount_centavos bigint;
alter table staytrack.hall_refund_transfers disable trigger immutable;
update staytrack.hall_refund_transfers t set amount_centavos=a.amount_centavos
  from staytrack.hall_refund_approvals a where a.id=t.approval_id;
alter table staytrack.hall_refund_transfers enable trigger immutable;
alter table staytrack.hall_refund_transfers
  alter column amount_centavos set not null,
  add constraint hall_refund_transfer_amount_positive check(amount_centavos>0);
create index hall_refund_transfers_approval_id_idx on staytrack.hall_refund_transfers(approval_id);

create function staytrack.guard_hall_refund_installment() returns trigger language plpgsql set search_path='' as $$
declare approved bigint; refunded bigint;
begin
  select amount_centavos into approved from staytrack.hall_refund_approvals
    where id=new.approval_id for update;
  if not found then raise exception 'Approved Hall refund required'; end if;
  select coalesce(sum(amount_centavos),0) into refunded
    from staytrack.hall_refund_transfers where approval_id=new.approval_id;
  if new.amount_centavos>approved-refunded then
    raise exception 'Transfer exceeds the remaining Hall refund';
  end if;
  return new;
end $$;
revoke all on function staytrack.guard_hall_refund_installment() from public,anon,authenticated;
create trigger hall_refund_installment_guard before insert on staytrack.hall_refund_transfers
  for each row execute function staytrack.guard_hall_refund_installment();

create table staytrack.refund_issues (
  kind text not null check(kind in ('room','hall')),
  item_id uuid not null,
  room_item_id uuid generated always as (case when kind='room' then item_id end) stored
    references staytrack.room_bookings(id),
  hall_item_id uuid generated always as (case when kind='hall' then item_id end) stored
    references staytrack.hall_reservations(id),
  received_centavos bigint not null check(received_centavos>=0),
  details text not null check(length(btrim(details)) between 1 and 1000),
  reported_by uuid not null,
  reported_at timestamptz not null default clock_timestamp(),
  resolution text check(length(btrim(resolution)) between 1 and 1000),
  resolved_by uuid,
  resolved_at timestamptz,
  primary key(kind,item_id),
  check((resolution is null and resolved_by is null and resolved_at is null)
    or (resolution is not null and resolved_by is not null and resolved_at is not null))
);
alter table staytrack.refund_issues enable row level security;
revoke all on staytrack.refund_issues from public,anon,authenticated;

create or replace function staytrack.guard_manual_refund() returns trigger language plpgsql set search_path='' as $$
declare item record; claim record; paid bigint; refunded bigint; item_refunded bigint; begin
 perform 1 from staytrack.staff_accounts where auth_user_id=new.actor_auth_user_id and active for share;
 if not found then raise exception 'Active staff required'; end if;
 select b.reservation_id,d.approved,d.refund_centavos into item from staytrack.room_bookings b
 join staytrack.reservations r on r.id=b.reservation_id join staytrack.cancellation_decisions d on d.room_booking_id=b.id
 where b.id=new.room_booking_id for update of r,b;
 if not found or not item.approved or item.refund_centavos<=0 then raise exception 'Approved refundable cancellation required'; end if;
 if tg_table_name='refund_claims' then
  perform 1 from staytrack.verified_online_payments v join staytrack.payment_submissions p on p.id=v.submission_id
    where v.submission_id=new.original_payment_id and p.reservation_id=item.reservation_id and p.status='confirmed';
  if not found then raise exception 'Original verified payment required'; end if;
  new.claimed_at=clock_timestamp();
 else
  select * into claim from staytrack.refund_claims where room_booking_id=new.room_booking_id;
  if claim.actor_auth_user_id is distinct from new.actor_auth_user_id then raise exception 'Refund is claimed by another staff member; reconcile, never transfer twice'; end if;
  select coalesce(sum(amount_centavos),0) into item_refunded
    from staytrack.refund_transfers where room_booking_id=new.room_booking_id;
  if new.amount_centavos>item.refund_centavos-item_refunded then
    raise exception 'Transfer exceeds the remaining item refund';
  end if;
  if new.transferred_at<date_trunc('milliseconds',claim.claimed_at) or new.transferred_at>clock_timestamp() then raise exception 'Invalid transfer time'; end if;
  select coalesce(sum(v.amount_centavos),0) into paid from staytrack.verified_online_payments v
    join staytrack.payment_submissions p on p.id=v.submission_id where p.reservation_id=item.reservation_id and p.status='confirmed';
  select coalesce(sum(f.amount_centavos),0) into refunded from staytrack.refund_transfers f
    join staytrack.room_bookings b on b.id=f.room_booking_id where b.reservation_id=item.reservation_id;
  if refunded+new.amount_centavos>paid then raise exception 'Refund exceeds verified funds'; end if;
  new.recorded_at=clock_timestamp();
 end if;
 return new;
end $$;

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
   left join lateral(select sum(t.amount_centavos) amount from staytrack.hall_refund_approvals a
     join staytrack.hall_refund_transfers t on t.approval_id=a.id where a.reservation_id=h.id) t on true
   where o.reservation_id=r.id) hall;
revoke all on staytrack.reservation_base_financials from public,anon,authenticated;
