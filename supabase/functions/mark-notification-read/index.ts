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
      const { data, error } = await ctx.supabaseAdmin.rpc('mark_notification_read', {
        p_notification_id: body.notification_id || null,
        p_all: Boolean(body.all),
        p_actor_id: actorId,
      });
      if (error) throw error;
      return Response.json({ data }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({ error: error?.message || 'MARK_NOTIFICATION_READ_FAILED' }, { status: 400, headers: corsHeaders });
    }
  }),
};
