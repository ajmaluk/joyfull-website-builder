import { supabase } from "@/lib/supabase";

export type ActivityType = 'PROJECT_CREATED' | 'MESSAGE_SENT';

export async function logActivity(userId: string, type: ActivityType) {
  try {
    const { error } = await supabase
      .from('Activity')
      .insert({
        userId,
        type,
      });

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Activity logging error:', error);
  }
}
