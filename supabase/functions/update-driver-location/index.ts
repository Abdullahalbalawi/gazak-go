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
      if (callerError || caller?.role !== 'driver' || !caller?.is_active) {
        return Response.json({ error: 'DRIVER_REQUIRED' }, { status: 403, headers: corsHeaders });
      }

      const body = await req.json();
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return Response.json({ error: 'INVALID_LOCATION' }, { status: 400, headers: corsHeaders });
      }

      const { data, error } = await ctx.supabaseAdmin.rpc('update_driver_location', {
        p_driver_id: actorId,
        p_latitude: latitude,
        p_longitude: longitude,
        p_accuracy_m: body.accuracy_m == null ? null : Number(body.accuracy_m),
        p_heading: body.heading == null ? null : Number(body.heading),
        p_speed_kmh: body.speed_kmh == null ? null : Number(body.speed_kmh),
        p_actor_id: actorId,
      });
      if (error) throw error;
      return Response.json({ data }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({ error: error?.message || 'UPDATE_DRIVER_LOCATION_FAILED' }, { status: 400, headers: corsHeaders });
    }
  }),
};
