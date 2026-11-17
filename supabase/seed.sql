-- Local development only. These are fictitious identifiers, not hotel room numbers.
insert into staytrack.rooms (category_id, code)
select c.id, 'DEMO-STD-' || lpad(n::text, 2, '0')
from staytrack.room_categories c cross join generate_series(1, 10) n
where c.code = 'double_standard';

insert into staytrack.rooms (category_id, code)
select c.id, 'DEMO-FAM-' || lpad(n::text, 2, '0')
from staytrack.room_categories c cross join generate_series(1, 5) n
where c.code = 'family_executive';
