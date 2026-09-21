import { withSupabase } from 'npm:@supabase/server@^1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      const actorId = ctx.userClaims?.sub;
      if (!actorId) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401, headers: corsHeaders });

      const { data: caller, error: callerError } = await ctx.supabase
        .from('profiles').select('role,is_active').eq('id', actorId).single();
      if (callerError || caller?.role !== 'admin' || !caller?.is_active) {
        return Response.json({ error: 'ADMIN_REQUIRED' }, { status: 403, headers: corsHeaders });
      }

      const body = await req.json();
      const action = String(body.action || '');
      if (!['restock','adjust','transfer_driver','transfer_distributor'].includes(action)) {
        return Response.json({ error: 'UNKNOWN_INVENTORY_ACTION' }, { status: 400, headers: corsHeaders });
      }

      const { data, error } = await ctx.supabaseAdmin.rpc('manage_inventory', {
        p_action: action,
        p_product_id: body.product_id,
        p_quantity: Number(body.quantity),
        p_notes: body.notes || null,
        p_target_party_id: body.target_party_id || body.user_id || null,
        p_target_party_type: body.target_party_type || null,
        p_actor_id: actorId,
      });
      if (error) throw error;
      return Response.json({ data }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({ error: error?.message || 'MANAGE_INVENTORY_FAILED' }, { status: 400, headers: corsHeaders });
    }
  }),
};
