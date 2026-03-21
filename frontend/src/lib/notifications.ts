import { supabase } from "./supabase";

export type NotificationType =
  | "invite"
  | "invite_accepted"
  | "invite_declined"
  | "role_changed"
  | "removed";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  project_id: string;
  project_name: string;
  from_user_id: string | null;
  from_user_name: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

/** Get all notifications for the current user, newest first */
export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Notification[];
}

/** Get unread notification count */
export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("read", false);

  if (error) throw error;
  return count ?? 0;
}

/** Mark a notification as read */
export async function markAsRead(notificationId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);
}

/** Mark all notifications as read */
export async function markAllAsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
}

/** Delete a notification */
export async function deleteNotification(notificationId: string): Promise<void> {
  await supabase.from("notifications").delete().eq("id", notificationId);
}

/** Clear all notifications for the current user */
export async function clearAllNotifications(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").delete().eq("user_id", user.id);
}

/** Create a notification for a user */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  projectId: string;
  projectName: string;
  fromUserId?: string;
  fromUserName?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await supabase.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    project_id: params.projectId,
    project_name: params.projectName,
    from_user_id: params.fromUserId ?? null,
    from_user_name: params.fromUserName ?? null,
    metadata: params.metadata ?? {},
  });
}

/** Check for expired invites (7 days) and clean them up */
export async function cleanupExpiredInvites(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find pending members older than 7 days
  const { data: expired } = await supabase
    .from("project_members")
    .select("id, project_id, user_id, email")
    .eq("status", "pending")
    .lt("created_at", sevenDaysAgo);

  if (!expired || expired.length === 0) return;

  for (const member of expired) {
    // Get project info for notification
    const { data: project } = await supabase
      .from("projects")
      .select("name, owner_id")
      .eq("id", member.project_id)
      .single();

    if (project) {
      // Get the expired member's name
      let memberName = member.email;
      if (member.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", member.user_id)
          .single();
        if (profile) memberName = profile.full_name;
      }

      // Notify project owner that invite expired
      await createNotification({
        userId: project.owner_id,
        type: "invite_declined",
        projectId: member.project_id,
        projectName: project.name,
        fromUserName: memberName,
        metadata: { reason: "expired", message: `Invite expired — no response in 7 days` },
      });
    }

    // Remove the expired member
    await supabase.from("project_members").delete().eq("id", member.id);
  }
}

/** Accept a project invite */
export async function acceptInvite(
  notificationId: string,
  projectId: string,
  projectName: string,
  inviterUserId: string | null,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Update membership status to accepted
  await supabase
    .from("project_members")
    .update({ status: "accepted" })
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  // Mark notification as read
  await markAsRead(notificationId);

  // Get current user's name for the response notification
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Notify the inviter
  if (inviterUserId) {
    await createNotification({
      userId: inviterUserId,
      type: "invite_accepted",
      projectId,
      projectName,
      fromUserId: user.id,
      fromUserName: profile?.full_name ?? user.email ?? "Someone",
    });
  }
}

/** Decline a project invite */
export async function declineInvite(
  notificationId: string,
  projectId: string,
  projectName: string,
  inviterUserId: string | null,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Update membership status to declined
  await supabase
    .from("project_members")
    .update({ status: "declined" })
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  // Mark notification as read
  await markAsRead(notificationId);

  // Get current user's name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Notify the inviter
  if (inviterUserId) {
    await createNotification({
      userId: inviterUserId,
      type: "invite_declined",
      projectId,
      projectName,
      fromUserId: user.id,
      fromUserName: profile?.full_name ?? user.email ?? "Someone",
    });
  }
}
