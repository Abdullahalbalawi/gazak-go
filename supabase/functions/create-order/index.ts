import { withSupabase } from 'npm:@supabase/server@^1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      const actorId = ctx.userClaims?.id ?? ctx.userClaims?.sub;
      if (!actorId) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401, headers: corsHeaders });

      const body = await req.json();
      const { data, error } = await ctx.supabaseAdmin.rpc('create_order', {
        p_items: Array.isArray(body.items) ? body.items : [],
        p_customer_name: String(body.customer_name || ''),
        p_customer_phone: String(body.customer_phone || ''),
        p_address: String(body.address || ''),
        p_latitude: body.latitude ?? null,
        p_longitude: body.longitude ?? null,
        p_payment_method: String(body.payment_method || 'CASH'),
        p_actor_id: actorId,
      });
      if (error) throw error;
      return Response.json({ data }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({ error: error?.message || 'CREATE_ORDER_FAILED' }, { status: 400, headers: corsHeaders });
    }
  }),
};
