alter table staytrack.hall_settings
  drop constraint hall_settings_no_show_grace_check,
  add constraint hall_settings_no_show_grace_check check (no_show_grace >= 0);
