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
        .select('role')
        .eq('id', callerId)
        .single();

      if (callerError || !caller || !['driver','admin','distributor'].includes(caller.role)) {
        return Response.json({ error: 'NOT_AUTHORIZED' }, { status: 403, headers: corsHeaders });
      }

      const body = await req.json();
      const orderId = body.order_id;
      const action = body.action;
      const items = Array.isArray(body.items) ? body.items : [];
      const newItems = Array.isArray(body.newItems) ? body.newItems : [];
      const note = String(body.note || '');

      if (!orderId || !['return','exchange'].includes(action) || items.length === 0) {
        return Response.json({ error: 'INVALID_REQUEST' }, { status: 400, headers: corsHeaders });
      }

      const { data: order, error: orderError } = await ctx.supabaseAdmin
        .from('orders')
        .select('id,status,driver_id,customer_id')
        .eq('id', orderId)
        .single();
      if (orderError) throw orderError;
      if (order.status !== 'DELIVERED') throw new Error('ORDER_MUST_BE_DELIVERED');
      if (caller.role === 'driver' && order.driver_id !== callerId) throw new Error('NOT_ASSIGNED_TO_DRIVER');

      const { data: existingItems, error: itemError } = await ctx.supabaseAdmin
        .from('order_items')
        .select('id,product_id,quantity,returned_quantity')
        .eq('order_id', orderId);
      if (itemError) throw itemError;

      for (const item of items) {
        const qty = Number(item.quantity);
        const current = existingItems.find((x) => x.product_id === item.product_id);
        if (!current || qty <= 0 || (current.returned_quantity || 0) + qty > current.quantity) {
          throw new Error('INVALID_RETURN_QUANTITY');
        }

        const { error: itemUpdateError } = await ctx.supabaseAdmin
          .from('order_items')
          .update({ returned_quantity: (current.returned_quantity || 0) + qty })
          .eq('id', current.id);
        if (itemUpdateError) throw itemUpdateError;

        const { data: newStock, error: stockError } = await ctx.supabaseAdmin.rpc('adjust_product_stock', {
          p_product_id: current.product_id,
          p_delta: qty,
        });
        if (stockError || newStock === null) throw new Error('STOCK_UPDATE_FAILED');

        const { error: txError } = await ctx.supabaseAdmin
          .from('cylinder_transactions')
          .insert({
            product_id: current.product_id,
            transaction_type: action === 'exchange' ? 'EXCHANGE' : 'RETURN',
            quantity: qty,
            order_id: orderId,
            performed_by: callerId,
            notes: note || null,
          });
        if (txError) throw txError;
      }

      if (action === 'exchange') {
        if (newItems.length === 0) throw new Error('EXCHANGE_ITEM_REQUIRED');

        for (const item of newItems) {
          const qty = Number(item.quantity);
          if (!item.product_id || qty <= 0) throw new Error('INVALID_EXCHANGE_ITEM');

          const { data: newStock, error: stockError } = await ctx.supabaseAdmin.rpc('adjust_product_stock', {
            p_product_id: item.product_id,
            p_delta: -qty,
          });
          if (stockError || newStock === null) throw new Error('EXCHANGE_OUT_OF_STOCK');

          const { data: product } = await ctx.supabaseAdmin
            .from('products')
            .select('sold_stock')
            .eq('id', item.product_id)
            .single();

          const { error: soldError } = await ctx.supabaseAdmin
            .from('products')
            .update({ sold_stock: Number(product?.sold_stock || 0) + qty })
            .eq('id', item.product_id);
          if (soldError) throw soldError;

          const { error: txError } = await ctx.supabaseAdmin
            .from('cylinder_transactions')
            .insert({
              product_id: item.product_id,
              transaction_type: 'EXCHANGE',
              quantity: qty,
              order_id: orderId,
              performed_by: callerId,
              notes: note || null,
            });
          if (txError) throw txError;
        }
      }

      const { error: historyError } = await ctx.supabaseAdmin
        .from('order_history')
        .insert({
          order_id: orderId,
          from_status: 'DELIVERED',
          to_status: 'DELIVERED',
          changed_by: callerId,
          note: action === 'return' ? `مرتجع: ${note}` : `استبدال: ${note}`,
        });
      if (historyError) throw historyError;

      return Response.json({ ok: true }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({ error: error?.message || 'RETURN_EXCHANGE_FAILED' }, { status: 400, headers: corsHeaders });
    }
  }),
};
