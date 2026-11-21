-- Candidate for isolated verification only; no hosted application authorized.
-- Email is contact data, never a verified identity or review grant.
create table staytrack.walkin_guest_contacts (
 reservation_id uuid primary key references staytrack.reservations(id),
 phone text not null check(length(phone) between 7 and 30 and phone ~ '^[+()0-9 -]+$'),
 email text check(length(email) between 3 and 254),
 policy_version text not null,
 policy_text text not null,
 acknowledged_by uuid not null,
 acknowledged_at timestamptz not null default clock_timestamp(),
 minor_id_status text not null check(minor_id_status in ('not_checked','checked','no_minors')),
 minor_id_checked_by uuid,
 minor_id_checked_at timestamptz,
 check((minor_id_status='checked' and minor_id_checked_by is not null and minor_id_checked_at is not null) or (minor_id_status<>'checked' and minor_id_checked_by is null and minor_id_checked_at is null))
);
alter table staytrack.walkin_guest_contacts enable row level security;
revoke all on staytrack.walkin_guest_contacts from public,anon,authenticated;
create trigger walkin_contact_immutable before update or delete on staytrack.walkin_guest_contacts for each row execute function staytrack.protect_payment_review_history();
create function staytrack.guard_walkin_contact() returns trigger language plpgsql set search_path='' as $$ begin
 perform 1 from staytrack.staff_accounts where auth_user_id=new.acknowledged_by and active for share;
 if not found then raise exception 'Active staff required'; end if;
 perform 1 from staytrack.reservations where id=new.reservation_id and channel='walk_in' and created_by=new.acknowledged_by for update;
 if not found then raise exception 'Creating staff and walk-in reservation required'; end if;
 if exists(select 1 from staytrack.room_bookings where reservation_id=new.reservation_id and child_count>0) = (new.minor_id_status='no_minors') then raise exception 'Minor verification status must match child occupants'; end if;
 new.acknowledged_at=clock_timestamp();
 if new.minor_id_status='checked' then new.minor_id_checked_by=new.acknowledged_by;new.minor_id_checked_at=clock_timestamp();end if;
 insert into staytrack.staff_audit(actor_auth_user_id,action) values(new.acknowledged_by,'walkin.contact_policy_recorded');
 return new;
end $$;
revoke all on function staytrack.guard_walkin_contact() from public,anon,authenticated;
create trigger walkin_contact_guard before insert on staytrack.walkin_guest_contacts for each row execute function staytrack.guard_walkin_contact();
