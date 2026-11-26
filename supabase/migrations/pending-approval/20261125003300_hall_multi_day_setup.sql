alter table staytrack.hall_settings
  drop constraint hall_settings_preparation_check,
  add constraint hall_settings_preparation_check check (preparation >= 0);
