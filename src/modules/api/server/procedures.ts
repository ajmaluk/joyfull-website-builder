import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generateSlug } from "random-word-slugs";

import { supabase } from "@/lib/supabase";
import { getFeatures } from "@/lib/usage";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const apiRouter = createTRPCRouter({
  getKeys: protectedProcedure.query(async ({ ctx }) => {
    const { hasApiAccess } = await getFeatures();
    if (!hasApiAccess) {
      throw new TRPCError({ code: "FORBIDDEN", message: "API access is only available on Pro and Enterprise plans" });
    }

    const { data: keys, error } = await supabase
      .from('ApiKey')
      .select('*')
      .eq('userId', ctx.auth.userId)
      .order('createdAt', { ascending: false });

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch API keys" });
    }

    return keys;
  }),

  createKey: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
    }))
    .mutation(async ({ input, ctx }) => {
      const { hasApiAccess } = await getFeatures();
      if (!hasApiAccess) {
        throw new TRPCError({ code: "FORBIDDEN", message: "API access is only available on Pro and Enterprise plans" });
      }

      const key = `vibe_${generateSlug(4, { format: "kebab" })}_${Math.random().toString(36).substring(2, 15)}`;

      const { data: createdKey, error } = await supabase
        .from('ApiKey')
        .insert({
          userId: ctx.auth.userId,
          name: input.name,
          key: key,
        })
        .select()
        .single();

      if (error || !createdKey) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create API key" });
      }

      return createdKey;
    }),

  deleteKey: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await supabase
        .from('ApiKey')
        .delete()
        .eq('id', input.id)
        .eq('userId', ctx.auth.userId);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete API key" });
      }

      return { success: true };
    }),
});
