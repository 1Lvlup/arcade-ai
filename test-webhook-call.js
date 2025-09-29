// Test webhook call to simulate LlamaCloud calling our webhook
const response = await fetch('https://wryxbfnmecjffxolcgfa.supabase.co/functions/v1/llama-webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
  },
  body: JSON.stringify({
    jobId: '46ca49b2-1d01-4028-91a7-129729bd668c',
    manual_id: 'virtual-rabbids-troubleshooting-guide',
    tenant_id: '00000000-0000-0000-0000-000000000001'
  })
});

console.log('Response:', response.status, await response.text());