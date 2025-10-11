-- Update manual_metadata with platform, manufacturer, and family info
-- Bay Tek redemption games
UPDATE public.manual_metadata SET 
  manufacturer = 'Bay Tek Entertainment',
  platform = 'Redemption',
  family = 'Carnival Games'
WHERE manual_id IN ('ice-ball-manual', 'down-the-clown', 'down-the-clown-2', 'fish-bowl-1759372572064', 'big-bass-wheel-1759372263861', 'milk-jug-1759261064545');

UPDATE public.manual_metadata SET 
  manufacturer = 'Bay Tek Entertainment',
  platform = 'Redemption',
  family = 'Bowling'
WHERE manual_id IN ('hyperbowling-parts-manual', 'hyper-bowling-install');

-- Raw Thrills video games
UPDATE public.manual_metadata SET 
  manufacturer = 'Raw Thrills',
  platform = 'Video Game',
  family = 'Shooter'
WHERE manual_id IN ('space-invaders-frenzy-manual', 'jurassic-park', 'king-kong-of-skull-island-manual-3', 'halo-2p-1');

UPDATE public.manual_metadata SET 
  manufacturer = 'Raw Thrills',
  platform = 'Video Game',
  family = 'Racing'
WHERE manual_id = 'cruisin-blast';

-- Smart Industries crane games
UPDATE public.manual_metadata SET 
  manufacturer = 'Smart Industries',
  platform = 'Redemption',
  family = 'Claw Crane'
WHERE manual_id = 'extrerme-claw-cosmic-manual';

-- Edge String (redemption skill game)
UPDATE public.manual_metadata SET 
  manufacturer = 'Andamiro',
  platform = 'Redemption',
  family = 'Skill Games'
WHERE manual_id = 'edge-string-owners-manual-revc';

-- Taj Mahal (redemption)
UPDATE public.manual_metadata SET 
  manufacturer = 'Coastal Amusements',
  platform = 'Redemption',
  family = 'Ticket Redemption'
WHERE manual_id = 'taj-mahal-manual';