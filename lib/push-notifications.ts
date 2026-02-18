import webpush from 'web-push';
import { getSupabaseClient } from '@/lib/supabase';

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
};

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  vapidConfigured = true;
}

function toWebPushSubscription(row: PushSubscriptionRow) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

export function formatTransactionNotificationBody(input: {
  cardLast4: string | null;
  amountEgp: number;
  merchant: string;
  category: string;
}) {
  const formattedAmount = new Intl.NumberFormat('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(input.amountEgp) ? input.amountEgp : 0);

  const cardLast4 = input.cardLast4?.trim() ? input.cardLast4.trim() : '0000';
  const merchant = input.merchant?.trim() ? input.merchant.trim() : 'Unknown Merchant';
  const category = input.category?.trim() ? input.category.trim() : 'Other';

  return `card ${cardLast4} spent ${formattedAmount} EGP to ${merchant} under ${category}`;
}

export async function sendWebPushToAllDevices(payload: PushPayload): Promise<void> {
  configureVapid();
  if (!vapidConfigured) return;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth');

  if (error) {
    console.error('Failed to load push subscriptions:', error);
    return;
  }

  const rows = (data as PushSubscriptionRow[] | null) ?? [];
  if (rows.length === 0) return;

  const serializedPayload = JSON.stringify(payload);

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(row), serializedPayload);
      } catch (error: any) {
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
          return;
        }
        console.error('Failed sending push notification:', error);
      }
    })
  );
}
