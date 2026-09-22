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

      const { data: caller, error: callerError } = await ctx.supabase
        .from('profiles').select('role,is_active').eq('id', actorId).single();
      if (callerError || !caller?.is_active) {
        return Response.json({ error: 'PROFILE_NOT_FOUND' }, { status: 403, headers: corsHeaders });
      }

      const body = await req.json();
      const { data, error } = await ctx.supabaseAdmin.rpc('update_order_status', {
        p_order_id: body.order_id,
        p_action: body.action,
        p_extra: body.extra || {},
        p_actor_id: actorId,
      });
      if (error) throw error;
      return Response.json({ data }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({ error: error?.message || 'UPDATE_ORDER_STATUS_FAILED' }, { status: 400, headers: corsHeaders });
    }
  }),
};
