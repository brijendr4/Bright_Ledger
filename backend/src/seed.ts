import { query, transaction } from './db.js'

export async function seedDemoData() {
  const demoUsers = [
    ['demo-prosumer', 'Avery Stone', 'prosumer'],
    ['demo-consumer', 'Jordan Blake', 'consumer'],
    ['demo-verifier', 'Bright Ledger Reviewer', 'verifier'],
    ['demo-neighbor', 'Taylor Reed', 'consumer'],
    ['demo-community', 'Sunrise Community Co-op', 'space_owner'],
    ['demo-funder', 'Community Funder', 'funder'],
  ] as const
  for (const [demoKey, displayName, role] of demoUsers) {
    await query(
      `INSERT INTO users(display_name, role, demo_key, demo_balance)
       VALUES ($1, $2, $3, CASE WHEN $2 = 'funder' THEN 1000 ELSE 0 END)
       ON CONFLICT(demo_key) DO NOTHING`,
      [displayName, role, `bright-ledger:${demoKey}`],
    )
  }
  const idsResult = await query<{ id: string; demoKey: string }>('SELECT id, demo_key AS "demoKey" FROM users WHERE demo_key LIKE $1', ['bright-ledger:demo-%'])
  const users = new Map(idsResult.rows.map((user) => [user.demoKey.replace('bright-ledger:', ''), user.id]))
  const user = (key: string) => {
    const value = users.get(key)
    if (!value) throw new Error(`Missing seeded demo user: ${key}`)
    return value
  }

  const listings = [
    ['OFF-2481', 'offer', 'demo-prosumer', 18.4, 0.18, 'New Delhi, India', 'Rooftop solar', 14],
    ['OFF-2480', 'offer', 'demo-neighbor', 12, 0.16, 'Jakarta, Indonesia', 'Solar + storage', 15],
    ['OFF-2479', 'offer', 'demo-community', 34.5, 0.20, 'Beijing, China', 'Community solar', 40],
    ['REQ-1067', 'request', 'demo-consumer', 8, 0.25, 'Dhaka, Bangladesh', 'Any renewable', 14],
    ['REQ-1066', 'request', 'demo-neighbor', 16, 0.22, 'Cairo, Egypt', 'Rooftop solar', 40],
  ] as const
  for (const [publicId, type, owner, quantity, price, area, source, endHours] of listings) {
    await query(
      `INSERT INTO listings(public_id,type,owner_id,quantity_kwh,available_kwh,price_per_kwh,service_area,renewable_source,delivery_start,delivery_end)
       VALUES($1,$2,$3,$4,$4,$5,$6,$7,now() + interval '1 hour',now() + ($8 || ' hours')::interval)
       ON CONFLICT(public_id) DO NOTHING`,
      [publicId, type, user(owner), quantity, price, area, source, String(endHours)],
    )
  }

  const trades = [
    ['TRD-00842', 'OFF-2481', 'demo-consumer', 'demo-prosumer', 12.4, 0.17, 'evidence_needed'],
    ['TRD-00841', 'OFF-2480', 'demo-consumer', 'demo-neighbor', 8, 0.16, 'under_review'],
    ['TRD-00839', 'OFF-2481', 'demo-neighbor', 'demo-prosumer', 6.2, 0.18, 'settled'],
    ['TRD-00835', 'OFF-2479', 'demo-consumer', 'demo-community', 10, 0.17, 'settled'],
  ] as const
  for (const [publicId, listingId, buyer, seller, quantity, price, status] of trades) {
    await query(
      `INSERT INTO trades(public_id,listing_id,buyer_id,seller_id,quantity_kwh,price_per_kwh,status)
       SELECT $1,l.id,$3,$4,$5,$6,$7 FROM listings l WHERE l.public_id=$2
       ON CONFLICT(public_id) DO NOTHING`,
      [publicId, listingId, user(buyer), user(seller), quantity, price, status],
    )
  }
  await query(
    `INSERT INTO trade_confirmations(trade_id,user_id)
     SELECT t.id,participant.user_id
     FROM trades t
     CROSS JOIN LATERAL (VALUES(t.buyer_id),(t.seller_id)) AS participant(user_id)
     WHERE t.status IN ('evidence_needed','under_review','ready_to_settle','settled')
     ON CONFLICT DO NOTHING`,
  )

  const evidence = [
    ['EVD-3392', 'TRD-00842', 'demo-prosumer', 12.4, 'Simulated smart meter', 'pending'],
    ['EVD-3391', 'TRD-00841', 'demo-neighbor', 8, 'Manual reading · demo', 'pending'],
    ['EVD-3387', 'TRD-00839', 'demo-prosumer', 6.2, 'Simulated smart meter', 'approved'],
  ] as const
  for (const [publicId, tradeId, submitter, quantity, source, status] of evidence) {
    await query(
      `INSERT INTO evidence(public_id,trade_id,submitter_id,quantity_kwh,source,interval_start,interval_end,evidence_hash,status,reviewer_id,reviewed_at)
       SELECT $1,t.id,$3,$4,$5,now() - interval '1 hour',now(),encode(digest($1,'sha256'),'hex'),$6,
         CASE WHEN $6='approved' THEN $7::uuid ELSE NULL END,
         CASE WHEN $6='approved' THEN now() ELSE NULL END
       FROM trades t WHERE t.public_id=$2
       ON CONFLICT(public_id) DO NOTHING`,
      [publicId, tradeId, user(submitter), quantity, source, status, user('demo-verifier')],
    )
  }

  const projects = [
    ['PRJ-014', 'Sunrise Community Rooftop', 'Istanbul, Türkiye', 'Shared rooftop', 'demo-community', 180, 85000, 'Owner permission stated', 'Community housing rooftop with shared solar potential.', 'funding'],
    ['PRJ-012', 'The Courtyard Solar', 'London, United Kingdom', 'Residential rooftop', 'demo-prosumer', 126, 62000, 'Owner permission stated', 'Residential rooftop proposal.', 'funding'],
    ['PRJ-009', 'Community Power Hub', 'Washington, D.C., United States', 'Community facility', 'demo-community', 240, 120000, 'Community space', 'Community facility with a planned rooftop installation.', 'operational'],
  ] as const
  for (const [publicId, name, location, siteType, owner, area, target, permission, notes, status] of projects) {
    await query(
      `INSERT INTO projects(public_id,name,location,site_type,owner_id,usable_area_m2,capacity_kw,funding_target,permission_status,notes,status)
       VALUES($1,$2,$3,$4,$5,$6,round(($6::numeric / 7.5),3),$7,$8,$9,$10)
       ON CONFLICT(public_id) DO NOTHING`,
      [publicId, name, location, siteType, user(owner), area, target, permission, notes, status],
    )
  }

  const contributionSeeds = [
    ['CON-0192', 'PRJ-014', 61200, 'seed:CON-0192'],
    ['CON-0186', 'PRJ-012', 43400, 'seed:CON-0186'],
    ['CON-0171', 'PRJ-009', 120000, 'seed:CON-0171'],
  ] as const
  for (const [publicId, projectId, amount, key] of contributionSeeds) {
    await query(
      `INSERT INTO contributions(public_id,project_id,contributor_id,amount,idempotency_key)
       SELECT $1,p.id,$3,$4,$5 FROM projects p WHERE p.public_id=$2
       ON CONFLICT(idempotency_key) DO NOTHING`,
      [publicId, projectId, user('demo-funder'), amount, key],
    )
  }

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO rewards(trade_id,user_id,points)
       SELECT t.id, participant.id, GREATEST(1, floor(t.quantity_kwh * 10)::integer)
       FROM trades t
       CROSS JOIN LATERAL (VALUES(t.buyer_id),(t.seller_id)) participant(id)
       WHERE t.public_id IN ('TRD-00839','TRD-00835') AND participant.id IN ($1,$2)
       ON CONFLICT(trade_id,user_id) DO NOTHING`,
      [user('demo-prosumer'), user('demo-consumer')],
    )
    const activityCount = await client.query('SELECT count(*)::int AS count FROM audit_events')
    if (activityCount.rows[0].count === 0) {
      await client.query(
        `INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id,metadata)
         VALUES
           ($1,'evidence.submitted','trade','TRD-00842','{"quantityKwh":12.4,"simulated":true}'),
           ($1,'trade.committed','trade','TRD-00842','{"simulated":true}'),
           ($2,'listing.created','listing','OFF-2481','{"quantityKwh":18.4,"simulated":true}')`,
        [user('demo-prosumer'), user('demo-consumer')],
      )
    }
  })
}
