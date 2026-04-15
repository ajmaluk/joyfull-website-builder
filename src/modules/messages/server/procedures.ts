import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { supabase } from "@/lib/supabase";
import { inngest } from "@/inngest/client";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { consumeCredits } from "@/lib/usage";
import { logActivity } from "@/lib/activity";

export const messagesRouter = createTRPCRouter({
  getMany: protectedProcedure
  .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ input, ctx }) => {
      // We check project ownership manually since Supabase RLS is not configured here (using service role)
      const { data: project, error: projectError } = await supabase
        .from('Project')
        .select('id')
        .eq('id', input.projectId)
        .eq('userId', ctx.auth.userId)
        .single();

      if (projectError || !project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found or access denied" });
      }

      const { data: messages, error } = await supabase
        .from('Message')
        .select('*, Fragment(*)')
        .eq('projectId', input.projectId)
        .order('createdAt', { ascending: true });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch messages" });
      }

      // Map Supabase join result to expected structure
      return messages.map((m) => {
        const fragment = Array.isArray(m.Fragment) ? m.Fragment[0] : (m.Fragment || null);
        return {
          ...m,
          fragment,
        };
      });
    }),
  create: protectedProcedure
    .input(
      z.object({
        value: z.string()
          .min(1, { message: "Value is required" })
          .max(10000, { message: "Value is too long" }),
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { data: existingProject, error: projectError } = await supabase
        .from('Project')
        .select('*')
        .eq('id', input.projectId)
        .eq('userId', ctx.auth.userId)
        .single();

      if (projectError || !existingProject) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      try {
        await consumeCredits();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Something went wrong";
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message,
        });
      }

      const { data: createdMessage, error: messageError } = await supabase
        .from('Message')
        .insert({
          projectId: existingProject.id,
          content: input.value,
          role: "USER",
          type: "RESULT",
        })
        .select()
        .single();

      if (messageError || !createdMessage) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create message" });
      }

      // Log activity
      await logActivity(ctx.auth.userId, 'MESSAGE_SENT');

      await inngest.send({
        name: "code-agent/run",
        data: {
          value: input.value,
          projectId: input.projectId,
          userId: ctx.auth.userId,
        },
      });

      return createdMessage;
    }),
});
