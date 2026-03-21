import { useState, useEffect } from "react";
import { X, Check, XCircle, Bell, UserPlus, Shield, UserMinus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  acceptInvite,
  declineInvite,
  type Notification,
  type NotificationType,
} from "@/lib/notifications";

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  onActionComplete?: () => void;
}

const NOTIF_CONFIG: Record<NotificationType, { icon: typeof Bell; color: string; label: string }> = {
  invite: { icon: UserPlus, color: "text-accent", label: "Project Invite" },
  invite_accepted: { icon: Check, color: "text-green-400", label: "Invite Accepted" },
  invite_declined: { icon: XCircle, color: "text-red-400", label: "Invite Declined" },
  role_changed: { icon: Shield, color: "text-blue-400", label: "Role Changed" },
  removed: { icon: UserMinus, color: "text-red-400", label: "Removed from Project" },
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getNotifMessage(notif: Notification): string {
  const from = notif.from_user_name ?? "Someone";
  const project = notif.project_name;

  switch (notif.type) {
    case "invite":
      return `${from} invited you to join "${project}"`;
    case "invite_accepted":
      return `${from} accepted your invite to "${project}"`;
    case "invite_declined": {
      const reason = (notif.metadata?.reason as string);
      if (reason === "expired") return `Your invite to ${from} for "${project}" expired — no response in 7 days`;
      return `${from} declined your invite to "${project}"`;
    }
    case "role_changed": {
      const newRole = (notif.metadata?.new_role as string) ?? "unknown";
      return `Your role in "${project}" was changed to ${newRole}`;
    }
    case "removed": {
      const reason = (notif.metadata?.reason as string);
      if (reason === "project_deleted") return (notif.metadata?.message as string) ?? `"${project}" was deleted`;
      return `You were removed from "${project}"`;
    }
    default:
      return `Notification about "${project}"`;
  }
}

export function NotificationsPanel({ open, onClose, onActionComplete }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const notifs = await getNotifications();
      setNotifications(notifs);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (notif: Notification) => {
    setActioning(notif.id);
    try {
      await acceptInvite(notif.id, notif.project_id, notif.project_name, notif.from_user_id);
      await loadNotifications();
      onActionComplete?.();
    } finally {
      setActioning(null);
    }
  };

  const handleDecline = async (notif: Notification) => {
    setActioning(notif.id);
    try {
      await declineInvite(notif.id, notif.project_id, notif.project_name, notif.from_user_id);
      await loadNotifications();
      onActionComplete?.();
    } finally {
      setActioning(null);
    }
  };

  const handleMarkRead = async (notif: Notification) => {
    await markAsRead(notif.id);
    setNotifications(notifications.map((n) => n.id === notif.id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    onClose();
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
    onClose();
  };

  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md mt-16 mr-6 animate-fade-in">
        <div className="rounded-2xl border border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#888]" />
              <span className="text-sm font-display tracking-[0.1em] text-white">NOTIFICATIONS</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-[#666] hover:text-white transition-colors cursor-none"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-[#555] hover:text-red-400 transition-colors cursor-none"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <span className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-[#333] mx-auto mb-3" />
                <p className="text-sm text-[#555]">No notifications</p>
              </div>
            ) : (
              <ul>
                {notifications.map((notif) => {
                  const config = NOTIF_CONFIG[notif.type];
                  const Icon = config.icon;
                  const isInvite = notif.type === "invite" && !notif.read;
                  const isActioning = actioning === notif.id;

                  return (
                    <li
                      key={notif.id}
                      className={cn(
                        "px-5 py-4 border-b border-[#1a1a1a] transition-colors",
                        !notif.read && "bg-white/[0.02]"
                      )}
                      onClick={() => !notif.read && !isInvite && handleMarkRead(notif)}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={cn("mt-0.5 shrink-0", config.color)}>
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "text-sm leading-snug",
                              notif.read ? "text-[#888]" : "text-[#ccc]"
                            )}>
                              {getNotifMessage(notif)}
                            </p>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                            )}
                          </div>

                          <p className="text-[10px] text-[#555] mt-1">{formatTime(notif.created_at)}</p>

                          {/* Accept/Decline buttons for invites */}
                          {isInvite && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAccept(notif); }}
                                disabled={isActioning}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 cursor-none"
                              >
                                <Check className="w-3 h-3" />
                                Accept
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDecline(notif); }}
                                disabled={isActioning}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] text-[#ccc] text-xs font-medium rounded-lg hover:bg-[#222] transition-colors disabled:opacity-50 cursor-none"
                              >
                                <X className="w-3 h-3" />
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
