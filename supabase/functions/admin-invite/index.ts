import { withSupabase } from 'npm:@supabase/server@^1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
      const callerId = ctx.userClaims?.id ?? ctx.userClaims?.sub;
      const { data: caller, error: callerError } = await ctx.supabase
        .from('profiles')
        .select('role,is_active')
        .eq('id', callerId)
        .single();

      if (callerError || caller?.role !== 'admin' || !caller?.is_active) {
        return Response.json({ error: 'ADMIN_REQUIRED' }, { status: 403, headers: corsHeaders });
      }

      const body = await req.json();
      const email = String(body.email || '').trim().toLowerCase();
      const role = String(body.role || 'customer');

      if (!email) return Response.json({ error: 'EMAIL_REQUIRED' }, { status: 400, headers: corsHeaders });
      if (!['customer','distributor','driver','admin'].includes(role)) {
        return Response.json({ error: 'INVALID_ROLE' }, { status: 400, headers: corsHeaders });
      }

      const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: body.redirectTo || undefined,
      });
      if (error) throw error;

      if (data.user?.id) {
        const { data: profile, error: profileError } = await ctx.supabaseAdmin
          .from('profiles')
          .update({ role })
          .eq('id', data.user.id)
          .select('id,role')
          .single();
        if (profileError) throw profileError;
        if (profile?.role !== role) throw new Error('ROLE_ASSIGNMENT_FAILED');
      }

      return Response.json({ user: data.user, role }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({ error: error?.message || 'INVITE_FAILED' }, { status: 400, headers: corsHeaders });
    }
  }),
};
