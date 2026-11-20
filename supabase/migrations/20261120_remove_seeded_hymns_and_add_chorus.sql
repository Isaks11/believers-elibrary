-- Remove any seeded/mock hymns from public.hymns so admins can upload afresh
delete from public.hymns
where (title, coalesce(composer, '')) in (
  ('Amazing Grace', 'John Newton'),
  ('Great Is Thy Faithfulness', 'Thomas Chisholm'),
  ('It Is Well With My Soul', 'Horatio Spafford'),
  ('How Great Thou Art', 'Carl Boberg'),
  ('Holy, Holy, Holy', 'Reginald Heber'),
  ('Blessed Assurance', 'Fanny Crosby'),
  ('What A Friend We Have In Jesus', 'Joseph Scriven'),
  ('Rock of Ages', 'Augustus Toplady'),
  ('Abide With Me', 'Henry Lyte'),
  ('All Creatures of Our God and King', 'Francis of Assisi'),
  ('Be Thou My Vision', 'Dallan Forgaill'),
  ('Come Thou Fount of Every Blessing', 'Robert Robinson'),
  ('Christ the Lord Is Risen Today', 'Charles Wesley'),
  ('O Come, All Ye Faithful', 'John Francis Wade'),
  ('Joy to the World', 'Isaac Watts')
);

-- Add hymn_type ('hymn' | 'chorus') and tune columns to public.hymns
alter table public.hymns
  add column if not exists hymn_type text not null default 'hymn'
    check (hymn_type in ('hymn', 'chorus'));

alter table public.hymns
  add column if not exists tune text;
