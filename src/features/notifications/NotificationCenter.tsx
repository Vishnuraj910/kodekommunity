import { Bell, CheckCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";

export type NotificationDestination = {
  page: "feed" | "groups" | "broadcasts" | "events" | "messages" | "admin";
  conversationId?: string;
};

export type AppNotification = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  destination: NotificationDestination;
};

type NotificationCenterProps = {
  notifications: AppNotification[];
  toasts: AppNotification[];
  onClear: (notificationId: string) => void;
  onClearAll: () => void;
  onDismissToast: (notificationId: string) => void;
  onOpen: (notification: AppNotification) => void;
};

function Toast({
  notification,
  onDismiss,
}: {
  notification: AppNotification;
  onDismiss: (notificationId: string) => void;
}): React.JSX.Element {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setClosing(true), 6_000);
    return () => window.clearTimeout(timeout);
  }, [notification.id]);

  useEffect(() => {
    if (!closing) return;
    const timeout = window.setTimeout(() => onDismiss(notification.id), 180);
    return () => window.clearTimeout(timeout);
  }, [closing, notification.id, onDismiss]);

  return (
    <article
      className="notification-toast"
      data-state={closing ? "closed" : "open"}
      data-slot="toast"
      role="status"
    >
      <Bell aria-hidden="true" size={18} />
      <div>
        <strong>{notification.title}</strong>
        <p>{notification.description}</p>
      </div>
      <button
        aria-label="Dismiss notification"
        data-slot="toast-close"
        onClick={() => setClosing(true)}
        type="button"
      >
        <X size={16} />
      </button>
    </article>
  );
}

export function NotificationCenter({
  notifications,
  toasts,
  onClear,
  onClearAll,
  onDismissToast,
  onOpen,
}: NotificationCenterProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [clearingIds, setClearingIds] = useState<Set<string>>(() => new Set());
  const clearAllPending = useRef(false);
  const triggerLabel = notifications.length
    ? `Notifications (${notifications.length} unread)`
    : "Notifications";

  useEffect(() => {
    if (!clearingIds.size) return;
    const timeout = window.setTimeout(() => {
      setClearingIds(new Set());
      if (clearAllPending.current) {
        clearAllPending.current = false;
        onClearAll();
        return;
      }
      for (const notificationId of clearingIds) {
        onClear(notificationId);
      }
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [clearingIds, onClear, onClearAll]);

  return (
    <>
      <div className="notification-center">
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <button
              aria-controls="notification-list"
              aria-label={triggerLabel}
              className="notification-trigger"
              data-slot="popover-trigger"
              type="button"
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span aria-hidden="true">{notifications.length}</span>
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent
            aria-label="Notification list"
            className="notification-popover"
            id="notification-list"
            role="region"
          >
            <header>
              <div>
                <small>Inbox</small>
                <h2>Notifications</h2>
              </div>
              <button
                aria-label="Clear all notifications"
                disabled={!notifications.length}
                onClick={() => {
                  clearAllPending.current = true;
                  setClearingIds(
                    new Set(notifications.map((notification) => notification.id)),
                  );
                }}
                type="button"
              >
                <CheckCheck size={16} />
                Clear all
              </button>
            </header>

            {!notifications.length ? (
              <p className="notification-empty">You’re all caught up.</p>
            ) : (
              <ol>
                {notifications.map((notification) => (
                  <li
                    data-state={
                      clearingIds.has(notification.id) ? "removing" : "idle"
                    }
                    key={notification.id}
                  >
                    <button
                      aria-label={`Open notification: ${notification.title}`}
                      className="notification-open"
                      onClick={() => {
                        onOpen(notification);
                        setOpen(false);
                      }}
                      type="button"
                    >
                      <strong>{notification.title}</strong>
                      <span>{notification.description}</span>
                      <time dateTime={notification.createdAt}>
                        {new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(notification.createdAt))}
                      </time>
                    </button>
                    <button
                      aria-label={`Clear notification: ${notification.title}`}
                      className="notification-clear"
                      onClick={() =>
                        setClearingIds((current) => {
                          const next = new Set(current);
                          next.add(notification.id);
                          return next;
                        })
                      }
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div
        aria-atomic="false"
        aria-live="polite"
        className="notification-toast-viewport"
        data-slot="toast-viewport"
      >
        {toasts.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onDismiss={onDismissToast}
          />
        ))}
      </div>
    </>
  );
}
