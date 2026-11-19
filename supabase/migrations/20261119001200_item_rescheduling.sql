-- X02 candidate only. Separate owner approval required; no seed or hosted application.
alter table staytrack.room_bookings
 add column schedule_revision bigint not null default 0 check(schedule_revision>=0),
 add column pending_reschedule_id uuid;

create table staytrack.reschedule_requests (
 id uuid primary key default gen_random_uuid(),
 room_booking_id uuid not null references staytrack.room_bookings(id),
 guest_auth_user_id uuid, guest_email text, staff_auth_user_id uuid,
 request_key text not null check(request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 expected_revision bigint not null check(expected_revision>=0),
 requested_start_at timestamptz not null,
 requested_end_at timestamptz not null check(requested_end_at>requested_start_at),
 blocks integer[] not null check(cardinality(blocks) between 1 and 30 and array_position(blocks,null) is null),
 original_blocks integer[] not null,
 original_start_at timestamptz not null, original_end_at timestamptz not null,
 original_room_id bigint not null references staytrack.rooms(id),
 source_claim_id bigint not null references staytrack.inventory_claims(id),
 original_buffer_minutes integer not null,
 original_centavos bigint not null check(original_centavos>=0),
 confirmation_at timestamptz,
 eligibility text not null check(eligibility in ('eligible','walk_in_policy_pending','extra_bed_policy_pending','financial_policy_pending')),
 comparison_snapshot jsonb,
 comparison_centavos bigint check(comparison_centavos>=0),
 requested_at timestamptz not null default clock_timestamp(),
 unique(id,room_booking_id),
 check((guest_auth_user_id is not null and guest_email is not null and staff_auth_user_id is null)
    or (guest_auth_user_id is null and guest_email is null and staff_auth_user_id is not null))
);
create unique index reschedule_guest_retry on staytrack.reschedule_requests(guest_auth_user_id,request_key) where guest_auth_user_id is not null;
create unique index reschedule_staff_retry on staytrack.reschedule_requests(staff_auth_user_id,request_key) where staff_auth_user_id is not null;
alter table staytrack.room_bookings add constraint item_pending_reschedule foreign key(pending_reschedule_id,id)
 references staytrack.reschedule_requests(id,room_booking_id);
create unique index item_pending_reschedule_unique on staytrack.room_bookings(pending_reschedule_id) where pending_reschedule_id is not null;
create table staytrack.reschedule_decisions (
 request_id uuid primary key references staytrack.reschedule_requests(id),
 room_booking_id uuid not null references staytrack.room_bookings(id),
 actor_auth_user_id uuid not null,
 request_key text not null check(request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 expected_revision bigint not null,
 approved boolean not null,
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 old_start_at timestamptz not null, old_end_at timestamptz not null,
 new_start_at timestamptz not null, new_end_at timestamptz not null,
 old_room_id bigint not null references staytrack.rooms(id),
 new_room_id bigint not null references staytrack.rooms(id),
 old_revision bigint not null, new_revision bigint not null,
 decided_at timestamptz not null default clock_timestamp(),
 unique(actor_auth_user_id,request_key),
 check((approved and new_revision=old_revision+1) or
  (not approved and new_revision=old_revision and new_start_at=old_start_at and new_end_at=old_end_at and new_room_id=old_room_id))
);
create unique index reschedule_approved_revision on staytrack.reschedule_decisions(room_booking_id,new_revision) where approved;
create table staytrack.reschedule_adjustment_proposals (
 request_id uuid primary key references staytrack.reschedule_requests(id),
 room_booking_id uuid not null references staytrack.room_bookings(id),
 original_centavos bigint not null check(original_centavos>=0),
 comparison_centavos bigint not null check(comparison_centavos>=0),
 delta_centavos bigint not null check(delta_centavos=comparison_centavos-original_centavos),
 currency text not null default 'PHP' check(currency='PHP'),
 status text not null default 'policy_pending' check(status='policy_pending'),
 package_snapshot jsonb not null
);
do $$ declare t text; begin
 foreach t in array array['reschedule_requests','reschedule_decisions','reschedule_adjustment_proposals'] loop
  execute format('alter table staytrack.%I enable row level security',t);
  execute format('revoke all on staytrack.%I from public,anon,authenticated',t);
  execute format('create trigger immutable_history before update or delete on staytrack.%I for each row execute function staytrack.protect_payment_review_history()',t);
 end loop;
end $$;

create function staytrack.guard_reschedule_request() returns trigger language plpgsql set search_path='' as $$
declare item record; source_blocks integer[]; minutes bigint; quoted bigint; packages jsonb;
begin
 select b.*,r.channel,r.owner_auth_user_id,r.verified_email,r.online_confirmation_at,r.total_centavos as reservation_total,
 i.state as claim_state,i.room_id,i.buffer_minutes into item
 from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id
 join staytrack.inventory_claims i on i.id=b.claim_id where b.id=new.room_booking_id for update of r,b,i;
 if not found then raise exception 'Room item not found'; end if;
 if new.staff_auth_user_id is not null then
  perform 1 from staytrack.staff_accounts where auth_user_id=new.staff_auth_user_id and active for share;
  if not found then raise exception 'Active staff required'; end if;
 elsif item.channel<>'online' or item.owner_auth_user_id is distinct from new.guest_auth_user_id
   or lower(item.verified_email) is distinct from lower(new.guest_email) then raise exception 'Verified ownership required'; end if;
 if item.pending_reschedule_id is not null or new.expected_revision<>item.schedule_revision
   or exists(select 1 from staytrack.room_check_ins where room_booking_id=item.id)
   or item.claim_state not in ('confirmed','walkin_reserved')
   or (item.channel='online' and (item.status<>'confirmed' or item.online_confirmation_at is null
     or (select coalesce(sum(v.amount_centavos),0) from staytrack.verified_online_payments v
       join staytrack.payment_submissions p on p.id=v.submission_id where p.reservation_id=item.reservation_id and p.status='confirmed')<item.reservation_total))
 then raise exception 'Current unoccupied confirmed item required'; end if;
 if exists(select 1 from staytrack.cancellation_requests q left join staytrack.cancellation_decisions d using(room_booking_id)
  where q.room_booking_id=item.id and ((q.eligibility='eligible' and d.room_booking_id is null) or d.approved))
 then raise exception 'Cancellation prevents rescheduling'; end if;
 select array_agg((p->>'durationMinutes')::integer order by n) into source_blocks
 from jsonb_array_elements(item.pricing_snapshot) with ordinality a(p,n);
 if cardinality(new.blocks) not between 1 and 30 or array_position(new.blocks,null) is not null
   or exists(select 1 from unnest(new.blocks) x where x not in (180,360,720,1440) or (item.category_code='family_executive' and x=180))
 then raise exception 'Allowed packages required'; end if;
 select sum(x) into minutes from unnest(new.blocks) x;
 if new.requested_start_at<=clock_timestamp() or not isfinite(new.requested_start_at) or not isfinite(new.requested_end_at)
   or date_trunc('minute',new.requested_start_at)<>new.requested_start_at
   or new.requested_end_at<>new.requested_start_at+minutes*interval '1 minute'
   or (new.requested_start_at=item.start_at and new.requested_end_at=item.end_at and new.blocks=source_blocks)
 then raise exception 'A different future package schedule is required'; end if;
 new.original_blocks=source_blocks; new.original_start_at=item.start_at; new.original_end_at=item.end_at;
 new.original_room_id=item.room_id; new.original_buffer_minutes=item.buffer_minutes;
 new.source_claim_id=item.claim_id;
 new.original_centavos=item.total_centavos; new.confirmation_at=item.online_confirmation_at;
 new.requested_at=clock_timestamp(); new.comparison_snapshot=null; new.comparison_centavos=null;
 if new.blocks<>source_blocks then
  perform 1 from staytrack.packages p join staytrack.room_categories c on c.id=p.category_id
   where c.code=item.category_code and c.active and p.active and p.duration_minutes=any(new.blocks) for share of p,c;
  select sum(p.price_centavos),jsonb_agg(jsonb_build_object('id',p.id,'version',p.version,
    'durationMinutes',p.duration_minutes,'priceCentavos',p.price_centavos) order by b.n)
  into quoted,packages from unnest(new.blocks) with ordinality b(minutes,n)
   join staytrack.packages p on p.category_code=item.category_code and p.duration_minutes=b.minutes and p.active
   join staytrack.room_categories c on c.id=p.category_id and c.active;
  if jsonb_array_length(packages) is distinct from cardinality(new.blocks) then raise exception 'Comparison package unavailable'; end if;
  new.comparison_centavos=quoted+item.extra_bed_centavos; new.comparison_snapshot=packages;
 end if;
 new.eligibility=case when item.channel='walk_in' then 'walk_in_policy_pending'
  when item.extra_bed_centavos>0 then 'extra_bed_policy_pending'
  when new.blocks<>source_blocks then 'financial_policy_pending' else 'eligible' end;
 return new;
end $$;

create function staytrack.apply_reschedule_request() returns trigger language plpgsql set search_path='' as $$
begin
 update staytrack.room_bookings set pending_reschedule_id=new.id where id=new.room_booking_id;
 if new.comparison_centavos is not null then
  insert into staytrack.reschedule_adjustment_proposals(request_id,room_booking_id,original_centavos,comparison_centavos,delta_centavos,package_snapshot)
  values(new.id,new.room_booking_id,new.original_centavos,new.comparison_centavos,new.comparison_centavos-new.original_centavos,new.comparison_snapshot);
 end if;
 if new.staff_auth_user_id is not null then
  insert into staytrack.staff_audit(actor_auth_user_id,action) values(new.staff_auth_user_id,'room.reschedule_requested');
 end if;
 return new;
end $$;

create function staytrack.guard_reschedule_proposal() returns trigger language plpgsql set search_path='' as $$
declare q staytrack.reschedule_requests; begin
 select * into q from staytrack.reschedule_requests where id=new.request_id;
 if q.comparison_centavos is null or new.room_booking_id is distinct from q.room_booking_id
  or new.original_centavos is distinct from q.original_centavos or new.comparison_centavos is distinct from q.comparison_centavos
  or new.package_snapshot is distinct from q.comparison_snapshot then raise exception 'Proposal must match server request quote'; end if;
 return new;
end $$;

create function staytrack.guard_reschedule_decision() returns trigger language plpgsql set search_path='' as $$
declare item record; q staytrack.reschedule_requests; category bigint;
begin
 perform 1 from staytrack.staff_accounts where auth_user_id=new.actor_auth_user_id and active for share;
 if not found then raise exception 'Active staff required'; end if;
 select * into q from staytrack.reschedule_requests where id=new.request_id;
 if not found then raise exception 'Request not found'; end if;
 select b.*,r.channel,r.owner_auth_user_id,r.verified_email,r.online_confirmation_at,r.total_centavos as reservation_total,
 i.state as claim_state,i.room_id,i.category_id,i.buffer_minutes,i.start_at as claim_start,i.end_at as claim_end into item
 from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id
 join staytrack.inventory_claims i on i.id=b.claim_id where b.id=q.room_booking_id for update of r,b;
 if item.pending_reschedule_id is distinct from q.id or new.expected_revision<>q.expected_revision
 then raise exception 'Request is no longer current'; end if;
 new.room_booking_id=item.id; new.old_start_at=item.start_at; new.old_end_at=item.end_at;
 new.old_room_id=item.room_id; new.old_revision=item.schedule_revision; new.decided_at=clock_timestamp();
 if not new.approved then
  new.new_start_at=item.start_at; new.new_end_at=item.end_at; new.new_room_id=item.room_id; new.new_revision=item.schedule_revision;
  return new;
 end if;
 category=item.category_id; perform pg_advisory_xact_lock(category);
 perform 1 from staytrack.inventory_claims where id=item.claim_id for update;
 -- Re-read claim after its lock; a standalone capacity writer may have committed while we waited.
 select state,room_id,buffer_minutes,start_at,end_at into item.claim_state,item.room_id,item.buffer_minutes,item.claim_start,item.claim_end
 from staytrack.inventory_claims where id=item.claim_id;
 if q.eligibility<>'eligible' or item.channel<>'online' or item.extra_bed_centavos<>0
  or item.status<>'confirmed' or item.claim_state<>'confirmed' or item.online_confirmation_at is null
  or item.claim_id<>q.source_claim_id or item.schedule_revision<>q.expected_revision or item.start_at<>q.original_start_at or item.end_at<>q.original_end_at
  or item.room_id<>q.original_room_id or item.buffer_minutes<>q.original_buffer_minutes
  or item.claim_start<>item.start_at or item.claim_end<>item.end_at
  or q.requested_start_at<=clock_timestamp() or q.blocks<>q.original_blocks
  or q.requested_end_at-q.requested_start_at<>item.end_at-item.start_at
  or item.total_centavos<>q.original_centavos or item.online_confirmation_at is distinct from q.confirmation_at
  or (q.guest_auth_user_id is not null and (item.owner_auth_user_id is distinct from q.guest_auth_user_id or lower(item.verified_email) is distinct from lower(q.guest_email)))
  or exists(select 1 from staytrack.room_check_ins where room_booking_id=item.id)
  or exists(select 1 from staytrack.refund_claims where room_booking_id=item.id)
  or (select coalesce(sum(v.amount_centavos),0) from staytrack.verified_online_payments v join staytrack.payment_submissions p on p.id=v.submission_id where p.reservation_id=item.reservation_id and p.status='confirmed')<item.reservation_total
 then raise exception 'Schedule, ownership or policy prevents approval'; end if;
 if exists(select 1 from staytrack.cancellation_requests c left join staytrack.cancellation_decisions d using(room_booking_id)
   where c.room_booking_id=item.id and ((c.eligibility='eligible' and d.room_booking_id is null) or d.approved))
 then raise exception 'Cancellation prevents rescheduling'; end if;
 lock table staytrack.room_blocks in share mode;
 perform 1 from staytrack.rooms rm join staytrack.room_categories c on c.id=rm.category_id
  where rm.id=new.new_room_id and rm.category_id=category and rm.active and c.active for update of rm;
 if not found then raise exception 'Destination room unavailable'; end if;
 if exists(select 1 from staytrack.inventory_claims i where i.room_id=new.new_room_id and i.id<>item.claim_id
   and i.state not in ('released','expired') and tstzrange(i.start_at,i.buffered_end_at,'[)') &&
    tstzrange(q.requested_start_at,q.requested_end_at+item.buffer_minutes*interval '1 minute','[)'))
  or exists(select 1 from staytrack.room_blocks b where b.room_id=new.new_room_id and
   tstzrange(b.start_at,b.end_at,'[)') && tstzrange(q.requested_start_at,q.requested_end_at+item.buffer_minutes*interval '1 minute','[)'))
 then raise exception 'Destination capacity unavailable'; end if;
 new.new_start_at=q.requested_start_at; new.new_end_at=q.requested_end_at; new.new_revision=item.schedule_revision+1;
 return new;
end $$;

create function staytrack.apply_reschedule_decision() returns trigger language plpgsql set search_path='' as $$
begin
 if new.approved then
  update staytrack.room_bookings set start_at=new.new_start_at,end_at=new.new_end_at,
   schedule_revision=new.new_revision,pending_reschedule_id=null where id=new.room_booking_id;
  update staytrack.inventory_claims set room_id=new.new_room_id,start_at=new.new_start_at,end_at=new.new_end_at,
   buffered_end_at=new.new_end_at+buffer_minutes*interval '1 minute'
   where id=(select claim_id from staytrack.room_bookings where id=new.room_booking_id);
 else
  update staytrack.room_bookings set pending_reschedule_id=null where id=new.room_booking_id;
 end if;
 insert into staytrack.staff_audit(actor_auth_user_id,action) values(new.actor_auth_user_id,
  case when new.approved then 'room.reschedule_approved' else 'room.reschedule_rejected' end);
 return new;
end $$;

create function staytrack.guard_reschedule_projection() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.id,new.reservation_id,new.claim_id) is distinct from (old.id,old.reservation_id,old.claim_id)
 then raise exception 'Room item identity and claim binding are immutable'; end if;
 if (new.start_at,new.end_at,new.schedule_revision) is distinct from (old.start_at,old.end_at,old.schedule_revision) then
  if not exists(select 1 from staytrack.reschedule_decisions d where d.room_booking_id=old.id and d.approved
    and d.request_id=old.pending_reschedule_id and d.old_revision=old.schedule_revision and d.new_revision=new.schedule_revision
    and d.old_start_at=old.start_at and d.old_end_at=old.end_at and d.new_start_at=new.start_at and d.new_end_at=new.end_at)
    or new.pending_reschedule_id is not null then raise exception 'Approved schedule event required'; end if;
 end if;
 if new.pending_reschedule_id is distinct from old.pending_reschedule_id then
  if new.pending_reschedule_id is null then
   if not exists(select 1 from staytrack.reschedule_decisions where request_id=old.pending_reschedule_id) then raise exception 'Terminal decision required'; end if;
  elsif old.pending_reschedule_id is not null or not exists(select 1 from staytrack.reschedule_requests q
    where q.id=new.pending_reschedule_id and q.room_booking_id=old.id and q.expected_revision=old.schedule_revision
      and not exists(select 1 from staytrack.reschedule_decisions where request_id=q.id))
   then raise exception 'Current immutable request required'; end if;
 end if;
 return new;
end $$;

-- Deferred validation permits W02's claim update followed by its check-in insert in the same transaction.
create function staytrack.guard_reschedule_claim_projection() returns trigger language plpgsql set search_path='' as $$
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
 raise exception 'Approved schedule event or recorded check-in required';
end $$;

create trigger reschedule_request_guard before insert on staytrack.reschedule_requests for each row execute function staytrack.guard_reschedule_request();
create trigger reschedule_request_apply after insert on staytrack.reschedule_requests for each row execute function staytrack.apply_reschedule_request();
create trigger reschedule_proposal_guard before insert on staytrack.reschedule_adjustment_proposals for each row execute function staytrack.guard_reschedule_proposal();
create trigger reschedule_decision_guard before insert on staytrack.reschedule_decisions for each row execute function staytrack.guard_reschedule_decision();
create trigger reschedule_decision_apply after insert on staytrack.reschedule_decisions for each row execute function staytrack.apply_reschedule_decision();
create trigger reschedule_projection_guard before update on staytrack.room_bookings for each row execute function staytrack.guard_reschedule_projection();
create constraint trigger reschedule_claim_projection_guard after update on staytrack.inventory_claims deferrable initially deferred for each row execute function staytrack.guard_reschedule_claim_projection();
do $$ declare f text; begin
 foreach f in array array['guard_reschedule_request','apply_reschedule_request','guard_reschedule_proposal','guard_reschedule_decision','apply_reschedule_decision','guard_reschedule_projection','guard_reschedule_claim_projection'] loop
  execute format('revoke all on function staytrack.%I() from public,anon,authenticated',f);
 end loop;
end $$;
