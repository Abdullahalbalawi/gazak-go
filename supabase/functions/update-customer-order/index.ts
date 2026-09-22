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
      const { data, error } = await ctx.supabaseAdmin.rpc('update_customer_order_details', {
        p_order_id: body.order_id,
        p_delivery_address: body.address === undefined ? null : { address: body.address },
        p_latitude: body.latitude ?? null,
        p_longitude: body.longitude ?? null,
        p_requested_delivery_at: body.requested_delivery_at ?? null,
        p_notes: body.notes ?? null,
        p_actor_id: actorId,
      });
      if (error) throw error;
      return Response.json({ data }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({ error: error?.message || 'UPDATE_ORDER_DETAILS_FAILED' }, { status: 400, headers: corsHeaders });
    }
  }),
};
