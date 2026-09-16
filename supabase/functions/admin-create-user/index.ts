import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: actorData } = await admin.auth.getUser(token);
  if (!actorData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const { data: actor } = await admin.from('profiles').select('role,active').eq('id', actorData.user.id).single();
  if (!actor?.active || actor.role !== 'admin') return new Response(JSON.stringify({ error: 'Admin permission required' }), { status: 403 });

  const body = await req.json();
  const email = String(body.email || '').trim().toLowerCase();
  const role = body.role || 'customer';
  const full_name = String(body.full_name || '').trim() || null;
  const phone = String(body.phone || '').trim() || null;
  if (!email || !['customer','distributor','driver','admin'].includes(role)) return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 });

  const { data: created, error } = await admin.auth.admin.createUser({ email, email_confirm: false, user_metadata: { full_name, phone } });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  if (created.user) await admin.from('profiles').update({ full_name, phone, role, active: true }).eq('id', created.user.id);
  return new Response(JSON.stringify({ id: created.user?.id }), { headers: { 'Content-Type': 'application/json' } });
});
