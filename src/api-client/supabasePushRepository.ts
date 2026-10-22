/**
 * `PushRepository` sobre PostgREST (issue #88, DEC-080). El registro y el reemplazo pasan por
 * funciones de la base (`register_push_subscription`, `replace_push_reminders`), que validan
 * dueño, cantidad y ventana: el cliente no tiene INSERT ni UPDATE directo en esas tablas.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../domain/database.types.ts';
import type { PushReminderItem } from '../domain/calendar.ts';
import type { PushRepository, PushSubscriptionInfo } from '../domain/ports.ts';
import { run } from './postgrest.ts';

type Db = SupabaseClient<Database>;

export class SupabasePushRepository implements PushRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async register(s: PushSubscriptionInfo): Promise<void> {
    await run(this.db.rpc('register_push_subscription', {
      p_endpoint: s.endpoint, p_p256dh: s.p256dh, p_auth: s.auth,
      ...(s.userAgent ? { p_user_agent: s.userAgent.slice(0, 300) } : {}),
    }));
  }

  async replaceReminders(endpoint: string, items: readonly PushReminderItem[]): Promise<void> {
    await run(this.db.rpc('replace_push_reminders', {
      p_endpoint: endpoint,
      p_items: items.map(i => ({ send_at: i.sendAt, title: i.title, body: i.body, url: i.url })),
    }));
  }

  async unregister(endpoint: string): Promise<void> {
    await run(this.db.from('push_subscriptions').delete().eq('endpoint', endpoint));
  }
}
