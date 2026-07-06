"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/time-format";
import { notificationHref } from "@/lib/notification-links";
import type { NotificationDto } from "@/lib/queries/employee";
import styles from "@/components/employee/employee.module.css";

type Page = { notifications: NotificationDto[]; nextCursor: string | null; unreadCount: number };

export function NotificationsList({ initial }: { initial: Page }) {
  const [items, setItems] = useState(initial.notifications);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Keep this visit's unread emphasis even after we mark everything read.
  const unreadIds = useRef(new Set(initial.notifications.filter((n) => !n.readAt).map((n) => n.id)));
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current || initial.unreadCount === 0) return;
    marked.current = true;
    fetch("/api/me/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {
      // Non-fatal: the badge clears the next time this screen loads.
    });
  }, [initial.unreadCount]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/me/notifications?cursor=${encodeURIComponent(nextCursor)}&limit=20`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error.message);
      setItems((prev) => [...prev, ...body.data.notifications]);
      setNextCursor(body.data.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (items.length === 0) {
    return <EmptyState title="You're all caught up" description="New notifications will show up here." />;
  }

  return (
    <>
      {items.map((n) => (
        <Link key={n.id} href={notificationHref(n.type)} className={styles.linkReset}>
          <Card hoverable>
            <div className={styles.cardRow}>
              <div>
                <div className={unreadIds.current.has(n.id) ? styles.notifTitleUnread : styles.notifTitle}>
                  {n.title}
                </div>
                <div className={styles.muted}>{n.body}</div>
              </div>
              <div className={styles.notifMeta}>
                {unreadIds.current.has(n.id) && <span className={styles.unreadDot} aria-label="Unread" />}
                <span className={styles.subtle}>{timeAgo(new Date(n.createdAt))}</span>
              </div>
            </div>
          </Card>
        </Link>
      ))}
      {loadError && <div className={styles.muted}>Couldn&apos;t load more notifications. Try again.</div>}
      {nextCursor && (
        <Button variant="secondary" fullWidth onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </>
  );
}
