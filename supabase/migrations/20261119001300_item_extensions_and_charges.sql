-- X03 candidate: NOT applied. Separate owner approval and acceptance required.
alter table staytrack.room_bookings add column stay_extension_revision bigint not null default 0 check(stay_extension_revision>=0), add column pending_extension_id uuid;
create table staytrack.stay_extension_requests (
 id uuid primary key default gen_random_uuid(), room_booking_id uuid not null references staytrack.room_bookings,
 actor_auth_user_id uuid not null, request_key text not null, request_hash text not null,
 reason text not null, expected_revision bigint not null check(expected_revision>=0), blocks integer[] not null,
 old_end timestamptz not null, new_end timestamptz not null, amount_centavos bigint not null check(amount_centavos>=0 and amount_centavos<=9007199254740991),
 package_snapshot jsonb not null, recorded_at timestamptz not null default clock_timestamp(), unique(actor_auth_user_id,request_key), unique(id,room_booking_id)
);
alter table staytrack.room_bookings add constraint pending_extension_identity foreign key(pending_extension_id,id) references staytrack.stay_extension_requests(id,room_booking_id);
create table staytrack.stay_extension_decisions (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique references staytrack.stay_extension_requests,
 room_booking_id uuid not null references staytrack.room_bookings, actor_auth_user_id uuid not null, request_key text not null, request_hash text not null,
 reason text not null, approved boolean not null, expected_revision bigint not null, recorded_at timestamptz not null default clock_timestamp(), unique(actor_auth_user_id,request_key)
);
create unique index stay_one_approved_revision on staytrack.stay_extension_decisions(room_booking_id,expected_revision) where approved;
create table staytrack.stay_charge_policy_versions (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('overtime','smoking')), rate_centavos bigint not null check(rate_centavos>0 and rate_centavos<=9007199254740991),
 effective_from timestamptz not null, effective_until timestamptz, disclosure_text text not null check(length(btrim(disclosure_text)) between 1 and 4000), disclosure_version text not null check(length(btrim(disclosure_version)) between 1 and 100),
 unit text not null, rounding text, extra_bed_treatment text check(extra_bed_treatment in ('included','not_applicable')), owner_approval_evidence text not null check(length(btrim(owner_approval_evidence)) between 1 and 1000), approved_at timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(), check(isfinite(effective_from) and (effective_until is null or (isfinite(effective_until) and effective_until>effective_from))), check((kind='smoking' and unit='incident' and rounding is null) or (kind='overtime' and unit='minute' and rounding is not null and rounding in ('ceil','floor','exact')))
);
create table staytrack.reservation_charge_disclosures (
 id uuid primary key default gen_random_uuid(), reservation_id uuid not null references staytrack.reservations, policy_version_id uuid not null references staytrack.stay_charge_policy_versions,
 disclosure_text text not null, disclosure_version text not null, acknowledgement text not null check(length(btrim(acknowledgement)) between 1 and 1000), recorded_at timestamptz not null default clock_timestamp(), unique(reservation_id,policy_version_id)
);
create table staytrack.stay_charge_reviews (
 id uuid primary key default gen_random_uuid(), room_booking_id uuid not null references staytrack.room_bookings, actor_auth_user_id uuid not null, request_key text not null, request_hash text not null,
 reason text not null, kind text not null check(kind in ('overtime','smoking')), start_at timestamptz, end_at timestamptz,
 policy_version_id uuid references staytrack.stay_charge_policy_versions, disclosure_id uuid references staytrack.reservation_charge_disclosures,
 proposed_centavos bigint, recorded_at timestamptz not null default clock_timestamp(), unique(actor_auth_user_id,request_key),
 check((kind='overtime' and start_at is not null and end_at is not null and end_at>start_at and isfinite(start_at) and isfinite(end_at)) or (kind='smoking' and start_at is null and end_at is null))
);
create table staytrack.stay_charge_entries (
 id uuid primary key default gen_random_uuid(), room_booking_id uuid not null references staytrack.room_bookings,
 actor_auth_user_id uuid not null, request_key text not null, request_hash text not null, reason text not null,
 kind text not null check(kind in ('extension_debit','overtime_debit','smoking_debit','waiver_record','charge_credit')),
 extension_request_id uuid unique references staytrack.stay_extension_requests, review_id uuid references staytrack.stay_charge_reviews,
 credit_of uuid references staytrack.stay_charge_entries, amount_centavos bigint not null check(amount_centavos>=0 and amount_centavos<=9007199254740991),
 recorded_at timestamptz not null default clock_timestamp(), unique(actor_auth_user_id,request_key),
 check((kind='extension_debit' and extension_request_id is not null and review_id is null and credit_of is null and amount_centavos>=0)
 or (kind in ('overtime_debit','smoking_debit') and review_id is not null and extension_request_id is null and credit_of is null and amount_centavos>0)
 or (kind='waiver_record' and review_id is not null and extension_request_id is null and credit_of is null and amount_centavos=0)
 or (kind='charge_credit' and credit_of is not null and review_id is null and extension_request_id is null and amount_centavos>0))
);
create unique index stay_one_review_outcome on staytrack.stay_charge_entries(review_id) where review_id is not null;
create table staytrack.stay_receipts (
 id uuid primary key default gen_random_uuid(), room_booking_id uuid not null references staytrack.room_bookings, reservation_id uuid not null references staytrack.reservations,
 actor_auth_user_id uuid not null, request_key text not null, request_hash text not null, reason text not null,
 method text not null check(method in ('cash','gcash')), amount_centavos bigint not null check(amount_centavos>0 and amount_centavos<=9007199254740991), received_at timestamptz not null,
 cash_received boolean, normalized_reference text, recipient text, ledger_checked boolean, receiving_account_checked boolean, time_checked boolean,
 recorded_at timestamptz not null default clock_timestamp(), unique(actor_auth_user_id,request_key),
 check((method='cash' and cash_received is true and normalized_reference is null and recipient is null and ledger_checked is null and receiving_account_checked is null and time_checked is null)
 or (method='gcash' and cash_received is null and normalized_reference is not null and normalized_reference ~ '^[A-Z0-9]{1,100}$' and recipient is not null and length(btrim(recipient)) between 1 and 120 and ledger_checked is true and receiving_account_checked is true and time_checked is true))
);
create table staytrack.stay_receipt_allocations (
 id uuid primary key default gen_random_uuid(), receipt_id uuid not null references staytrack.stay_receipts, room_booking_id uuid not null references staytrack.room_bookings,
 actor_auth_user_id uuid not null, request_key text not null, request_hash text not null, reason text not null,
 kind text not null check(kind in ('allocate','release')), extension_request_id uuid references staytrack.stay_extension_requests, charge_id uuid references staytrack.stay_charge_entries,
 release_of uuid unique references staytrack.stay_receipt_allocations, amount_centavos bigint not null check(amount_centavos>0 and amount_centavos<=9007199254740991),
 recorded_at timestamptz not null default clock_timestamp(), unique(actor_auth_user_id,request_key),
 check(num_nonnulls(extension_request_id,charge_id)=1), check((kind='allocate' and release_of is null) or (kind='release' and release_of is not null))
);
create view staytrack.stay_active_allocations with (security_invoker=true) as select a.* from staytrack.stay_receipt_allocations a where a.kind='allocate' and not exists(select 1 from staytrack.stay_receipt_allocations r where r.release_of=a.id);
create view staytrack.stay_item_terms with (security_invoker=true) as select b.id as room_booking_id,s.checkout_at as original_checkout_at,
 s.checkout_at+coalesce((select sum((q.new_end-q.old_end)) from staytrack.stay_extension_requests q join staytrack.stay_extension_decisions d on d.request_id=q.id where q.room_booking_id=b.id and d.approved),interval '0') as effective_checkout_at,b.stay_extension_revision
 from staytrack.room_bookings b join staytrack.room_check_ins s on s.room_booking_id=b.id;

alter table staytrack.room_bookings add constraint stay_item_reservation_identity unique(id,reservation_id);
alter table staytrack.stay_extension_requests add column source_claim_id bigint not null references staytrack.inventory_claims, add column source_room_id bigint not null references staytrack.rooms, add column source_start_at timestamptz not null, add column source_buffer_minutes integer not null, add column baseline_checkout_at timestamptz not null,add column category_snapshot text not null;
alter table staytrack.stay_extension_decisions add column old_revision bigint not null,add column new_revision bigint not null,add column old_end timestamptz not null,add column new_end timestamptz not null,add column source_snapshot jsonb not null,
 add constraint decision_item_identity foreign key(request_id,room_booking_id) references staytrack.stay_extension_requests(id,room_booking_id);
do $$ declare t text; begin
 foreach t in array array['stay_extension_requests','stay_extension_decisions','stay_charge_reviews','stay_charge_entries','stay_receipt_allocations'] loop
 execute format('alter table staytrack.%I add column reservation_id uuid not null, add constraint item_reservation_identity foreign key(room_booking_id,reservation_id) references staytrack.room_bookings(id,reservation_id)',t);
 end loop;
 foreach t in array array['stay_extension_requests','stay_charge_entries','stay_receipts'] loop
 execute format('alter table staytrack.%I add unique(id,reservation_id)',t);
 end loop;
 foreach t in array array['stay_charge_entries','stay_receipt_allocations'] loop
 execute format('alter table staytrack.%I add constraint extension_reservation_identity foreign key(extension_request_id,reservation_id) references staytrack.stay_extension_requests(id,reservation_id)',t);
 end loop;
end $$;
alter table staytrack.stay_receipt_allocations add foreign key(receipt_id,reservation_id) references staytrack.stay_receipts(id,reservation_id),add foreign key(charge_id,reservation_id) references staytrack.stay_charge_entries(id,reservation_id);
alter table staytrack.stay_receipts add foreign key(room_booking_id,reservation_id) references staytrack.room_bookings(id,reservation_id);
-- Validate actors and serialize every event with the reservation and room item.
create function staytrack.lock_stay_item(item_id uuid, actor uuid) returns uuid language plpgsql set search_path='' as $$
declare reservation uuid; begin
 perform 1 from staytrack.staff_accounts where auth_user_id=actor and active for share; if not found then raise exception 'Active staff required'; end if;
 select r.id into reservation from staytrack.reservations r join staytrack.room_bookings b on b.reservation_id=r.id where b.id=item_id for update of r,b;
 if not found then raise exception 'Room item not found'; end if; return reservation;
end $$;
create function staytrack.guard_stay_event() returns trigger language plpgsql set search_path='' as $$ begin
 new.reservation_id=staytrack.lock_stay_item(new.room_booking_id,new.actor_auth_user_id);
 if new.request_key !~ '^[A-Za-z0-9_-]{16,100}$' or new.request_hash !~ '^[a-f0-9]{64}$' or length(btrim(new.reason)) not between 1 and 1000 or new.reason ~ '[[:cntrl:]]' then raise exception 'Valid event evidence required'; end if;
 new.recorded_at=clock_timestamp(); return new;
end $$;
create function staytrack.audit_stay_event() returns trigger language plpgsql set search_path='' as $$ begin
 insert into staytrack.staff_audit(actor_auth_user_id,action) values(new.actor_auth_user_id,'stay.'||tg_table_name); return new;
end $$;
create function staytrack.guard_charge_disclosure() returns trigger language plpgsql set search_path='' as $$ begin
 -- Acknowledgements may only accompany an actual new reservation transaction.
 perform 1 from staytrack.reservations r join staytrack.stay_charge_policy_versions p on p.id=new.policy_version_id
 where r.id=new.reservation_id and r.xmin::text=pg_current_xact_id()::text and r.created_at=transaction_timestamp() and p.approved_at<=r.created_at and p.recorded_at<=r.created_at for update of r;
 if not found then raise exception 'Genuine booking-time approved disclosure required'; end if;
 select disclosure_text,disclosure_version into new.disclosure_text,new.disclosure_version from staytrack.stay_charge_policy_versions where id=new.policy_version_id;
 new.recorded_at=clock_timestamp(); return new;
end $$;
create trigger charge_disclosure_guard before insert on staytrack.reservation_charge_disclosures for each row execute function staytrack.guard_charge_disclosure();
create function staytrack.stay_quote(category text,blocks integer[]) returns jsonb language plpgsql set search_path='' as $$
declare snapshot jsonb; begin
 if cardinality(blocks) not between 1 and 30 or array_position(blocks,null) is not null or exists(select 1 from unnest(blocks) x where x not in (180,360,720,1440) or (category='family_executive' and x=180)) then raise exception 'Allowed packages required'; end if;
 perform 1 from staytrack.packages p join staytrack.room_categories c on c.id=p.category_id where c.code=category and c.active and p.active and p.duration_minutes=any(blocks) for share of p,c;
 select jsonb_agg(jsonb_build_object('id',p.id,'version',p.version,'durationMinutes',p.duration_minutes,'priceCentavos',p.price_centavos) order by b.n) into snapshot
 from unnest(blocks) with ordinality b(minutes,n) join staytrack.packages p on p.category_code=category and p.duration_minutes=b.minutes and p.active join staytrack.room_categories c on c.id=p.category_id and c.active;
 if jsonb_array_length(snapshot) is distinct from cardinality(blocks) or exists(select 1 from jsonb_array_elements(snapshot) x where (x->>'priceCentavos')::bigint<0) then raise exception 'Approved additional package price required'; end if; return snapshot;
end $$;
create function staytrack.stay_quote_current(category text,blocks integer[]) returns jsonb language plpgsql set search_path='' as $$ begin
 return staytrack.stay_quote(category,blocks); exception when raise_exception then return null;
end $$;
create function staytrack.guard_stay_extension_request() returns trigger language plpgsql set search_path='' as $$
declare b staytrack.room_bookings; total_minutes bigint; begin
 select * into b from staytrack.room_bookings where id=new.room_booking_id;
 if b.stay_extension_revision<>new.expected_revision or b.pending_extension_id is not null or not exists(select 1 from staytrack.stay_item_terms where room_booking_id=b.id) or exists(select 1 from staytrack.room_checkouts where room_booking_id=b.id) then raise exception 'Current checked-in item required'; end if;
 select effective_checkout_at into new.old_end from staytrack.stay_item_terms where room_booking_id=b.id;
 select c.id,c.room_id,c.start_at,c.buffer_minutes,t.original_checkout_at into new.source_claim_id,new.source_room_id,new.source_start_at,new.source_buffer_minutes,new.baseline_checkout_at from staytrack.inventory_claims c join staytrack.stay_item_terms t on t.room_booking_id=b.id where c.id=b.claim_id;
 select code into new.category_snapshot from staytrack.room_categories where id=(select category_id from staytrack.inventory_claims where id=b.claim_id);
 if new.category_snapshot is distinct from b.category_code then raise exception 'Original category required'; end if;
 new.package_snapshot=staytrack.stay_quote(new.category_snapshot,new.blocks);
 select sum(x) into total_minutes from unnest(new.blocks) x; new.new_end=new.old_end+total_minutes*interval '1 minute';
 select sum((x->>'priceCentavos')::bigint) into new.amount_centavos from jsonb_array_elements(new.package_snapshot) x;
 if new.new_end<=clock_timestamp() then raise exception 'Purchased checkout has already passed'; end if; return new;
end $$;
create function staytrack.apply_stay_extension_request() returns trigger language plpgsql set search_path='' as $$ begin
 update staytrack.room_bookings set pending_extension_id=new.id where id=new.room_booking_id; return new;
end $$;
create function staytrack.guard_stay_receipt() returns trigger language plpgsql set search_path='' as $$
declare r staytrack.reservations; begin
 select r0.* into r from staytrack.reservations r0 join staytrack.room_bookings b on b.reservation_id=r0.id where b.id=new.room_booking_id;
 new.reservation_id=r.id;
 if not exists(select 1 from staytrack.room_check_ins where room_booking_id=new.room_booking_id) or (new.method='cash' and r.channel<>'walk_in') or new.received_at>clock_timestamp() or not isfinite(new.received_at) then raise exception 'Verified supported receipt required'; end if; return new;
end $$;
alter table staytrack.gcash_reference_registry add column stay_receipt_id uuid unique references staytrack.stay_receipts;
alter table staytrack.gcash_reference_registry drop constraint gcash_reference_registry_check;
alter table staytrack.gcash_reference_registry add constraint gcash_reference_one_source check(num_nonnulls(online_submission_id,walkin_entry_id,stay_receipt_id)=1);
create or replace function staytrack.register_gcash_reference() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_table_name='verified_online_payments' then insert into staytrack.gcash_reference_registry(normalized_reference,online_submission_id) values(new.normalized_reference,new.submission_id);
 elsif tg_table_name='stay_receipts' and new.method='gcash' then insert into staytrack.gcash_reference_registry(normalized_reference,stay_receipt_id) values(new.normalized_reference,new.id);
 elsif new.method='gcash' then insert into staytrack.gcash_reference_registry(normalized_reference,walkin_entry_id) values(new.normalized_reference,new.id); end if; return new;
end $$;
create trigger stay_receipt_reference after insert on staytrack.stay_receipts for each row execute function staytrack.register_gcash_reference();
create function staytrack.guard_stay_allocation() returns trigger language plpgsql set search_path='' as $$
declare receipt staytrack.stay_receipts; original staytrack.stay_receipt_allocations; target_item uuid; cap bigint; used bigint; begin
 select * into receipt from staytrack.stay_receipts where id=new.receipt_id for update;
 if receipt.reservation_id is distinct from (select reservation_id from staytrack.room_bookings where id=new.room_booking_id) then raise exception 'Same reservation receipt required'; end if;
 if new.kind='release' then
  select * into original from staytrack.stay_receipt_allocations where id=new.release_of;
  if original.kind is distinct from 'allocate' or original.extension_request_id is null or exists(select 1 from staytrack.stay_extension_decisions where request_id=original.extension_request_id and approved)
   or not exists(select 1 from staytrack.stay_extension_requests q join staytrack.room_bookings b on b.id=q.room_booking_id left join staytrack.stay_extension_decisions d on d.request_id=q.id where q.id=original.extension_request_id and (d.approved=false or q.expected_revision<>b.stay_extension_revision or q.new_end<=clock_timestamp() or q.package_snapshot is distinct from staytrack.stay_quote_current(b.category_code,q.blocks)))
   or (new.receipt_id,new.room_booking_id,new.extension_request_id,new.charge_id,new.amount_centavos) is distinct from (original.receipt_id,original.room_booking_id,original.extension_request_id,original.charge_id,original.amount_centavos) then raise exception 'Only exact rejected or stale commitment release is supported'; end if;
  return new;
 end if;
 if new.extension_request_id is not null then
  select room_booking_id,amount_centavos into target_item,cap from staytrack.stay_extension_requests where id=new.extension_request_id;
  if exists(select 1 from staytrack.stay_extension_decisions where request_id=new.extension_request_id and not approved) then raise exception 'Rejected request cannot receive funding'; end if;
 else
  select room_booking_id,amount_centavos into target_item,cap from staytrack.stay_charge_entries where id=new.charge_id and kind in ('overtime_debit','smoking_debit');
  cap=cap-coalesce((select sum(amount_centavos) from staytrack.stay_charge_entries where credit_of=new.charge_id),0);
 end if;
 if target_item is distinct from new.room_booking_id or cap is null then raise exception 'Valid item obligation required'; end if;
 select coalesce(sum(amount_centavos),0) into used from staytrack.stay_active_allocations where receipt_id=receipt.id;
 if used+new.amount_centavos>receipt.amount_centavos then raise exception 'Receipt already allocated'; end if;
 select coalesce(sum(amount_centavos),0) into used from staytrack.stay_active_allocations where (new.extension_request_id is not null and extension_request_id=new.extension_request_id) or (new.charge_id is not null and charge_id=new.charge_id);
 if used+new.amount_centavos>cap then raise exception 'Target already funded'; end if; return new;
end $$;
create function staytrack.guard_stay_charge_review() returns trigger language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from staytrack.room_check_ins where room_booking_id=new.room_booking_id) then raise exception 'Checked-in history required'; end if;
 if new.policy_version_id is null and new.disclosure_id is null then
  -- Only one applicable genuinely disclosed policy may be selected automatically.
  if (select count(*) from staytrack.reservation_charge_disclosures d join staytrack.stay_charge_policy_versions p on p.id=d.policy_version_id where d.reservation_id=new.reservation_id and p.kind=new.kind and p.effective_from<=coalesce(new.start_at,new.recorded_at) and (p.effective_until is null or p.effective_until>=coalesce(new.end_at,new.recorded_at)))=1 then
   select p.id,d.id into new.policy_version_id,new.disclosure_id from staytrack.reservation_charge_disclosures d join staytrack.stay_charge_policy_versions p on p.id=d.policy_version_id where d.reservation_id=new.reservation_id and p.kind=new.kind and p.effective_from<=coalesce(new.start_at,new.recorded_at) and (p.effective_until is null or p.effective_until>=coalesce(new.end_at,new.recorded_at));
  end if;
 end if;
 select case when new.kind='smoking' then p.rate_centavos when p.rounding='ceil' then ceil(extract(epoch from(new.end_at-new.start_at))/60)*p.rate_centavos when p.rounding='floor' then floor(extract(epoch from(new.end_at-new.start_at))/60)*p.rate_centavos when p.rounding='exact' and mod(extract(epoch from(new.end_at-new.start_at)),60)=0 then extract(epoch from(new.end_at-new.start_at))/60*p.rate_centavos end into new.proposed_centavos from staytrack.stay_charge_policy_versions p where p.id=new.policy_version_id and p.kind=new.kind and p.effective_from<=coalesce(new.start_at,new.recorded_at) and (p.effective_until is null or p.effective_until>=coalesce(new.end_at,new.recorded_at));
 return new;
end $$;
create function staytrack.guard_stay_charge_entry() returns trigger language plpgsql set search_path='' as $$
declare q staytrack.stay_extension_requests; review staytrack.stay_charge_reviews; p staytrack.stay_charge_policy_versions; debit staytrack.stay_charge_entries; paid bigint; credited bigint; units numeric; begin
 if new.kind='extension_debit' then
  select * into q from staytrack.stay_extension_requests where id=new.extension_request_id;
  if new.room_booking_id is distinct from q.room_booking_id or new.amount_centavos is distinct from q.amount_centavos or not exists(select 1 from staytrack.stay_extension_decisions d where d.request_id=q.id and d.approved and d.actor_auth_user_id=new.actor_auth_user_id) then raise exception 'Approved extension debit required'; end if;
 elsif new.kind='charge_credit' then
  select * into debit from staytrack.stay_charge_entries where id=new.credit_of;
  select coalesce(sum(amount_centavos),0) into paid from staytrack.stay_active_allocations where charge_id=debit.id;
  select coalesce(sum(amount_centavos),0) into credited from staytrack.stay_charge_entries where credit_of=debit.id;
  if debit.kind not in ('overtime_debit','smoking_debit') or debit.room_booking_id is distinct from new.room_booking_id or new.amount_centavos>debit.amount_centavos-paid-credited then raise exception 'Only unpaid incident debt can be credited'; end if;
 else
  select * into review from staytrack.stay_charge_reviews where id=new.review_id;
  if review.room_booking_id is distinct from new.room_booking_id then raise exception 'Matching review required'; end if;
  if review.kind='overtime' and exists(select 1 from staytrack.stay_charge_reviews r join staytrack.stay_charge_entries e on e.review_id=r.id where r.room_booking_id=review.room_booking_id and r.kind='overtime' and tstzrange(r.start_at,r.end_at,'[)') && tstzrange(review.start_at,review.end_at,'[)')) then raise exception 'Overtime interval already decided'; end if;
  if review.kind='overtime' and (review.end_at>clock_timestamp() or review.start_at<(select effective_checkout_at from staytrack.stay_item_terms where room_booking_id=new.room_booking_id)) then raise exception 'Terminal overtime must be outside purchased time'; end if;
  if new.kind='waiver_record' then new.amount_centavos=0; return new; end if;
  if exists(select 1 from staytrack.room_checkouts where room_booking_id=new.room_booking_id) then raise exception 'New fees after departure are policy pending'; end if;
  select pv.* into p from staytrack.stay_charge_policy_versions pv join staytrack.reservation_charge_disclosures d on d.policy_version_id=pv.id join staytrack.room_bookings b on b.reservation_id=d.reservation_id
   where d.id=review.disclosure_id and pv.id=review.policy_version_id and pv.kind=review.kind and b.id=new.room_booking_id and pv.effective_from<=coalesce(review.start_at,review.recorded_at) and (pv.effective_until is null or pv.effective_until>=coalesce(review.end_at,review.recorded_at)) and d.disclosure_text=pv.disclosure_text and d.disclosure_version=pv.disclosure_version;
  if not found or new.kind<>review.kind||'_debit' or ((select extra_bed_centavos from staytrack.room_bookings where id=new.room_booking_id)>0 and p.extra_bed_treatment is distinct from 'included') then raise exception 'Approved rate and genuine prior disclosure required'; end if;
  if review.kind='overtime' then
   if review.end_at>clock_timestamp() or review.start_at<(select effective_checkout_at from staytrack.stay_item_terms where room_booking_id=new.room_booking_id) then raise exception 'Overtime cannot overlap purchased time'; end if;
   units=extract(epoch from (review.end_at-review.start_at))/60;
   if p.rounding='ceil' then units=ceil(units); elsif p.rounding='floor' then units=floor(units); elsif p.rounding is distinct from 'exact' or units<>trunc(units) then raise exception 'Approved exact minute rounding required'; end if;
  else units=1; end if;
  if new.amount_centavos is distinct from units*p.rate_centavos then raise exception 'Policy-derived charge required'; end if;
 end if; return new;
end $$;
create function staytrack.guard_stay_extension_decision() returns trigger language plpgsql set search_path='' as $$
declare q staytrack.stay_extension_requests; b staytrack.room_bookings; c staytrack.inventory_claims; funded bigint; begin
 select * into q from staytrack.stay_extension_requests where id=new.request_id;
 if not found then raise exception 'Extension request required'; end if;
 if new.room_booking_id is distinct from q.room_booking_id then raise exception 'Matching room item required'; end if;
 select * into b from staytrack.room_bookings where id=q.room_booking_id;
 if b.pending_extension_id is distinct from q.id or new.expected_revision<>q.expected_revision then raise exception 'Current extension request required'; end if;
 new.old_revision=q.expected_revision; new.new_revision=q.expected_revision+case when new.approved then 1 else 0 end;
 new.old_end=q.old_end; new.new_end=case when new.approved then q.new_end else q.old_end end;
 new.source_snapshot=jsonb_build_object('claimId',q.source_claim_id,'roomId',q.source_room_id,'startAt',q.source_start_at,'bufferMinutes',q.source_buffer_minutes,'baselineCheckoutAt',q.baseline_checkout_at);
 if not new.approved then return new; end if;
 perform 1 from staytrack.stay_receipts r where r.id in(select receipt_id from staytrack.stay_active_allocations where extension_request_id=q.id) order by r.id for update;
 select coalesce(sum(amount_centavos),0) into funded from staytrack.stay_active_allocations where extension_request_id=q.id;
 if funded<(q.amount_centavos/2+q.amount_centavos%2) or b.stay_extension_revision<>q.expected_revision or q.new_end<=clock_timestamp()
 or q.old_end is distinct from (select effective_checkout_at from staytrack.stay_item_terms where room_booking_id=b.id)
 or q.package_snapshot is distinct from staytrack.stay_quote_current(b.category_code,q.blocks) or exists(select 1 from staytrack.room_checkouts where room_booking_id=b.id) then raise exception 'Current funded extension required'; end if;
 select * into c from staytrack.inventory_claims where id=b.claim_id;
 perform pg_advisory_xact_lock(c.category_id); select * into c from staytrack.inventory_claims where id=b.claim_id for update;
 lock table staytrack.room_blocks in share mode;
 perform 1 from staytrack.rooms where id=c.room_id and active and operational_state='occupied' for update;
 if not found or c.state not in ('confirmed','walkin_reserved') or c.end_at<>q.old_end or (c.id,c.room_id,c.start_at,c.buffer_minutes) is distinct from (q.source_claim_id,q.source_room_id,q.source_start_at,q.source_buffer_minutes) or q.baseline_checkout_at is distinct from (select checkout_at from staytrack.room_check_ins where room_booking_id=b.id and room_id=c.room_id) or b.category_code is distinct from q.category_snapshot or q.category_snapshot is distinct from (select code from staytrack.room_categories where id=c.category_id) or exists(select 1 from staytrack.refund_claims where room_booking_id=b.id) then raise exception 'Original occupied capacity required'; end if;
 if exists(select 1 from staytrack.room_blocks x where x.room_id=c.room_id and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(q.old_end,q.new_end+c.buffer_minutes*interval '1 minute','[)'))
 or exists(select 1 from staytrack.inventory_claims x where x.id<>c.id and x.room_id=c.room_id and x.state not in ('released','expired') and tstzrange(x.start_at,x.buffered_end_at,'[)') && tstzrange(q.old_end,q.new_end+c.buffer_minutes*interval '1 minute','[)'))
 or exists(select 1 from staytrack.stay_charge_reviews r join staytrack.stay_charge_entries e on e.review_id=r.id where r.room_booking_id=b.id and r.kind='overtime' and tstzrange(r.start_at,r.end_at,'[)') && tstzrange(q.old_end,q.new_end,'[)')) then raise exception 'Extension conflicts with capacity or terminal overtime'; end if;
 return new;
end $$;
create function staytrack.apply_stay_extension_decision() returns trigger language plpgsql set search_path='' as $$
declare q staytrack.stay_extension_requests; begin
 select * into q from staytrack.stay_extension_requests where id=new.request_id;
 if new.approved then
  insert into staytrack.stay_charge_entries(room_booking_id,actor_auth_user_id,request_key,request_hash,reason,kind,extension_request_id,amount_centavos) values(new.room_booking_id,new.actor_auth_user_id,'extension-debit-'||new.id,new.request_hash,new.reason,'extension_debit',q.id,q.amount_centavos);
  update staytrack.room_bookings set stay_extension_revision=stay_extension_revision+1,pending_extension_id=null where id=q.room_booking_id;
  update staytrack.inventory_claims set end_at=q.new_end,buffered_end_at=q.new_end+buffer_minutes*interval '1 minute' where id=(select claim_id from staytrack.room_bookings where id=q.room_booking_id);
 else update staytrack.room_bookings set pending_extension_id=null where id=q.room_booking_id; end if; return new;
end $$;
create function staytrack.guard_stay_extension_projection() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='INSERT' then if new.stay_extension_revision<>0 or new.pending_extension_id is not null then raise exception 'Initial extension revision must be zero'; end if; return new; end if;
 if new.category_code is distinct from old.category_code then raise exception 'Original item category is immutable'; end if;
 if new.stay_extension_revision is distinct from old.stay_extension_revision and (new.stay_extension_revision<>old.stay_extension_revision+1 or not exists(select 1 from staytrack.stay_extension_decisions d where d.room_booking_id=new.id and d.approved and d.expected_revision=old.stay_extension_revision)) then raise exception 'Approved extension revision required'; end if;
 if new.pending_extension_id is distinct from old.pending_extension_id then
  if new.pending_extension_id is not null and not exists(select 1 from staytrack.stay_extension_requests q where q.id=new.pending_extension_id and q.room_booking_id=new.id and q.expected_revision=new.stay_extension_revision and not exists(select 1 from staytrack.stay_extension_decisions d where d.request_id=q.id)) then raise exception 'Valid pending extension required'; end if;
  if new.pending_extension_id is null and old.pending_extension_id is not null and not exists(select 1 from staytrack.stay_extension_decisions where request_id=old.pending_extension_id) then raise exception 'Recorded decision required'; end if;
 end if; return new;
end $$;
create trigger stay_extension_projection before insert or update on staytrack.room_bookings for each row execute function staytrack.guard_stay_extension_projection();
create trigger stay_extension_request_guard before insert on staytrack.stay_extension_requests for each row execute function staytrack.guard_stay_extension_request();
create trigger stay_extension_request_apply after insert on staytrack.stay_extension_requests for each row execute function staytrack.apply_stay_extension_request();
create trigger stay_extension_decision_guard before insert on staytrack.stay_extension_decisions for each row execute function staytrack.guard_stay_extension_decision();
create trigger stay_extension_decision_apply after insert on staytrack.stay_extension_decisions for each row execute function staytrack.apply_stay_extension_decision();
create trigger stay_receipt_guard before insert on staytrack.stay_receipts for each row execute function staytrack.guard_stay_receipt();
create trigger stay_allocation_guard before insert on staytrack.stay_receipt_allocations for each row execute function staytrack.guard_stay_allocation();
create trigger stay_review_guard before insert on staytrack.stay_charge_reviews for each row execute function staytrack.guard_stay_charge_review();
create trigger stay_charge_guard before insert on staytrack.stay_charge_entries for each row execute function staytrack.guard_stay_charge_entry();
do $$ declare t text; begin
 foreach t in array array['stay_extension_requests','stay_extension_decisions','stay_charge_reviews','stay_charge_entries','stay_receipts','stay_receipt_allocations'] loop
 execute format('create trigger a_stay_actor before insert on staytrack.%I for each row execute function staytrack.guard_stay_event()',t);
 execute format('create trigger z_stay_audit after insert on staytrack.%I for each row execute function staytrack.audit_stay_event()',t);
 end loop;
 foreach t in array array['stay_extension_requests','stay_extension_decisions','stay_charge_reviews','stay_charge_entries','stay_receipts','stay_receipt_allocations','stay_charge_policy_versions','reservation_charge_disclosures'] loop
 execute format('alter table staytrack.%I enable row level security',t);
 execute format('revoke all on staytrack.%I from public,anon,authenticated',t);
 execute format('create trigger immutable_history before update or delete on staytrack.%I for each row execute function staytrack.protect_payment_review_history()',t);
 end loop;
end $$;

create or replace function staytrack.protect_checked_in_claim() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from staytrack.room_check_ins s
    join staytrack.room_bookings b on b.id=s.room_booking_id where b.claim_id=old.id)
  then
    if old.state <> 'released' and new.state='released'
      and (to_jsonb(new)-'state')=(to_jsonb(old)-'state')
      and exists (select 1 from staytrack.room_checkouts o
        join staytrack.room_bookings b on b.id=o.room_booking_id
        join staytrack.room_blocks p on p.id=o.cleaning_block_id
        where b.claim_id=old.id and p.room_id=old.room_id
        and p.start_at=o.checked_out_at
        and p.end_at >= greatest(old.buffered_end_at,
          o.checked_out_at + old.buffer_minutes * interval '1 minute'))
    then return new; end if;
if new.end_at>old.end_at and new.buffered_end_at=new.end_at+old.buffer_minutes*interval '1 minute'
 and (to_jsonb(new)-'end_at'-'buffered_end_at')=(to_jsonb(old)-'end_at'-'buffered_end_at')
 and exists(select 1 from staytrack.room_bookings b join staytrack.stay_extension_requests q on q.room_booking_id=b.id join staytrack.stay_extension_decisions d on d.request_id=q.id where b.claim_id=old.id and d.approved and q.old_end=old.end_at and q.new_end=new.end_at and b.stay_extension_revision=q.expected_revision+1) then return new; end if;
     raise exception 'Checked-in capacity is protected';
  end if;
  return new;
end; $$;


create or replace function staytrack.guard_reschedule_claim_projection() returns trigger language plpgsql set search_path='' as $$
declare b staytrack.room_bookings;
begin
 if (new.start_at,new.end_at,new.room_id,new.buffer_minutes) is not distinct from (old.start_at,old.end_at,old.room_id,old.buffer_minutes) then return null; end if;
 select * into b from staytrack.room_bookings where claim_id=new.id;
 if not found then return null; end if;
 if exists(select 1 from staytrack.room_check_ins s where s.room_booking_id=b.id and s.room_id=new.room_id
   and (s.checked_in_at=new.start_at or (b.start_at=new.start_at and b.start_at<=s.checked_in_at))
   and s.checkout_at=new.end_at and new.buffered_end_at=new.end_at+new.buffer_minutes*interval '1 minute') then return null; end if;
 if exists(select 1 from staytrack.reschedule_decisions d where d.room_booking_id=b.id and d.approved
  and d.new_revision=b.schedule_revision and d.old_room_id=old.room_id and d.new_room_id=new.room_id
  and d.old_start_at=old.start_at and d.old_end_at=old.end_at and d.new_start_at=new.start_at and d.new_end_at=new.end_at
  and b.start_at=new.start_at and b.end_at=new.end_at and new.buffer_minutes=old.buffer_minutes
  and new.buffered_end_at=new.end_at+new.buffer_minutes*interval '1 minute') then return null; end if;
if new.end_at>old.end_at and new.buffered_end_at=new.end_at+old.buffer_minutes*interval '1 minute'
 and (to_jsonb(new)-'end_at'-'buffered_end_at')=(to_jsonb(old)-'end_at'-'buffered_end_at')
 and exists(select 1 from staytrack.room_bookings rb join staytrack.stay_extension_requests q on q.room_booking_id=rb.id join staytrack.stay_extension_decisions d on d.request_id=q.id where rb.claim_id=old.id and d.approved and q.old_end=old.end_at and q.new_end=new.end_at and rb.stay_extension_revision=q.expected_revision+1) then return null; end if;
  raise exception 'Approved schedule event or recorded check-in required';
end $$;


create view staytrack.reservation_base_financials with (security_invoker=true) as
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
create or replace view staytrack.reservation_financials with (security_invoker=true) as
 select f.reservation_id,f.original_centavos,f.cancellation_credit_centavos,
 (f.net_charge_centavos+extra.net)::bigint as net_charge_centavos,
 (f.collected_centavos+received.amount)::bigint as collected_centavos,f.refunded_centavos,f.refund_due_centavos,
 (f.balance_centavos+extra.net-received.amount)::bigint as balance_centavos,
 (greatest(0,f.balance_centavos)+extra.due)::bigint as settlement_due_centavos,
 (received.amount-allocated.amount)::bigint as unallocated_x03_centavos,pending.amount::bigint as pending_extension_funds_centavos
 from staytrack.reservation_base_financials f
 cross join lateral(select coalesce(sum(amount_centavos),0) as amount from staytrack.stay_receipts where reservation_id=f.reservation_id) received
 cross join lateral(select coalesce(sum(a.amount_centavos),0) as amount from staytrack.stay_active_allocations a join staytrack.room_bookings b on b.id=a.room_booking_id where b.reservation_id=f.reservation_id) allocated
 cross join lateral(select coalesce(sum(a.amount_centavos),0) as amount from staytrack.stay_active_allocations a join staytrack.room_bookings b on b.id=a.room_booking_id where b.reservation_id=f.reservation_id and a.extension_request_id is not null and not exists(select 1 from staytrack.stay_extension_decisions d where d.request_id=a.extension_request_id and d.approved)) pending
 cross join lateral(select coalesce(sum(e.amount_centavos-coalesce(c.amount,0)),0) as net,
 coalesce(sum(e.amount_centavos-coalesce(c.amount,0)-coalesce(a.amount,0)),0) as due
 from staytrack.stay_charge_entries e join staytrack.room_bookings b on b.id=e.room_booking_id
 left join lateral(select sum(amount_centavos) as amount from staytrack.stay_charge_entries where credit_of=e.id) c on true
 left join lateral(select sum(amount_centavos) as amount from staytrack.stay_active_allocations where charge_id=e.id or (e.extension_request_id is not null and extension_request_id=e.extension_request_id)) a on true
 where b.reservation_id=f.reservation_id and e.kind in ('extension_debit','overtime_debit','smoking_debit')) extra;
revoke all on staytrack.reservation_financials,staytrack.reservation_base_financials,staytrack.stay_item_terms,staytrack.stay_active_allocations from public,anon,authenticated;
create function staytrack.guard_stay_checkout_settlement() returns trigger language plpgsql set search_path='' as $$
declare reservation uuid; due bigint; begin
 reservation=staytrack.lock_stay_item(new.room_booking_id,new.actor_auth_user_id);
 select settlement_due_centavos into due from staytrack.reservation_financials where reservation_id=reservation;
 if new.balance_centavos is distinct from due or (due>0 and new.exception_reason is null) then raise exception 'Current settlement or documented unpaid departure required'; end if; return new;
end $$;
create trigger stay_checkout_settlement before insert on staytrack.room_checkouts for each row execute function staytrack.guard_stay_checkout_settlement();
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='staytrack' and (p.proname like '%stay_%' or p.proname in ('guard_charge_disclosure','register_gcash_reference','protect_checked_in_claim','guard_reschedule_claim_projection')) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;

create function staytrack.guard_reservation_creation_time() returns trigger language plpgsql set search_path='' as $$ begin
 if new.created_at is distinct from old.created_at then raise exception 'Original reservation creation time is immutable'; end if; return new;
end $$;
revoke all on function staytrack.guard_reservation_creation_time() from public,anon,authenticated;
create trigger reservation_creation_time before update on staytrack.reservations for each row execute function staytrack.guard_reservation_creation_time();

-- Reciprocal protection: a maintenance insert that loses to activation cannot obstruct purchased capacity.
create function staytrack.guard_extended_room_block() returns trigger language plpgsql set search_path='' as $$
declare category bigint; begin
 select category_id into category from staytrack.rooms where id=new.room_id; perform pg_advisory_xact_lock(category);
 if exists(select 1 from staytrack.stay_extension_requests q join staytrack.stay_extension_decisions d on d.request_id=q.id join staytrack.room_bookings b on b.id=q.room_booking_id join staytrack.inventory_claims c on c.id=b.claim_id
 where d.approved and c.state not in ('released','expired') and c.room_id=new.room_id and tstzrange(new.start_at,new.end_at,'[)') && tstzrange(q.old_end,q.new_end+c.buffer_minutes*interval '1 minute','[)')) then raise exception 'Maintenance conflicts with purchased extension'; end if; return null;
end $$;
revoke all on function staytrack.guard_extended_room_block() from public,anon,authenticated;
create constraint trigger extended_room_block after insert or update on staytrack.room_blocks deferrable initially deferred for each row execute function staytrack.guard_extended_room_block();

-- Every public centavo projection stays exactly representable on the existing wire.
create function staytrack.guard_stay_financial_limits() returns trigger language plpgsql set search_path='' as $$
declare f record; v jsonb; begin
 select * into f from staytrack.reservation_financials where reservation_id=new.reservation_id;
 for v in select value from jsonb_each(to_jsonb(f)-'reservation_id') loop
  if abs(v::text::numeric)>9007199254740991 then raise exception 'Reservation monetary total exceeds safe supported range'; end if;
 end loop;
 if f.settlement_due_centavos<0 or f.unallocated_x03_centavos<0 or f.pending_extension_funds_centavos<0 then raise exception 'Financial conservation required'; end if; return null;
end $$;
revoke all on function staytrack.guard_stay_financial_limits() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['stay_extension_requests','stay_extension_decisions','stay_charge_entries','stay_receipts','stay_receipt_allocations'] loop
 execute format('create constraint trigger zz_stay_financial_limits after insert on staytrack.%I deferrable initially deferred for each row execute function staytrack.guard_stay_financial_limits()',t);
 end loop;
end $$;
