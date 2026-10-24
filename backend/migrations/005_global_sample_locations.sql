UPDATE listings
SET service_area = CASE public_id
  WHEN 'OFF-2481' THEN 'New Delhi, India'
  WHEN 'OFF-2480' THEN 'Jakarta, Indonesia'
  WHEN 'OFF-2479' THEN 'Beijing, China'
  WHEN 'REQ-1067' THEN 'Dhaka, Bangladesh'
  WHEN 'REQ-1066' THEN 'Cairo, Egypt'
  ELSE service_area
END
WHERE public_id IN ('OFF-2481', 'OFF-2480', 'OFF-2479', 'REQ-1067', 'REQ-1066')
  AND EXISTS (SELECT 1 FROM users WHERE users.id = listings.owner_id AND users.demo_key IS NOT NULL);

UPDATE projects
SET location = CASE public_id
  WHEN 'PRJ-014' THEN 'Istanbul, Türkiye'
  WHEN 'PRJ-012' THEN 'London, United Kingdom'
  WHEN 'PRJ-009' THEN 'Washington, D.C., United States'
  ELSE location
END
WHERE public_id IN ('PRJ-014', 'PRJ-012', 'PRJ-009')
  AND EXISTS (SELECT 1 FROM users WHERE users.id = projects.owner_id AND users.demo_key IS NOT NULL);
