-- X01 candidate only. Separate owner approval is required before hosted application.
-- No inventory, guests, payments or refund transfers are seeded.
create table staytrack.cancellation_requests (
 room_booking_id uuid primary key references staytrack.room_bookings(id),
 guest_auth_user_id uuid,
 guest_email text,
 staff_auth_user_id uuid,
 request_key text not null check (request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 requested_at timestamptz not null,
 confirmation_at timestamptz,
 eligibility text not null check(eligibility in ('eligible','outside_window','checked_in','walk_in_policy_pending','extra_bed_policy_pending','unconfirmed')),
 check ((guest_auth_user_id is not null and guest_email is not null and staff_auth_user_id is null)
   or (guest_auth_user_id is null and guest_email is null and staff_auth_user_id is not null))
);
create unique index cancellation_guest_retry on staytrack.cancellation_requests(guest_auth_user_id,request_key) where guest_auth_user_id is not null;
create unique index cancellation_staff_retry on staytrack.cancellation_requests(staff_auth_user_id,request_key) where staff_auth_user_id is not null;
create table staytrack.cancellation_decisions (
 room_booking_id uuid primary key references staytrack.cancellation_requests(room_booking_id),
 approved boolean not null,
 refund_centavos bigint not null check(refund_centavos>=0),
 actor_auth_user_id uuid not null,
 request_key text not null check (request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 decided_at timestamptz not null default clock_timestamp(),
 check(approved or refund_centavos=0),
 unique(actor_auth_user_id,request_key)
);
create table staytrack.refund_claims (
 room_booking_id uuid primary key references staytrack.cancellation_decisions(room_booking_id),
 original_payment_id uuid not null references staytrack.verified_online_payments(submission_id),
 actor_auth_user_id uuid not null,
 request_key text not null check (request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 payer_name text not null check(length(btrim(payer_name)) between 1 and 120),
 payer_account text not null check(payer_account ~ '^09[0-9]{9}$'),
 verification_note text not null check(length(btrim(verification_note)) between 1 and 1000),
 ledger_checked boolean not null check(ledger_checked),
 original_payer_matched boolean not null check(original_payer_matched),
 claimed_at timestamptz not null default clock_timestamp(),
 unique(actor_auth_user_id,request_key)
);
create table staytrack.refund_transfers (
 room_booking_id uuid primary key references staytrack.refund_claims(room_booking_id),
 actor_auth_user_id uuid not null,
 request_key text not null check (request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 amount_centavos bigint not null check(amount_centavos>0),
 currency text not null default 'PHP' check(currency='PHP'),
 normalized_reference text not null unique check(normalized_reference ~ '^[A-Z0-9]{1,100}$'),
 transferred_at timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 transfer_checked boolean not null check(transfer_checked),
 unique(actor_auth_user_id,request_key)
);
-- These are private append-only events, not browser-editable state.
do $$ declare t text; begin
 foreach t in array array['cancellation_requests','cancellation_decisions','refund_claims','refund_transfers'] loop
  execute format('alter table staytrack.%I enable row level security',t);
  execute format('revoke all on staytrack.%I from public,anon,authenticated',t);
  execute format('create trigger immutable_history before update or delete on staytrack.%I for each row execute function staytrack.protect_payment_review_history()',t);
 end loop;
end $$;

create function staytrack.guard_cancellation_request() returns trigger language plpgsql set search_path='' as $$
declare item record; begin
 select b.*,r.channel,r.owner_auth_user_id,r.verified_email,r.online_confirmation_at,
   r.total_centavos as reservation_total,i.state as claim_state
 into item from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id
 join staytrack.inventory_claims i on i.id=b.claim_id where b.id=new.room_booking_id for update of r,b,i;
 if not found then raise exception 'Room item not found'; end if;
 if new.staff_auth_user_id is not null then
  perform 1 from staytrack.staff_accounts where auth_user_id=new.staff_auth_user_id and active for share;
  if not found then raise exception 'Active staff required'; end if;
 elsif item.channel<>'online' or item.owner_auth_user_id is distinct from new.guest_auth_user_id
   or lower(item.verified_email) is distinct from lower(new.guest_email) then raise exception 'Verified ownership required'; end if;
 if new.requested_at>clock_timestamp() then raise exception 'Invalid server request time'; end if;
 new.confirmation_at=item.online_confirmation_at;
 new.eligibility=case
  when item.channel='walk_in' then 'walk_in_policy_pending'
  when exists(select 1 from staytrack.room_check_ins where room_booking_id=item.id) then 'checked_in'
  when item.status<>'confirmed' or item.claim_state<>'confirmed' or item.online_confirmation_at is null
    or (select coalesce(sum(v.amount_centavos),0) from staytrack.verified_online_payments v
      join staytrack.payment_submissions p on p.id=v.submission_id where p.reservation_id=item.reservation_id and p.status='confirmed')<item.reservation_total then 'unconfirmed'
  when new.requested_at<item.online_confirmation_at or new.requested_at>=item.online_confirmation_at+interval '1 hour' then 'outside_window'
  when item.extra_bed_centavos>0 then 'extra_bed_policy_pending'
  else 'eligible' end;
 if new.eligibility='unconfirmed' then raise exception 'Confirmed payment required before requesting cancellation'; end if;
 return new;
end $$;
create trigger cancellation_request_guard before insert on staytrack.cancellation_requests for each row execute function staytrack.guard_cancellation_request();

create function staytrack.guard_cancellation_decision() returns trigger language plpgsql set search_path='' as $$
declare item record; req record; begin
 perform 1 from staytrack.staff_accounts where auth_user_id=new.actor_auth_user_id and active for share;
 if not found then raise exception 'Active staff required'; end if;
 select b.*,r.channel,i.state as claim_state into item from staytrack.room_bookings b
 join staytrack.reservations r on r.id=b.reservation_id join staytrack.inventory_claims i on i.id=b.claim_id
 where b.id=new.room_booking_id for update of r,b;
 select * into req from staytrack.cancellation_requests where room_booking_id=new.room_booking_id;
 new.decided_at=clock_timestamp(); new.refund_centavos=0;
 if new.approved then
  if req.eligibility<>'eligible' or item.channel<>'online' or item.extra_bed_centavos<>0 or item.claim_state<>'confirmed'
    or exists(select 1 from staytrack.room_check_ins where room_booking_id=item.id)
    then raise exception 'Cancellation requires eligible unoccupied online capacity; unresolved policies cannot be approved'; end if;
  new.refund_centavos=item.total_centavos;
 end if;
 return new;
end $$;
create function staytrack.apply_cancellation_decision() returns trigger language plpgsql set search_path='' as $$
declare category bigint; begin
 if new.approved then
  select i.category_id into category from staytrack.inventory_claims i join staytrack.room_bookings b on b.claim_id=i.id where b.id=new.room_booking_id;
  perform pg_advisory_xact_lock(category);
  update staytrack.inventory_claims set state='released' where id=(select claim_id from staytrack.room_bookings where id=new.room_booking_id);
 end if;
 insert into staytrack.staff_audit(actor_auth_user_id,action) values(new.actor_auth_user_id,
   case when new.approved then 'room.cancellation_approved' else 'room.cancellation_rejected' end);
 return new;
end $$;
create trigger cancellation_decision_guard before insert on staytrack.cancellation_decisions for each row execute function staytrack.guard_cancellation_decision();
create trigger cancellation_decision_apply after insert on staytrack.cancellation_decisions for each row execute function staytrack.apply_cancellation_decision();

create function staytrack.guard_cancellation_checkin() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id where b.id=new.room_booking_id for update of r,b;
 if exists(select 1 from staytrack.cancellation_requests q left join staytrack.cancellation_decisions d using(room_booking_id)
   where q.room_booking_id=new.room_booking_id and ((q.eligibility='eligible' and d.room_booking_id is null) or d.approved))
 then raise exception 'Pending or approved cancellation prevents check-in'; end if;
 return new;
end $$;
create trigger cancellation_checkin_guard before insert on staytrack.room_check_ins for each row execute function staytrack.guard_cancellation_checkin();
create function staytrack.guard_cancellation_claim() returns trigger language plpgsql set search_path='' as $$
declare req record; begin
 select q.eligibility,d.approved,d.room_booking_id as decision_id into req
 from staytrack.room_bookings b join staytrack.cancellation_requests q on q.room_booking_id=b.id
 left join staytrack.cancellation_decisions d on d.room_booking_id=b.id where b.claim_id=old.id;
 if found and ((req.eligibility='eligible' and req.decision_id is null) or req.approved) then
  if req.approved and old.state<>'released' and new.state='released' and (to_jsonb(new)-'state')=(to_jsonb(old)-'state') then return new; end if;
  raise exception 'Cancellation protects item capacity';
 end if;
 return new;
end $$;
create trigger cancellation_claim_guard before update on staytrack.inventory_claims for each row execute function staytrack.guard_cancellation_claim();

create function staytrack.guard_manual_refund() returns trigger language plpgsql set search_path='' as $$
declare item record; claim record; paid bigint; refunded bigint; begin
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
  if new.amount_centavos<>item.refund_centavos then raise exception 'Transfer must equal the item refund obligation'; end if;
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
create function staytrack.audit_manual_refund() returns trigger language plpgsql set search_path='' as $$
begin
 insert into staytrack.staff_audit(actor_auth_user_id,action) values(new.actor_auth_user_id,
   case when tg_table_name='refund_claims' then 'refund.original_payer_verified_and_claimed' else 'refund.manual_transfer_recorded' end);
 return new;
end $$;
create trigger refund_claim_guard before insert on staytrack.refund_claims for each row execute function staytrack.guard_manual_refund();
create trigger refund_transfer_guard before insert on staytrack.refund_transfers for each row execute function staytrack.guard_manual_refund();
create trigger refund_claim_audit after insert on staytrack.refund_claims for each row execute function staytrack.audit_manual_refund();
create trigger refund_transfer_audit after insert on staytrack.refund_transfers for each row execute function staytrack.audit_manual_refund();

create view staytrack.reservation_financials with (security_invoker=true) as
 select r.id as reservation_id,r.total_centavos as original_centavos,
   credits.amount as cancellation_credit_centavos,
   r.total_centavos-credits.amount as net_charge_centavos,receipts.amount as collected_centavos,
   refunds.amount as refunded_centavos,credits.amount-refunds.amount as refund_due_centavos,
   r.total_centavos-credits.amount-receipts.amount+refunds.amount as balance_centavos
 from staytrack.reservations r
 cross join lateral(select coalesce(sum(d.refund_centavos),0)::bigint as amount from staytrack.cancellation_decisions d
   join staytrack.room_bookings b on b.id=d.room_booking_id where b.reservation_id=r.id and d.approved) credits
 cross join lateral(select case when r.channel='walk_in' then coalesce((select sum(amount_centavos) from staytrack.walkin_ledger where reservation_id=r.id and kind='payment'),0)
   else coalesce((select sum(v.amount_centavos) from staytrack.verified_online_payments v join staytrack.payment_submissions p on p.id=v.submission_id where p.reservation_id=r.id and p.status='confirmed'),0) end::bigint as amount) receipts
 cross join lateral(select coalesce(sum(f.amount_centavos),0)::bigint as amount from staytrack.refund_transfers f
   join staytrack.room_bookings b on b.id=f.room_booking_id where b.reservation_id=r.id) refunds;
revoke all on staytrack.reservation_financials from public,anon,authenticated;
do $$ declare f text; begin
 foreach f in array array['guard_cancellation_request','guard_cancellation_decision','apply_cancellation_decision','guard_cancellation_checkin','guard_cancellation_claim','guard_manual_refund','audit_manual_refund'] loop
  execute format('revoke all on function staytrack.%I() from public,anon,authenticated',f);
 end loop;
end $$;
