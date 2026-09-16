import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { all = false } = body;

    // ── Mark all unread notifications as read ──
    if (all) {
      const unread = await base44.asServiceRole.entities.Notification.filter({
        user_id: user.id,
        read: false,
      });
      for (const n of unread) {
        try {
          await base44.asServiceRole.entities.Notification.update(n.id, { read: true });
        } catch {}
      }
      return Response.json({ success: true, count: unread.length });
    }

    // ── Mark specific notifications as read (ownership verified) ──
    const { notification_ids } = body;
    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return Response.json({ error: "Missing notification_ids" }, { status: 400 });
    }

    let updated = 0;
    for (const id of notification_ids) {
      try {
        const notif = await base44.asServiceRole.entities.Notification.get(id);
        // Ownership check — only the notification owner can mark it as read
        if (notif.user_id === user.id) {
          await base44.asServiceRole.entities.Notification.update(id, { read: true });
          updated++;
        }
      } catch {}
    }

    return Response.json({ success: true, count: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}