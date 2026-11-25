// Generated from the fully migrated disposable PostgreSQL schema. Regenerate with scripts/generate-isolated-types.mjs through the isolated suite.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
  staytrack: {
    Tables: {
      accommodation_no_show_reviews: {
        Row: {
          id: number;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          decision: string;
          note: string;
          occurred_at: string;
        };
        Insert: {
          id?: never;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          decision: string;
          note: string;
          occurred_at?: string;
        };
        Update: {
          id?: never;
          room_booking_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          decision?: string;
          note?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accommodation_no_show_reviews_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      cancellation_decisions: {
        Row: {
          room_booking_id: string;
          approved: boolean;
          refund_centavos: number;
          actor_auth_user_id: string;
          request_key: string;
          reason: string;
          decided_at: string;
        };
        Insert: {
          room_booking_id: string;
          approved: boolean;
          refund_centavos: number;
          actor_auth_user_id: string;
          request_key: string;
          reason: string;
          decided_at?: string;
        };
        Update: {
          room_booking_id?: string;
          approved?: boolean;
          refund_centavos?: number;
          actor_auth_user_id?: string;
          request_key?: string;
          reason?: string;
          decided_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cancellation_decisions_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: true;
            referencedRelation: "cancellation_requests";
            referencedColumns: "{room_booking_id}";
          },
        ];
      };
      cancellation_requests: {
        Row: {
          room_booking_id: string;
          guest_auth_user_id: string | null;
          guest_email: string | null;
          staff_auth_user_id: string | null;
          request_key: string;
          reason: string;
          requested_at: string;
          confirmation_at: string | null;
          eligibility: string;
        };
        Insert: {
          room_booking_id: string;
          guest_auth_user_id?: string | null;
          guest_email?: string | null;
          staff_auth_user_id?: string | null;
          request_key: string;
          reason: string;
          requested_at: string;
          confirmation_at?: string | null;
          eligibility: string;
        };
        Update: {
          room_booking_id?: string;
          guest_auth_user_id?: string | null;
          guest_email?: string | null;
          staff_auth_user_id?: string | null;
          request_key?: string;
          reason?: string;
          requested_at?: string;
          confirmation_at?: string | null;
          eligibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: true;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      claim_requests: {
        Row: {
          idempotency_key: string;
          request_hash: string;
          created_at: string;
        };
        Insert: {
          idempotency_key: string;
          request_hash: string;
          created_at?: string;
        };
        Update: {
          idempotency_key?: string;
          request_hash?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      early_check_in_approvals: {
        Row: {
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          reason: string;
          original_start_at: string;
          original_end_at: string;
          start_at: string;
          end_at: string;
          occurred_at: string;
        };
        Insert: {
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          reason: string;
          original_start_at: string;
          original_end_at: string;
          start_at: string;
          end_at: string;
          occurred_at?: string;
        };
        Update: {
          room_booking_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          reason?: string;
          original_start_at?: string;
          original_end_at?: string;
          start_at?: string;
          end_at?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "early_check_in_approvals_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: true;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      gcash_reference_registry: {
        Row: {
          normalized_reference: string;
          online_submission_id: string | null;
          walkin_entry_id: string | null;
          stay_receipt_id: string | null;
          hall_receipt_id: string | null;
        };
        Insert: {
          normalized_reference: string;
          online_submission_id?: string | null;
          walkin_entry_id?: string | null;
          stay_receipt_id?: string | null;
          hall_receipt_id?: string | null;
        };
        Update: {
          normalized_reference?: string;
          online_submission_id?: string | null;
          walkin_entry_id?: string | null;
          stay_receipt_id?: string | null;
          hall_receipt_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gcash_reference_registry_hall_receipt_id_fkey";
            columns: "{hall_receipt_id}";
            isOneToOne: true;
            referencedRelation: "hall_receipts";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "gcash_reference_registry_online_submission_id_fkey";
            columns: "{online_submission_id}";
            isOneToOne: true;
            referencedRelation: "verified_online_payments";
            referencedColumns: "{submission_id}";
          },
          {
            foreignKeyName: "gcash_reference_registry_stay_receipt_id_fkey";
            columns: "{stay_receipt_id}";
            isOneToOne: true;
            referencedRelation: "stay_receipts";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "gcash_reference_registry_walkin_entry_id_fkey";
            columns: "{walkin_entry_id}";
            isOneToOne: true;
            referencedRelation: "walkin_ledger";
            referencedColumns: "{id}";
          },
        ];
      };
      guest_reviews: {
        Row: {
          id: string;
          reservation_id: string;
          stars: number;
          comment: string | null;
          alias: string;
          status: string;
          request_key: string;
          request_hash: string;
          submitted_at: string;
          consent_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          stars: number;
          comment?: string | null;
          alias: string;
          status?: string;
          request_key: string;
          request_hash: string;
          submitted_at?: string;
          consent_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          stars?: number;
          comment?: string | null;
          alias?: string;
          status?: string;
          request_key?: string;
          request_hash?: string;
          submitted_at?: string;
          consent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guest_reviews_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: true;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      hall_actions: {
        Row: {
          actor: string;
          request_key: string;
          payload_hash: string;
          action: string;
          reservation_id: string | null;
          result: Json;
          recorded_at: string;
        };
        Insert: {
          actor: string;
          request_key: string;
          payload_hash: string;
          action: string;
          reservation_id?: string | null;
          result: Json;
          recorded_at?: string;
        };
        Update: {
          actor?: string;
          request_key?: string;
          payload_hash?: string;
          action?: string;
          reservation_id?: string | null;
          result?: Json;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hall_actions_actor_fkey";
            columns: "{actor}";
            isOneToOne: false;
            referencedRelation: "staff_accounts";
            referencedColumns: "{auth_user_id}";
          },
          {
            foreignKeyName: "hall_actions_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "hall_reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      hall_claims: {
        Row: {
          id: string;
          resource_id: number;
          purpose: string;
          setup: string | null;
          attendees: number | null;
          event_start: string;
          event_end: string;
          preparation_start: string;
          cleanup_end: string;
          released_at: string | null;
        };
        Insert: {
          id?: string;
          resource_id?: number;
          purpose?: string;
          setup?: string | null;
          attendees?: number | null;
          event_start: string;
          event_end: string;
          preparation_start: string;
          cleanup_end: string;
          released_at?: string | null;
        };
        Update: {
          id?: string;
          resource_id?: number;
          purpose?: string;
          setup?: string | null;
          attendees?: number | null;
          event_start?: string;
          event_end?: string;
          preparation_start?: string;
          cleanup_end?: string;
          released_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "hall_claims_resource_id_fkey";
            columns: "{resource_id}";
            isOneToOne: false;
            referencedRelation: "hall_resource";
            referencedColumns: "{id}";
          },
        ];
      };
      hall_overtime_charges: {
        Row: {
          reservation_id: string;
          amount_centavos: number;
          reason: string;
        };
        Insert: {
          reservation_id: string;
          amount_centavos: number;
          reason: string;
        };
        Update: {
          reservation_id?: string;
          amount_centavos?: number;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hall_overtime_charges_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: true;
            referencedRelation: "hall_reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      hall_receipts: {
        Row: {
          id: string;
          reservation_id: string;
          actor: string;
          method: string;
          amount_centavos: number;
          normalized_reference: string | null;
          evidence: string;
          received_at: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          actor: string;
          method: string;
          amount_centavos: number;
          normalized_reference?: string | null;
          evidence: string;
          received_at: string;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          actor?: string;
          method?: string;
          amount_centavos?: number;
          normalized_reference?: string | null;
          evidence?: string;
          received_at?: string;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hall_receipts_actor_fkey";
            columns: "{actor}";
            isOneToOne: false;
            referencedRelation: "staff_accounts";
            referencedColumns: "{auth_user_id}";
          },
          {
            foreignKeyName: "hall_receipts_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "hall_reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      hall_refund_approvals: {
        Row: {
          id: string;
          reservation_id: string;
          amount_centavos: number;
          reason: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          amount_centavos: number;
          reason: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          amount_centavos?: number;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hall_refund_approvals_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "hall_reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      hall_refund_transfers: {
        Row: {
          approval_id: string;
          method: string;
          reference: string | null;
          transferred_at: string;
          evidence: string;
          id: string;
          amount_centavos: number;
        };
        Insert: {
          approval_id: string;
          method: string;
          reference?: string | null;
          transferred_at: string;
          evidence: string;
          id?: string;
          amount_centavos: number;
        };
        Update: {
          approval_id?: string;
          method?: string;
          reference?: string | null;
          transferred_at?: string;
          evidence?: string;
          id?: string;
          amount_centavos?: number;
        };
        Relationships: [
          {
            foreignKeyName: "hall_refund_transfers_approval_id_fkey";
            columns: "{approval_id}";
            isOneToOne: false;
            referencedRelation: "hall_refund_approvals";
            referencedColumns: "{id}";
          },
        ];
      };
      hall_reservations: {
        Row: {
          id: string;
          channel: string;
          organizer: string;
          requests: string | null;
          quote_input: Json;
          status: string;
          claim_id: string | null;
          payment_resolution: boolean;
          created_at: string;
          actual_start: string | null;
          actual_end: string | null;
        };
        Insert: {
          id?: string;
          channel: string;
          organizer: string;
          requests?: string | null;
          quote_input: Json;
          status?: string;
          claim_id?: string | null;
          payment_resolution?: boolean;
          created_at?: string;
          actual_start?: string | null;
          actual_end?: string | null;
        };
        Update: {
          id?: string;
          channel?: string;
          organizer?: string;
          requests?: string | null;
          quote_input?: Json;
          status?: string;
          claim_id?: string | null;
          payment_resolution?: boolean;
          created_at?: string;
          actual_start?: string | null;
          actual_end?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "hall_reservations_claim_id_fkey";
            columns: "{claim_id}";
            isOneToOne: true;
            referencedRelation: "hall_claims";
            referencedColumns: "{id}";
          },
        ];
      };
      hall_resource: {
        Row: { id: number; ready: boolean };
        Insert: { id: number; ready?: boolean };
        Update: { id?: number; ready?: boolean };
        Relationships: [];
      };
      hall_revisions: {
        Row: {
          id: number;
          reservation_id: string;
          claim_id: string;
          total_centavos: number;
          quote: Json;
          recorded_at: string;
        };
        Insert: {
          id?: never;
          reservation_id: string;
          claim_id: string;
          total_centavos: number;
          quote: Json;
          recorded_at?: string;
        };
        Update: {
          id?: never;
          reservation_id?: string;
          claim_id?: string;
          total_centavos?: number;
          quote?: Json;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hall_revisions_claim_id_fkey";
            columns: "{claim_id}";
            isOneToOne: false;
            referencedRelation: "hall_claims";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "hall_revisions_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "hall_reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      hall_settings: {
        Row: {
          id: number;
          actor: string | null;
          recorded_at: string;
          opening: number;
          closing: number;
          notice: number;
          horizon: number;
          preparation: number;
          cleanup: number;
          no_show_grace: number;
          reminder: number;
        };
        Insert: {
          id?: never;
          actor?: string | null;
          recorded_at?: string;
          opening: number;
          closing: number;
          notice: number;
          horizon: number;
          preparation: number;
          cleanup: number;
          no_show_grace: number;
          reminder: number;
        };
        Update: {
          id?: never;
          actor?: string | null;
          recorded_at?: string;
          opening?: number;
          closing?: number;
          notice?: number;
          horizon?: number;
          preparation?: number;
          cleanup?: number;
          no_show_grace?: number;
          reminder?: number;
        };
        Relationships: [
          {
            foreignKeyName: "hall_settings_actor_fkey";
            columns: "{actor}";
            isOneToOne: false;
            referencedRelation: "staff_accounts";
            referencedColumns: "{auth_user_id}";
          },
        ];
      };
      housekeeping_events: {
        Row: {
          id: number;
          checkout_id: string;
          room_id: number;
          action: string;
          actor_auth_user_id: string;
          request_key: string;
          checks_confirmed: boolean;
          occurred_at: string;
        };
        Insert: {
          id?: never;
          checkout_id: string;
          room_id: number;
          action: string;
          actor_auth_user_id: string;
          request_key: string;
          checks_confirmed?: boolean;
          occurred_at?: string;
        };
        Update: {
          id?: never;
          checkout_id?: string;
          room_id?: number;
          action?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          checks_confirmed?: boolean;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "housekeeping_events_checkout_id_fkey";
            columns: "{checkout_id}";
            isOneToOne: false;
            referencedRelation: "room_checkouts";
            referencedColumns: "{room_booking_id}";
          },
          {
            foreignKeyName: "housekeeping_events_room_id_fkey";
            columns: "{room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
        ];
      };
      inventory_claims: {
        Row: {
          id: number;
          idempotency_key: string;
          item_index: number;
          category_id: number;
          room_id: number;
          start_at: string;
          end_at: string;
          buffer_minutes: number;
          buffered_end_at: string;
          state: string;
          created_at: string;
          proof_deadline_at: string;
          proof_submitted_at: string | null;
        };
        Insert: {
          id?: never;
          idempotency_key: string;
          item_index: number;
          category_id: number;
          room_id: number;
          start_at: string;
          end_at: string;
          buffer_minutes: number;
          buffered_end_at: string;
          state: string;
          created_at?: string;
          proof_deadline_at: string;
          proof_submitted_at?: string | null;
        };
        Update: {
          id?: never;
          idempotency_key?: string;
          item_index?: number;
          category_id?: number;
          room_id?: number;
          start_at?: string;
          end_at?: string;
          buffer_minutes?: number;
          buffered_end_at?: string;
          state?: string;
          created_at?: string;
          proof_deadline_at?: string;
          proof_submitted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_claims_category_id_fkey";
            columns: "{category_id}";
            isOneToOne: false;
            referencedRelation: "room_categories";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "inventory_claims_idempotency_key_fkey";
            columns: "{idempotency_key}";
            isOneToOne: false;
            referencedRelation: "claim_requests";
            referencedColumns: "{idempotency_key}";
          },
          {
            foreignKeyName: "inventory_claims_room_id_category_id_fkey";
            columns: "{room_id,category_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id,category_id}";
          },
        ];
      };
      maintenance_events: {
        Row: {
          id: number;
          block_id: number;
          action: string;
          note: string;
          restore_ready: boolean;
          prior_state: string | null;
          actor_auth_user_id: string;
          request_key: string;
          occurred_at: string;
        };
        Insert: {
          id?: never;
          block_id: number;
          action: string;
          note: string;
          restore_ready: boolean;
          prior_state?: string | null;
          actor_auth_user_id: string;
          request_key: string;
          occurred_at: string;
        };
        Update: {
          id?: never;
          block_id?: number;
          action?: string;
          note?: string;
          restore_ready?: boolean;
          prior_state?: string | null;
          actor_auth_user_id?: string;
          request_key?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_events_block_id_fkey";
            columns: "{block_id}";
            isOneToOne: false;
            referencedRelation: "room_blocks";
            referencedColumns: "{id}";
          },
        ];
      };
      notification_outbox: {
        Row: {
          id: string;
          dedupe_key: string;
          recipient: string;
          kind: string;
          reservation_id: string | null;
          payload: Json;
          created_at: string;
          due_at: string;
          attempts: number;
          lease_token: string | null;
          lease_until: string | null;
          state: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          dedupe_key: string;
          recipient: string;
          kind: string;
          reservation_id?: string | null;
          payload?: Json;
          created_at?: string;
          due_at?: string;
          attempts?: number;
          lease_token?: string | null;
          lease_until?: string | null;
          state?: string;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          dedupe_key?: string;
          recipient?: string;
          kind?: string;
          reservation_id?: string | null;
          payload?: Json;
          created_at?: string;
          due_at?: string;
          attempts?: number;
          lease_token?: string | null;
          lease_until?: string | null;
          state?: string;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_outbox_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      online_hall_items: {
        Row: {
          reservation_id: string;
          hall_reservation_id: string;
          original_centavos: number;
          proof_deadline_at: string;
          state: string;
          proof_submitted_at: string | null;
        };
        Insert: {
          reservation_id: string;
          hall_reservation_id: string;
          original_centavos: number;
          proof_deadline_at: string;
          state?: string;
          proof_submitted_at?: string | null;
        };
        Update: {
          reservation_id?: string;
          hall_reservation_id?: string;
          original_centavos?: number;
          proof_deadline_at?: string;
          state?: string;
          proof_submitted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "online_hall_items_hall_reservation_id_fkey";
            columns: "{hall_reservation_id}";
            isOneToOne: true;
            referencedRelation: "hall_reservations";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "online_hall_items_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: true;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      online_hall_requests: {
        Row: {
          id: string;
          hall_reservation_id: string;
          actor: string;
          request_key: string;
          request_hash: string;
          kind: string;
          reason: string;
          input: Json;
          result: Json;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          hall_reservation_id: string;
          actor: string;
          request_key: string;
          request_hash: string;
          kind: string;
          reason: string;
          input: Json;
          result: Json;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          hall_reservation_id?: string;
          actor?: string;
          request_key?: string;
          request_hash?: string;
          kind?: string;
          reason?: string;
          input?: Json;
          result?: Json;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "online_hall_requests_hall_reservation_id_fkey";
            columns: "{hall_reservation_id}";
            isOneToOne: false;
            referencedRelation: "hall_reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      operational_settings: {
        Row: {
          id: boolean;
          cleaning_buffer_minutes: number | null;
          checkout_alert_minutes: number | null;
          gcash_qr_object_key: string | null;
          gcash_payee_label: string | null;
          cancellation_display_text: string | null;
          updated_at: string;
          updated_by: string | null;
          checkout_warning_minutes: number[] | null;
        };
        Insert: {
          id?: boolean;
          cleaning_buffer_minutes?: number | null;
          checkout_alert_minutes?: number | null;
          gcash_qr_object_key?: string | null;
          gcash_payee_label?: string | null;
          cancellation_display_text?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          checkout_warning_minutes?: number[] | null;
        };
        Update: {
          id?: boolean;
          cleaning_buffer_minutes?: number | null;
          checkout_alert_minutes?: number | null;
          gcash_qr_object_key?: string | null;
          gcash_payee_label?: string | null;
          cancellation_display_text?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          checkout_warning_minutes?: number[] | null;
        };
        Relationships: [];
      };
      packages: {
        Row: {
          id: number;
          category_id: number;
          category_code: string;
          duration_minutes: number;
          price_centavos: number;
          version: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: never;
          category_id: number;
          category_code: string;
          duration_minutes: number;
          price_centavos: number;
          version?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: never;
          category_id?: number;
          category_code?: string;
          duration_minutes?: number;
          price_centavos?: number;
          version?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "packages_category_id_category_code_fkey";
            columns: "{category_id,category_code}";
            isOneToOne: false;
            referencedRelation: "room_categories";
            referencedColumns: "{id,code}";
          },
          {
            foreignKeyName: "packages_category_id_fkey";
            columns: "{category_id}";
            isOneToOne: false;
            referencedRelation: "room_categories";
            referencedColumns: "{id}";
          },
        ];
      };
      payment_notification_outbox: {
        Row: {
          id: string;
          review_id: string;
          reservation_id: string;
          recipient_email: string;
          payload: Json;
          state: string;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          review_id: string;
          reservation_id: string;
          recipient_email: string;
          payload: Json;
          state?: string;
          created_at?: string;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          review_id?: string;
          reservation_id?: string;
          recipient_email?: string;
          payload?: Json;
          state?: string;
          created_at?: string;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_notification_outbox_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "payment_notification_outbox_review_id_fkey";
            columns: "{review_id}";
            isOneToOne: true;
            referencedRelation: "payment_reviews";
            referencedColumns: "{id}";
          },
        ];
      };
      payment_qr: {
        Row: {
          id: boolean;
          object_key: string;
          payee_label: string;
          updated_by: string;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          object_key: string;
          payee_label: string;
          updated_by: string;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          object_key?: string;
          payee_label?: string;
          updated_by?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_reminders: {
        Row: {
          reservation_id: string;
          minute_offset: number;
          due_at: string;
          state: string;
        };
        Insert: {
          reservation_id: string;
          minute_offset: number;
          due_at: string;
          state?: string;
        };
        Update: {
          reservation_id?: string;
          minute_offset?: number;
          due_at?: string;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_reminders_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      payment_reviews: {
        Row: {
          id: string;
          submission_id: string;
          version: number;
          request_key: string;
          request_hash: string;
          decision: string;
          note: string;
          actor_auth_user_id: string;
          evidence: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          version: number;
          request_key: string;
          request_hash: string;
          decision: string;
          note: string;
          actor_auth_user_id: string;
          evidence: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          version?: number;
          request_key?: string;
          request_hash?: string;
          decision?: string;
          note?: string;
          actor_auth_user_id?: string;
          evidence?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_reviews_submission_id_fkey";
            columns: "{submission_id}";
            isOneToOne: false;
            referencedRelation: "payment_submissions";
            referencedColumns: "{id}";
          },
        ];
      };
      payment_submissions: {
        Row: {
          id: string;
          reservation_id: string;
          submitted_by: string;
          transaction_reference: string;
          object_key: string;
          content_type: string;
          byte_length: number;
          request_hash: string;
          amount_due_centavos: number;
          status: string;
          submitted_at: string;
          review_version: number;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          submitted_by: string;
          transaction_reference: string;
          object_key: string;
          content_type: string;
          byte_length: number;
          request_hash: string;
          amount_due_centavos: number;
          status?: string;
          submitted_at: string;
          review_version?: number;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          submitted_by?: string;
          transaction_reference?: string;
          object_key?: string;
          content_type?: string;
          byte_length?: number;
          request_hash?: string;
          amount_due_centavos?: number;
          status?: string;
          submitted_at?: string;
          review_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payment_submissions_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: true;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      private_feedback: {
        Row: {
          id: string;
          reservation_id: string;
          message: string;
          follow_up_email: string | null;
          status: string;
          request_key: string;
          request_hash: string;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          message: string;
          follow_up_email?: string | null;
          status?: string;
          request_key: string;
          request_hash: string;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          message?: string;
          follow_up_email?: string | null;
          status?: string;
          request_key?: string;
          request_hash?: string;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "private_feedback_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      refund_claims: {
        Row: {
          room_booking_id: string;
          original_payment_id: string;
          actor_auth_user_id: string;
          request_key: string;
          payer_name: string;
          payer_account: string;
          verification_note: string;
          ledger_checked: boolean;
          original_payer_matched: boolean;
          claimed_at: string;
        };
        Insert: {
          room_booking_id: string;
          original_payment_id: string;
          actor_auth_user_id: string;
          request_key: string;
          payer_name: string;
          payer_account: string;
          verification_note: string;
          ledger_checked: boolean;
          original_payer_matched: boolean;
          claimed_at?: string;
        };
        Update: {
          room_booking_id?: string;
          original_payment_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          payer_name?: string;
          payer_account?: string;
          verification_note?: string;
          ledger_checked?: boolean;
          original_payer_matched?: boolean;
          claimed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refund_claims_original_payment_id_fkey";
            columns: "{original_payment_id}";
            isOneToOne: false;
            referencedRelation: "verified_online_payments";
            referencedColumns: "{submission_id}";
          },
          {
            foreignKeyName: "refund_claims_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: true;
            referencedRelation: "cancellation_decisions";
            referencedColumns: "{room_booking_id}";
          },
        ];
      };
      refund_issues: {
        Row: {
          kind: string;
          item_id: string;
          room_item_id: string | null;
          hall_item_id: string | null;
          received_centavos: number;
          details: string;
          reported_by: string;
          reported_at: string;
          resolution: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
        };
        Insert: {
          kind: string;
          item_id: string;
          room_item_id?: never;
          hall_item_id?: never;
          received_centavos: number;
          details: string;
          reported_by: string;
          reported_at?: string;
          resolution?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
        Update: {
          kind?: string;
          item_id?: string;
          room_item_id?: never;
          hall_item_id?: never;
          received_centavos?: number;
          details?: string;
          reported_by?: string;
          reported_at?: string;
          resolution?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "refund_issues_hall_item_id_fkey";
            columns: "{hall_item_id}";
            isOneToOne: false;
            referencedRelation: "hall_reservations";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "refund_issues_room_item_id_fkey";
            columns: "{room_item_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      refund_transfers: {
        Row: {
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          amount_centavos: number;
          currency: string;
          normalized_reference: string;
          transferred_at: string;
          recorded_at: string;
          transfer_checked: boolean;
          id: string;
        };
        Insert: {
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          amount_centavos: number;
          currency?: string;
          normalized_reference: string;
          transferred_at: string;
          recorded_at?: string;
          transfer_checked: boolean;
          id?: string;
        };
        Update: {
          room_booking_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          amount_centavos?: number;
          currency?: string;
          normalized_reference?: string;
          transferred_at?: string;
          recorded_at?: string;
          transfer_checked?: boolean;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refund_transfers_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "refund_claims";
            referencedColumns: "{room_booking_id}";
          },
        ];
      };
      request_limits: {
        Row: { key_digest: string; window_start: string; count: number };
        Insert: { key_digest: string; window_start: string; count: number };
        Update: { key_digest?: string; window_start?: string; count?: number };
        Relationships: [];
      };
      reschedule_adjustment_proposals: {
        Row: {
          request_id: string;
          room_booking_id: string;
          original_centavos: number;
          comparison_centavos: number;
          delta_centavos: number;
          currency: string;
          status: string;
          package_snapshot: Json;
        };
        Insert: {
          request_id: string;
          room_booking_id: string;
          original_centavos: number;
          comparison_centavos: number;
          delta_centavos: number;
          currency?: string;
          status?: string;
          package_snapshot: Json;
        };
        Update: {
          request_id?: string;
          room_booking_id?: string;
          original_centavos?: number;
          comparison_centavos?: number;
          delta_centavos?: number;
          currency?: string;
          status?: string;
          package_snapshot?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "reschedule_adjustment_proposals_request_id_fkey";
            columns: "{request_id}";
            isOneToOne: true;
            referencedRelation: "reschedule_requests";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "reschedule_adjustment_proposals_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      reschedule_decisions: {
        Row: {
          request_id: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          expected_revision: number;
          approved: boolean;
          reason: string;
          old_start_at: string;
          old_end_at: string;
          new_start_at: string;
          new_end_at: string;
          old_room_id: number;
          new_room_id: number;
          old_revision: number;
          new_revision: number;
          decided_at: string;
        };
        Insert: {
          request_id: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          expected_revision: number;
          approved: boolean;
          reason: string;
          old_start_at: string;
          old_end_at: string;
          new_start_at: string;
          new_end_at: string;
          old_room_id: number;
          new_room_id: number;
          old_revision: number;
          new_revision: number;
          decided_at?: string;
        };
        Update: {
          request_id?: string;
          room_booking_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          request_hash?: string;
          expected_revision?: number;
          approved?: boolean;
          reason?: string;
          old_start_at?: string;
          old_end_at?: string;
          new_start_at?: string;
          new_end_at?: string;
          old_room_id?: number;
          new_room_id?: number;
          old_revision?: number;
          new_revision?: number;
          decided_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reschedule_decisions_new_room_id_fkey";
            columns: "{new_room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "reschedule_decisions_old_room_id_fkey";
            columns: "{old_room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "reschedule_decisions_request_id_fkey";
            columns: "{request_id}";
            isOneToOne: true;
            referencedRelation: "reschedule_requests";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "reschedule_decisions_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      reschedule_requests: {
        Row: {
          id: string;
          room_booking_id: string;
          guest_auth_user_id: string | null;
          guest_email: string | null;
          staff_auth_user_id: string | null;
          request_key: string;
          request_hash: string;
          reason: string;
          expected_revision: number;
          requested_start_at: string;
          requested_end_at: string;
          blocks: number[];
          original_blocks: number[];
          original_start_at: string;
          original_end_at: string;
          original_room_id: number;
          source_claim_id: number;
          original_buffer_minutes: number;
          original_centavos: number;
          confirmation_at: string | null;
          eligibility: string;
          comparison_snapshot: Json | null;
          comparison_centavos: number | null;
          requested_at: string;
        };
        Insert: {
          id?: string;
          room_booking_id: string;
          guest_auth_user_id?: string | null;
          guest_email?: string | null;
          staff_auth_user_id?: string | null;
          request_key: string;
          request_hash: string;
          reason: string;
          expected_revision: number;
          requested_start_at: string;
          requested_end_at: string;
          blocks: number[];
          original_blocks: number[];
          original_start_at: string;
          original_end_at: string;
          original_room_id: number;
          source_claim_id: number;
          original_buffer_minutes: number;
          original_centavos: number;
          confirmation_at?: string | null;
          eligibility: string;
          comparison_snapshot?: Json | null;
          comparison_centavos?: number | null;
          requested_at?: string;
        };
        Update: {
          id?: string;
          room_booking_id?: string;
          guest_auth_user_id?: string | null;
          guest_email?: string | null;
          staff_auth_user_id?: string | null;
          request_key?: string;
          request_hash?: string;
          reason?: string;
          expected_revision?: number;
          requested_start_at?: string;
          requested_end_at?: string;
          blocks?: number[];
          original_blocks?: number[];
          original_start_at?: string;
          original_end_at?: string;
          original_room_id?: number;
          source_claim_id?: number;
          original_buffer_minutes?: number;
          original_centavos?: number;
          confirmation_at?: string | null;
          eligibility?: string;
          comparison_snapshot?: Json | null;
          comparison_centavos?: number | null;
          requested_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reschedule_requests_original_room_id_fkey";
            columns: "{original_room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "reschedule_requests_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "reschedule_requests_source_claim_id_fkey";
            columns: "{source_claim_id}";
            isOneToOne: false;
            referencedRelation: "inventory_claims";
            referencedColumns: "{id}";
          },
        ];
      };
      reservation_booking_contacts: {
        Row: {
          reservation_id: string;
          phone: string;
          policy_version: string;
          policy_text: string;
          acknowledged_by: string;
          acknowledged_at: string;
        };
        Insert: {
          reservation_id: string;
          phone: string;
          policy_version: string;
          policy_text: string;
          acknowledged_by: string;
          acknowledged_at?: string;
        };
        Update: {
          reservation_id?: string;
          phone?: string;
          policy_version?: string;
          policy_text?: string;
          acknowledged_by?: string;
          acknowledged_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservation_booking_contacts_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: true;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      reservation_charge_disclosures: {
        Row: {
          id: string;
          reservation_id: string;
          policy_version_id: string;
          disclosure_text: string;
          disclosure_version: string;
          acknowledgement: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          policy_version_id: string;
          disclosure_text: string;
          disclosure_version: string;
          acknowledgement: string;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          policy_version_id?: string;
          disclosure_text?: string;
          disclosure_version?: string;
          acknowledgement?: string;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservation_charge_disclosures_policy_version_id_fkey";
            columns: "{policy_version_id}";
            isOneToOne: false;
            referencedRelation: "stay_charge_policy_versions";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "reservation_charge_disclosures_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      reservations: {
        Row: {
          id: string;
          owner_auth_user_id: string | null;
          verified_email: string | null;
          primary_name: string;
          idempotency_key: string;
          request_hash: string;
          total_centavos: number;
          created_at: string;
          online_confirmation_at: string | null;
          cancellation_terms_snapshot: string | null;
          channel: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          owner_auth_user_id?: string | null;
          verified_email?: string | null;
          primary_name: string;
          idempotency_key: string;
          request_hash: string;
          total_centavos: number;
          created_at?: string;
          online_confirmation_at?: string | null;
          cancellation_terms_snapshot?: string | null;
          channel?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          owner_auth_user_id?: string | null;
          verified_email?: string | null;
          primary_name?: string;
          idempotency_key?: string;
          request_hash?: string;
          total_centavos?: number;
          created_at?: string;
          online_confirmation_at?: string | null;
          cancellation_terms_snapshot?: string | null;
          channel?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_idempotency_key_fkey";
            columns: "{idempotency_key}";
            isOneToOne: true;
            referencedRelation: "claim_requests";
            referencedColumns: "{idempotency_key}";
          },
        ];
      };
      review_contacts: {
        Row: {
          reservation_id: string;
          email: string;
          verified_auth_user_id: string;
          verified_at: string;
          invitation_consent_at: string | null;
        };
        Insert: {
          reservation_id: string;
          email: string;
          verified_auth_user_id: string;
          verified_at?: string;
          invitation_consent_at?: string | null;
        };
        Update: {
          reservation_id?: string;
          email?: string;
          verified_auth_user_id?: string;
          verified_at?: string;
          invitation_consent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "review_contacts_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: true;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      review_credentials: {
        Row: {
          digest: string;
          reservation_id: string;
          purpose: string;
          email: string | null;
          created_at: string;
          expires_at: string;
          consumed_at: string | null;
          revoked_at: string | null;
          attempts: number;
          otp_digest: string | null;
          delivery_state: string | null;
        };
        Insert: {
          digest: string;
          reservation_id: string;
          purpose: string;
          email?: string | null;
          created_at?: string;
          expires_at: string;
          consumed_at?: string | null;
          revoked_at?: string | null;
          attempts?: number;
          otp_digest?: string | null;
          delivery_state?: string | null;
        };
        Update: {
          digest?: string;
          reservation_id?: string;
          purpose?: string;
          email?: string | null;
          created_at?: string;
          expires_at?: string;
          consumed_at?: string | null;
          revoked_at?: string | null;
          attempts?: number;
          otp_digest?: string | null;
          delivery_state?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "review_credentials_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      review_events: {
        Row: {
          id: string;
          review_id: string | null;
          feedback_id: string | null;
          actor_auth_user_id: string | null;
          actor_grant_digest: string | null;
          action: string;
          reason_code: string | null;
          reason: string | null;
          previous_status: string | null;
          next_status: string | null;
          request_key: string;
          request_hash: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          review_id?: string | null;
          feedback_id?: string | null;
          actor_auth_user_id?: string | null;
          actor_grant_digest?: string | null;
          action: string;
          reason_code?: string | null;
          reason?: string | null;
          previous_status?: string | null;
          next_status?: string | null;
          request_key: string;
          request_hash: string;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string | null;
          feedback_id?: string | null;
          actor_auth_user_id?: string | null;
          actor_grant_digest?: string | null;
          action?: string;
          reason_code?: string | null;
          reason?: string | null;
          previous_status?: string | null;
          next_status?: string | null;
          request_key?: string;
          request_hash?: string;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_events_actor_grant_digest_fkey";
            columns: "{actor_grant_digest}";
            isOneToOne: false;
            referencedRelation: "review_credentials";
            referencedColumns: "{digest}";
          },
          {
            foreignKeyName: "review_events_feedback_id_fkey";
            columns: "{feedback_id}";
            isOneToOne: false;
            referencedRelation: "private_feedback";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "review_events_review_id_fkey";
            columns: "{review_id}";
            isOneToOne: false;
            referencedRelation: "guest_reviews";
            referencedColumns: "{id}";
          },
        ];
      };
      review_invitation_jobs: {
        Row: { reservation_id: string; queued_at: string };
        Insert: { reservation_id: string; queued_at?: string };
        Update: { reservation_id?: string; queued_at?: string };
        Relationships: [
          {
            foreignKeyName: "review_invitation_jobs_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: true;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      review_replies: {
        Row: {
          review_id: string;
          actor_auth_user_id: string;
          message: string;
          created_at: string;
        };
        Insert: {
          review_id: string;
          actor_auth_user_id: string;
          message: string;
          created_at?: string;
        };
        Update: {
          review_id?: string;
          actor_auth_user_id?: string;
          message?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_replies_review_id_fkey";
            columns: "{review_id}";
            isOneToOne: true;
            referencedRelation: "guest_reviews";
            referencedColumns: "{id}";
          },
        ];
      };
      room_administration_events: {
        Row: {
          id: number;
          room_id: number;
          actor_auth_user_id: string;
          request_key: string;
          old_code: string;
          new_code: string;
          old_active: boolean;
          new_active: boolean;
          note: string;
          occurred_at: string;
        };
        Insert: {
          id?: never;
          room_id: number;
          actor_auth_user_id: string;
          request_key: string;
          old_code: string;
          new_code: string;
          old_active: boolean;
          new_active: boolean;
          note: string;
          occurred_at?: string;
        };
        Update: {
          id?: never;
          room_id?: number;
          actor_auth_user_id?: string;
          request_key?: string;
          old_code?: string;
          new_code?: string;
          old_active?: boolean;
          new_active?: boolean;
          note?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_administration_events_room_id_fkey";
            columns: "{room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
        ];
      };
      room_blocks: {
        Row: {
          id: number;
          room_id: number;
          start_at: string;
          end_at: string | null;
          planned_turnover_end_at: string | null;
          reason: string;
        };
        Insert: {
          id?: never;
          room_id: number;
          start_at: string;
          end_at?: string | null;
          planned_turnover_end_at?: string | null;
          reason: string;
        };
        Update: {
          id?: never;
          room_id?: number;
          start_at?: string;
          end_at?: string | null;
          planned_turnover_end_at?: string | null;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_blocks_room_id_fkey";
            columns: "{room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
        ];
      };
      room_bookings: {
        Row: {
          id: string;
          reservation_id: string;
          item_index: number;
          claim_id: number;
          category_code: string;
          start_at: string;
          end_at: string;
          adult_count: number;
          child_count: number;
          base_centavos: number;
          extra_bed_centavos: number;
          total_centavos: number;
          pricing_snapshot: Json;
          status: string;
          schedule_revision: number;
          pending_reschedule_id: string | null;
          stay_extension_revision: number;
          pending_extension_id: string | null;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          item_index: number;
          claim_id: number;
          category_code: string;
          start_at: string;
          end_at: string;
          adult_count: number;
          child_count: number;
          base_centavos: number;
          extra_bed_centavos: number;
          total_centavos: number;
          pricing_snapshot: Json;
          status?: string;
          schedule_revision?: number;
          pending_reschedule_id?: string | null;
          stay_extension_revision?: number;
          pending_extension_id?: string | null;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          item_index?: number;
          claim_id?: number;
          category_code?: string;
          start_at?: string;
          end_at?: string;
          adult_count?: number;
          child_count?: number;
          base_centavos?: number;
          extra_bed_centavos?: number;
          total_centavos?: number;
          pricing_snapshot?: Json;
          status?: string;
          schedule_revision?: number;
          pending_reschedule_id?: string | null;
          stay_extension_revision?: number;
          pending_extension_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "item_pending_reschedule";
            columns: "{pending_reschedule_id,id}";
            isOneToOne: false;
            referencedRelation: "reschedule_requests";
            referencedColumns: "{id,room_booking_id}";
          },
          {
            foreignKeyName: "pending_extension_identity";
            columns: "{pending_extension_id,id}";
            isOneToOne: false;
            referencedRelation: "stay_extension_requests";
            referencedColumns: "{id,room_booking_id}";
          },
          {
            foreignKeyName: "room_bookings_category_code_fkey";
            columns: "{category_code}";
            isOneToOne: false;
            referencedRelation: "room_categories";
            referencedColumns: "{code}";
          },
          {
            foreignKeyName: "room_bookings_claim_id_fkey";
            columns: "{claim_id}";
            isOneToOne: true;
            referencedRelation: "inventory_claims";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "room_bookings_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      room_categories: {
        Row: {
          id: number;
          code: string;
          name: string;
          standard_occupancy_note: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: never;
          code: string;
          name: string;
          standard_occupancy_note?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: never;
          code?: string;
          name?: string;
          standard_occupancy_note?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      room_check_ins: {
        Row: {
          room_booking_id: string;
          room_id: number;
          actor_auth_user_id: string;
          request_key: string;
          checked_in_at: string;
          checkout_at: string;
        };
        Insert: {
          room_booking_id: string;
          room_id: number;
          actor_auth_user_id: string;
          request_key: string;
          checked_in_at: string;
          checkout_at: string;
        };
        Update: {
          room_booking_id?: string;
          room_id?: number;
          actor_auth_user_id?: string;
          request_key?: string;
          checked_in_at?: string;
          checkout_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_check_ins_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: true;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "room_check_ins_room_id_fkey";
            columns: "{room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
        ];
      };
      room_checkouts: {
        Row: {
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          checked_out_at: string;
          balance_centavos: number;
          exception_reason: string | null;
          cleaning_block_id: number;
        };
        Insert: {
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          checked_out_at: string;
          balance_centavos: number;
          exception_reason?: string | null;
          cleaning_block_id: number;
        };
        Update: {
          room_booking_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          checked_out_at?: string;
          balance_centavos?: number;
          exception_reason?: string | null;
          cleaning_block_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "room_checkouts_cleaning_block_id_fkey";
            columns: "{cleaning_block_id}";
            isOneToOne: true;
            referencedRelation: "room_blocks";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "room_checkouts_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: true;
            referencedRelation: "room_check_ins";
            referencedColumns: "{room_booking_id}";
          },
        ];
      };
      room_inspections: {
        Row: {
          id: number;
          room_id: number;
          actor_auth_user_id: string;
          request_key: string;
          note: string;
          occurred_at: string;
        };
        Insert: {
          id?: never;
          room_id: number;
          actor_auth_user_id: string;
          request_key: string;
          note: string;
          occurred_at?: string;
        };
        Update: {
          id?: never;
          room_id?: number;
          actor_auth_user_id?: string;
          request_key?: string;
          note?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_inspections_room_id_fkey";
            columns: "{room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
        ];
      };
      room_reassignments: {
        Row: {
          id: number;
          room_booking_id: string;
          old_room_id: number;
          new_room_id: number;
          actor_auth_user_id: string;
          request_key: string;
          note: string;
          start_at: string;
          end_at: string;
          occurred_at: string;
        };
        Insert: {
          id?: never;
          room_booking_id: string;
          old_room_id: number;
          new_room_id: number;
          actor_auth_user_id: string;
          request_key: string;
          note: string;
          start_at: string;
          end_at: string;
          occurred_at?: string;
        };
        Update: {
          id?: never;
          room_booking_id?: string;
          old_room_id?: number;
          new_room_id?: number;
          actor_auth_user_id?: string;
          request_key?: string;
          note?: string;
          start_at?: string;
          end_at?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_reassignments_new_room_id_fkey";
            columns: "{new_room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "room_reassignments_old_room_id_fkey";
            columns: "{old_room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "room_reassignments_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      rooms: {
        Row: {
          id: number;
          category_id: number;
          code: string;
          operational_state: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: never;
          category_id: number;
          code: string;
          operational_state?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: never;
          category_id?: number;
          code?: string;
          operational_state?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_category_id_fkey";
            columns: "{category_id}";
            isOneToOne: false;
            referencedRelation: "room_categories";
            referencedColumns: "{id}";
          },
        ];
      };
      staff_accounts: {
        Row: {
          auth_user_id: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_accounts_auth_user_id_fkey";
            columns: "{auth_user_id}";
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: "{id}";
          },
        ];
      };
      staff_audit: {
        Row: {
          id: number;
          actor_auth_user_id: string;
          action: string;
          occurred_at: string;
        };
        Insert: {
          id?: never;
          actor_auth_user_id: string;
          action: string;
          occurred_at?: string;
        };
        Update: {
          id?: never;
          actor_auth_user_id?: string;
          action?: string;
          occurred_at?: string;
        };
        Relationships: [];
      };
      stay_charge_entries: {
        Row: {
          id: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          kind: string;
          extension_request_id: string | null;
          review_id: string | null;
          credit_of: string | null;
          amount_centavos: number;
          recorded_at: string;
          reservation_id: string;
        };
        Insert: {
          id?: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          kind: string;
          extension_request_id?: string | null;
          review_id?: string | null;
          credit_of?: string | null;
          amount_centavos: number;
          recorded_at?: string;
          reservation_id: string;
        };
        Update: {
          id?: string;
          room_booking_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          request_hash?: string;
          reason?: string;
          kind?: string;
          extension_request_id?: string | null;
          review_id?: string | null;
          credit_of?: string | null;
          amount_centavos?: number;
          recorded_at?: string;
          reservation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "extension_reservation_identity";
            columns: "{extension_request_id,reservation_id}";
            isOneToOne: false;
            referencedRelation: "stay_extension_requests";
            referencedColumns: "{id,reservation_id}";
          },
          {
            foreignKeyName: "item_reservation_identity";
            columns: "{room_booking_id,reservation_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id,reservation_id}";
          },
          {
            foreignKeyName: "stay_charge_entries_credit_of_fkey";
            columns: "{credit_of}";
            isOneToOne: false;
            referencedRelation: "stay_charge_entries";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_charge_entries_extension_request_id_fkey";
            columns: "{extension_request_id}";
            isOneToOne: true;
            referencedRelation: "stay_extension_requests";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_charge_entries_review_id_fkey";
            columns: "{review_id}";
            isOneToOne: false;
            referencedRelation: "stay_charge_reviews";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_charge_entries_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      stay_charge_policy_versions: {
        Row: {
          id: string;
          kind: string;
          rate_centavos: number;
          effective_from: string;
          effective_until: string | null;
          disclosure_text: string;
          disclosure_version: string;
          unit: string;
          rounding: string | null;
          extra_bed_treatment: string | null;
          owner_approval_evidence: string;
          approved_at: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          rate_centavos: number;
          effective_from: string;
          effective_until?: string | null;
          disclosure_text: string;
          disclosure_version: string;
          unit: string;
          rounding?: string | null;
          extra_bed_treatment?: string | null;
          owner_approval_evidence: string;
          approved_at: string;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          rate_centavos?: number;
          effective_from?: string;
          effective_until?: string | null;
          disclosure_text?: string;
          disclosure_version?: string;
          unit?: string;
          rounding?: string | null;
          extra_bed_treatment?: string | null;
          owner_approval_evidence?: string;
          approved_at?: string;
          recorded_at?: string;
        };
        Relationships: [];
      };
      stay_charge_reviews: {
        Row: {
          id: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          kind: string;
          start_at: string | null;
          end_at: string | null;
          policy_version_id: string | null;
          disclosure_id: string | null;
          proposed_centavos: number | null;
          recorded_at: string;
          reservation_id: string;
        };
        Insert: {
          id?: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          kind: string;
          start_at?: string | null;
          end_at?: string | null;
          policy_version_id?: string | null;
          disclosure_id?: string | null;
          proposed_centavos?: number | null;
          recorded_at?: string;
          reservation_id: string;
        };
        Update: {
          id?: string;
          room_booking_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          request_hash?: string;
          reason?: string;
          kind?: string;
          start_at?: string | null;
          end_at?: string | null;
          policy_version_id?: string | null;
          disclosure_id?: string | null;
          proposed_centavos?: number | null;
          recorded_at?: string;
          reservation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_reservation_identity";
            columns: "{room_booking_id,reservation_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id,reservation_id}";
          },
          {
            foreignKeyName: "stay_charge_reviews_disclosure_id_fkey";
            columns: "{disclosure_id}";
            isOneToOne: false;
            referencedRelation: "reservation_charge_disclosures";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_charge_reviews_policy_version_id_fkey";
            columns: "{policy_version_id}";
            isOneToOne: false;
            referencedRelation: "stay_charge_policy_versions";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_charge_reviews_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      stay_extension_decisions: {
        Row: {
          id: string;
          request_id: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          approved: boolean;
          expected_revision: number;
          recorded_at: string;
          old_revision: number;
          new_revision: number;
          old_end: string;
          new_end: string;
          source_snapshot: Json;
          reservation_id: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          approved: boolean;
          expected_revision: number;
          recorded_at?: string;
          old_revision: number;
          new_revision: number;
          old_end: string;
          new_end: string;
          source_snapshot: Json;
          reservation_id: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          room_booking_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          request_hash?: string;
          reason?: string;
          approved?: boolean;
          expected_revision?: number;
          recorded_at?: string;
          old_revision?: number;
          new_revision?: number;
          old_end?: string;
          new_end?: string;
          source_snapshot?: Json;
          reservation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decision_item_identity";
            columns: "{request_id,room_booking_id}";
            isOneToOne: false;
            referencedRelation: "stay_extension_requests";
            referencedColumns: "{id,room_booking_id}";
          },
          {
            foreignKeyName: "item_reservation_identity";
            columns: "{room_booking_id,reservation_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id,reservation_id}";
          },
          {
            foreignKeyName: "stay_extension_decisions_request_id_fkey";
            columns: "{request_id}";
            isOneToOne: true;
            referencedRelation: "stay_extension_requests";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_extension_decisions_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      stay_extension_requests: {
        Row: {
          id: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          expected_revision: number;
          blocks: number[];
          old_end: string;
          new_end: string;
          amount_centavos: number;
          package_snapshot: Json;
          recorded_at: string;
          source_claim_id: number;
          source_room_id: number;
          source_start_at: string;
          source_buffer_minutes: number;
          baseline_checkout_at: string;
          category_snapshot: string;
          reservation_id: string;
        };
        Insert: {
          id?: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          expected_revision: number;
          blocks: number[];
          old_end: string;
          new_end: string;
          amount_centavos: number;
          package_snapshot: Json;
          recorded_at?: string;
          source_claim_id: number;
          source_room_id: number;
          source_start_at: string;
          source_buffer_minutes: number;
          baseline_checkout_at: string;
          category_snapshot: string;
          reservation_id: string;
        };
        Update: {
          id?: string;
          room_booking_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          request_hash?: string;
          reason?: string;
          expected_revision?: number;
          blocks?: number[];
          old_end?: string;
          new_end?: string;
          amount_centavos?: number;
          package_snapshot?: Json;
          recorded_at?: string;
          source_claim_id?: number;
          source_room_id?: number;
          source_start_at?: string;
          source_buffer_minutes?: number;
          baseline_checkout_at?: string;
          category_snapshot?: string;
          reservation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_reservation_identity";
            columns: "{room_booking_id,reservation_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id,reservation_id}";
          },
          {
            foreignKeyName: "stay_extension_requests_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_extension_requests_source_claim_id_fkey";
            columns: "{source_claim_id}";
            isOneToOne: false;
            referencedRelation: "inventory_claims";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_extension_requests_source_room_id_fkey";
            columns: "{source_room_id}";
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: "{id}";
          },
        ];
      };
      stay_receipt_allocations: {
        Row: {
          id: string;
          receipt_id: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          kind: string;
          extension_request_id: string | null;
          charge_id: string | null;
          release_of: string | null;
          amount_centavos: number;
          recorded_at: string;
          reservation_id: string;
        };
        Insert: {
          id?: string;
          receipt_id: string;
          room_booking_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          kind: string;
          extension_request_id?: string | null;
          charge_id?: string | null;
          release_of?: string | null;
          amount_centavos: number;
          recorded_at?: string;
          reservation_id: string;
        };
        Update: {
          id?: string;
          receipt_id?: string;
          room_booking_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          request_hash?: string;
          reason?: string;
          kind?: string;
          extension_request_id?: string | null;
          charge_id?: string | null;
          release_of?: string | null;
          amount_centavos?: number;
          recorded_at?: string;
          reservation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "extension_reservation_identity";
            columns: "{extension_request_id,reservation_id}";
            isOneToOne: false;
            referencedRelation: "stay_extension_requests";
            referencedColumns: "{id,reservation_id}";
          },
          {
            foreignKeyName: "item_reservation_identity";
            columns: "{room_booking_id,reservation_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id,reservation_id}";
          },
          {
            foreignKeyName: "stay_receipt_allocations_charge_id_fkey";
            columns: "{charge_id}";
            isOneToOne: false;
            referencedRelation: "stay_charge_entries";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_receipt_allocations_charge_id_reservation_id_fkey";
            columns: "{charge_id,reservation_id}";
            isOneToOne: false;
            referencedRelation: "stay_charge_entries";
            referencedColumns: "{id,reservation_id}";
          },
          {
            foreignKeyName: "stay_receipt_allocations_extension_request_id_fkey";
            columns: "{extension_request_id}";
            isOneToOne: false;
            referencedRelation: "stay_extension_requests";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_receipt_allocations_receipt_id_fkey";
            columns: "{receipt_id}";
            isOneToOne: false;
            referencedRelation: "stay_receipts";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_receipt_allocations_receipt_id_reservation_id_fkey";
            columns: "{receipt_id,reservation_id}";
            isOneToOne: false;
            referencedRelation: "stay_receipts";
            referencedColumns: "{id,reservation_id}";
          },
          {
            foreignKeyName: "stay_receipt_allocations_release_of_fkey";
            columns: "{release_of}";
            isOneToOne: true;
            referencedRelation: "stay_receipt_allocations";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_receipt_allocations_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
      stay_receipts: {
        Row: {
          id: string;
          room_booking_id: string;
          reservation_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          method: string;
          amount_centavos: number;
          received_at: string;
          cash_received: boolean | null;
          normalized_reference: string | null;
          recipient: string | null;
          ledger_checked: boolean | null;
          receiving_account_checked: boolean | null;
          time_checked: boolean | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          room_booking_id: string;
          reservation_id: string;
          actor_auth_user_id: string;
          request_key: string;
          request_hash: string;
          reason: string;
          method: string;
          amount_centavos: number;
          received_at: string;
          cash_received?: boolean | null;
          normalized_reference?: string | null;
          recipient?: string | null;
          ledger_checked?: boolean | null;
          receiving_account_checked?: boolean | null;
          time_checked?: boolean | null;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          room_booking_id?: string;
          reservation_id?: string;
          actor_auth_user_id?: string;
          request_key?: string;
          request_hash?: string;
          reason?: string;
          method?: string;
          amount_centavos?: number;
          received_at?: string;
          cash_received?: boolean | null;
          normalized_reference?: string | null;
          recipient?: string | null;
          ledger_checked?: boolean | null;
          receiving_account_checked?: boolean | null;
          time_checked?: boolean | null;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stay_receipts_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_receipts_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "stay_receipts_room_booking_id_reservation_id_fkey";
            columns: "{room_booking_id,reservation_id}";
            isOneToOne: false;
            referencedRelation: "room_bookings";
            referencedColumns: "{id,reservation_id}";
          },
        ];
      };
      verified_online_payments: {
        Row: {
          submission_id: string;
          normalized_reference: string;
          amount_centavos: number;
          recipient: string;
          received_at: string;
          verified_by: string;
          verified_at: string;
        };
        Insert: {
          submission_id: string;
          normalized_reference: string;
          amount_centavos: number;
          recipient: string;
          received_at: string;
          verified_by: string;
          verified_at?: string;
        };
        Update: {
          submission_id?: string;
          normalized_reference?: string;
          amount_centavos?: number;
          recipient?: string;
          received_at?: string;
          verified_by?: string;
          verified_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verified_online_payments_submission_id_fkey";
            columns: "{submission_id}";
            isOneToOne: true;
            referencedRelation: "payment_submissions";
            referencedColumns: "{id}";
          },
        ];
      };
      walkin_guest_contacts: {
        Row: {
          reservation_id: string;
          phone: string;
          email: string | null;
          policy_version: string;
          policy_text: string;
          acknowledged_by: string;
          acknowledged_at: string;
          minor_id_status: string;
          minor_id_checked_by: string | null;
          minor_id_checked_at: string | null;
        };
        Insert: {
          reservation_id: string;
          phone: string;
          email?: string | null;
          policy_version: string;
          policy_text: string;
          acknowledged_by: string;
          acknowledged_at?: string;
          minor_id_status: string;
          minor_id_checked_by?: string | null;
          minor_id_checked_at?: string | null;
        };
        Update: {
          reservation_id?: string;
          phone?: string;
          email?: string | null;
          policy_version?: string;
          policy_text?: string;
          acknowledged_by?: string;
          acknowledged_at?: string;
          minor_id_status?: string;
          minor_id_checked_by?: string | null;
          minor_id_checked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "walkin_guest_contacts_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: true;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
        ];
      };
      walkin_ledger: {
        Row: {
          id: string;
          reservation_id: string;
          kind: string;
          room_booking_id: string | null;
          method: string | null;
          amount_centavos: number;
          transaction_reference: string | null;
          normalized_reference: string | null;
          recipient: string | null;
          received_at: string | null;
          ledger_checked: boolean;
          receiving_account_checked: boolean;
          time_checked: boolean;
          actor_auth_user_id: string;
          recorded_at: string;
          request_key: string;
          request_hash: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          kind: string;
          room_booking_id?: string | null;
          method?: string | null;
          amount_centavos: number;
          transaction_reference?: string | null;
          normalized_reference?: string | null;
          recipient?: string | null;
          received_at?: string | null;
          ledger_checked?: boolean;
          receiving_account_checked?: boolean;
          time_checked?: boolean;
          actor_auth_user_id: string;
          recorded_at?: string;
          request_key: string;
          request_hash: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          kind?: string;
          room_booking_id?: string | null;
          method?: string | null;
          amount_centavos?: number;
          transaction_reference?: string | null;
          normalized_reference?: string | null;
          recipient?: string | null;
          received_at?: string | null;
          ledger_checked?: boolean;
          receiving_account_checked?: boolean;
          time_checked?: boolean;
          actor_auth_user_id?: string;
          recorded_at?: string;
          request_key?: string;
          request_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "walkin_ledger_reservation_id_fkey";
            columns: "{reservation_id}";
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: "{id}";
          },
          {
            foreignKeyName: "walkin_ledger_room_booking_id_fkey";
            columns: "{room_booking_id}";
            isOneToOne: true;
            referencedRelation: "room_bookings";
            referencedColumns: "{id}";
          },
        ];
      };
    };
    Views: {
      online_payment_allocations: {
        Row: {
          reservation_id: string | null;
          submission_id: string | null;
          room_booking_id: string | null;
          hall_reservation_id: string | null;
          amount_centavos: number | null;
          received_at: string | null;
          verified_at: string | null;
        };
        Relationships: [];
      };
      reservation_base_financials: {
        Row: {
          reservation_id: string | null;
          original_centavos: number | null;
          cancellation_credit_centavos: number | null;
          net_charge_centavos: number | null;
          collected_centavos: number | null;
          refunded_centavos: number | null;
          refund_due_centavos: number | null;
          balance_centavos: number | null;
        };
        Relationships: [];
      };
      reservation_financials: {
        Row: {
          reservation_id: string | null;
          original_centavos: number | null;
          cancellation_credit_centavos: number | null;
          net_charge_centavos: number | null;
          collected_centavos: number | null;
          refunded_centavos: number | null;
          refund_due_centavos: number | null;
          balance_centavos: number | null;
          settlement_due_centavos: number | null;
          unallocated_x03_centavos: number | null;
          pending_extension_funds_centavos: number | null;
        };
        Relationships: [];
      };
      stay_active_allocations: {
        Row: {
          id: string | null;
          receipt_id: string | null;
          room_booking_id: string | null;
          actor_auth_user_id: string | null;
          request_key: string | null;
          request_hash: string | null;
          reason: string | null;
          kind: string | null;
          extension_request_id: string | null;
          charge_id: string | null;
          release_of: string | null;
          amount_centavos: number | null;
          recorded_at: string | null;
        };
        Relationships: [];
      };
      stay_item_terms: {
        Row: {
          room_booking_id: string | null;
          original_checkout_at: string | null;
          effective_checkout_at: string | null;
          stay_extension_revision: number | null;
        };
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
  staytrack: {
    Enums: {},
  },
} as const;
