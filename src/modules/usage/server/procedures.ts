import { getUsageStatus } from "@/lib/usage";
import { supabase } from "@/lib/supabase";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const usageRouter = createTRPCRouter({
  status: protectedProcedure.query(async () => {
    try {
      const result = await getUsageStatus();

      return result;
    } catch {
      return null;
    }
  }),
  activity: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await supabase
      .from('Activity')
      .select('createdAt')
      .eq('userId', ctx.auth.userId)
      .order('createdAt', { ascending: true });

    if (error) return [];

    return data.map((a) => a.createdAt);
  }),
});
