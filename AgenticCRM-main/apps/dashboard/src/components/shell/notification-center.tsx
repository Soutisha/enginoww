'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import api from '@/lib/api-client';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

type NotificationResponse = { items: NotificationItem[]; unreadCount: number };

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: NotificationResponse }>('/notifications?limit=30').then((r) => r.data.data),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-dim transition-colors hover:bg-raised hover:text-ink"
      >
        <Bell size={18} aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Notifications</h2>
              <p className="mt-0.5 text-[11px] text-ink-faint">{unreadCount} unread</p>
            </div>
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={unreadCount === 0 || markAllRead.isPending}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-signal hover:bg-signal/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          </div>

          <div className="max-h-[min(26rem,70vh)] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Bell size={22} className="mx-auto mb-2 text-ink-faint" />
                <p className="text-sm font-medium text-ink">You're all caught up</p>
                <p className="mt-1 text-xs text-ink-faint">New alerts will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((item) => {
                  const content = (
                    <>
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? 'bg-transparent' : 'bg-signal'}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-ink">{item.title}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-ink-dim">{item.body}</span>
                        <span className="mt-1.5 block text-[10px] text-ink-faint">{new Date(item.createdAt).toLocaleString()}</span>
                      </span>
                      {item.link && <ExternalLink size={13} className="mt-1 shrink-0 text-ink-faint" aria-hidden />}
                    </>
                  );

                  return (
                    <li key={item.id}>
                      {item.link ? (
                        <Link
                          href={item.link}
                          onClick={() => {
                            if (!item.read) markRead.mutate(item.id);
                            setOpen(false);
                          }}
                          className={`flex gap-3 px-4 py-3 transition-colors hover:bg-raised ${item.read ? '' : 'bg-signal/[0.035]'}`}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => !item.read && markRead.mutate(item.id)}
                          className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-raised ${item.read ? '' : 'bg-signal/[0.035]'}`}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-line px-4 py-2 text-center">
            <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-ink-faint hover:text-ink">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
