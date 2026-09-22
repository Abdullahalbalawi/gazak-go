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
      if (callerError || caller?.role !== 'admin' || !caller?.is_active) {
        return Response.json({ error: 'ADMIN_REQUIRED' }, { status: 403, headers: corsHeaders });
      }

      const body = await req.json();
      const action = String(body.action || '');
      const userId = body.user_id;
      if (!userId) return Response.json({ error: 'USER_REQUIRED' }, { status: 400, headers: corsHeaders });

      if (action === 'update') {
        const { data, error } = await ctx.supabaseAdmin.rpc('admin_update_user', {
          p_user_id: userId,
          p_full_name: body.full_name ?? null,
          p_phone: body.phone ?? null,
          p_role: body.role ?? null,
          p_is_active: body.is_active ?? null,
          p_actor_id: actorId,
        });
        if (error) throw error;
        return Response.json({ data }, { headers: corsHeaders });
      }

      if (action === 'deactivate') {
        const { data, error } = await ctx.supabaseAdmin.rpc('admin_deactivate_user', {
          p_user_id: userId,
          p_actor_id: actorId,
        });
        if (error) throw error;
        return Response.json({ data }, { headers: corsHeaders });
      }

      if (action === 'delete') {
        if (userId === actorId) {
          return Response.json({ error: 'CANNOT_DELETE_SELF' }, { status: 400, headers: corsHeaders });
        }

        const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) {
          const relatedData = /foreign key|violates|constraint/i.test(error.message || '');
          return Response.json(
            { error: relatedData ? 'USER_HAS_RELATED_DATA' : error.message },
            { status: relatedData ? 409 : 400, headers: corsHeaders },
          );
        }

        return Response.json({ deleted: true, user_id: userId }, { headers: corsHeaders });
      }

      return Response.json({ error: 'UNKNOWN_ADMIN_USER_ACTION' }, { status: 400, headers: corsHeaders });
    } catch (error) {
      return Response.json({ error: error?.message || 'ADMIN_USER_FAILED' }, { status: 400, headers: corsHeaders });
    }
  }),
};
