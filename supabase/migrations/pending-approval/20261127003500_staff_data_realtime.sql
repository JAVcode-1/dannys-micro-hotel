-- Candidate for isolated verification and owner approval before hosted use.
-- Broadcast carries an invalidation domain only. API authorization still gates every read.
create function staytrack.can_receive_staff_data() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from staytrack.staff_accounts
    where auth_user_id = (select auth.uid()) and active
  );
$$;
revoke all on function staytrack.can_receive_staff_data() from public, anon;
grant execute on function staytrack.can_receive_staff_data() to authenticated;

create policy staytrack_staff_data_read on realtime.messages
  for select to authenticated
  using (
    (select realtime.topic()) = 'staytrack:staff'
    and extension = 'broadcast'
    and (select staytrack.can_receive_staff_data())
  );

-- Keep the reserved topic private even if another app installs a broad policy.
create policy staytrack_staff_data_read_guard on realtime.messages as restrictive
  for select to anon, authenticated
  using (
    (select realtime.topic()) is distinct from 'staytrack:staff'
    or (
      extension = 'broadcast'
      and case when current_user = 'authenticated'
        then (select staytrack.can_receive_staff_data()) else false end
    )
  );

create policy staytrack_staff_data_write_guard on realtime.messages as restrictive
  for insert to anon, authenticated
  with check (
    (select realtime.topic()) is distinct from 'staytrack:staff'
    and topic is distinct from 'staytrack:staff'
  );

create function staytrack.broadcast_staff_data_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from changed) then
    perform realtime.send(
      pg_catalog.jsonb_build_object('domain', tg_argv[0]),
      'invalidate', 'staytrack:staff', true
    );
  end if;
  return null;
end;
$$;
revoke all on function staytrack.broadcast_staff_data_change() from public, anon, authenticated;

do $$
declare
  entry record;
  operation text;
  transition_name text;
begin
  for entry in select * from (values
    ('room_categories', 'catalog'), ('packages', 'catalog'),
    ('operational_settings', 'settings'),
    ('rooms', 'room'), ('room_blocks', 'room'), ('housekeeping_events', 'room'),
    ('maintenance_events', 'room'), ('room_inspections', 'room'),
    ('room_reassignments', 'room'), ('room_administration_events', 'room'),
    ('reservations', 'reservation'), ('room_bookings', 'reservation'),
    ('inventory_claims', 'reservation'), ('claim_requests', 'reservation'),
    ('cancellation_requests', 'reservation'), ('cancellation_decisions', 'reservation'),
    ('reschedule_requests', 'reservation'), ('reschedule_decisions', 'reservation'),
    ('reschedule_adjustment_proposals', 'reservation'),
    ('payment_qr', 'payment'), ('payment_submissions', 'payment'),
    ('payment_reviews', 'payment'), ('verified_online_payments', 'payment'),
    ('walkin_ledger', 'payment'), ('refund_claims', 'payment'),
    ('refund_transfers', 'payment'), ('refund_issues', 'payment'),
    ('room_check_ins', 'stay'), ('room_checkouts', 'stay'), ('accommodation_no_show_reviews', 'stay'),
    ('stay_extension_requests', 'stay'), ('stay_extension_decisions', 'stay'),
    ('stay_charge_entries', 'stay'), ('stay_charge_reviews', 'stay'), ('stay_charge_policy_versions', 'stay'),
    ('stay_receipts', 'stay'), ('stay_receipt_allocations', 'stay'),
    ('hall_resource', 'hall'), ('hall_settings', 'hall'), ('hall_claims', 'hall'),
    ('hall_reservations', 'hall'), ('hall_receipts', 'hall'), ('hall_actions', 'hall'),
    ('hall_refund_approvals', 'hall'), ('hall_refund_transfers', 'hall'),
    ('hall_overtime_charges', 'hall'), ('online_hall_items', 'hall'), ('online_hall_requests', 'hall'),
    ('guest_reviews', 'review'), ('private_feedback', 'review'), ('review_replies', 'review'),
    ('notification_outbox', 'notification')
  ) as sources(table_name, domain)
  loop
    foreach operation in array array['insert', 'update', 'delete'] loop
      transition_name := case when operation = 'delete' then 'old' else 'new' end;
      execute pg_catalog.format(
        'create trigger %I after %s on staytrack.%I referencing %s table as changed for each statement execute function staytrack.broadcast_staff_data_change(%L)',
        'staff_data_' || operation, operation, entry.table_name, transition_name, entry.domain
      );
    end loop;
  end loop;
end;
$$;
