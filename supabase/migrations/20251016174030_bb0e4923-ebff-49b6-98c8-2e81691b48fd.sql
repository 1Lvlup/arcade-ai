-- Grant tenant access to all existing manuals that don't have access entries
INSERT INTO tenant_manual_access (fec_tenant_id, manual_id)
SELECT DISTINCT 
  d.fec_tenant_id,
  d.manual_id
FROM documents d
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_manual_access tma 
  WHERE tma.manual_id = d.manual_id 
  AND tma.fec_tenant_id = d.fec_tenant_id
)
ON CONFLICT (fec_tenant_id, manual_id) DO NOTHING;