import type { Json } from './database';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  data: Record<string, Json | undefined>;
  is_read: boolean;
  created_at: string;
}
