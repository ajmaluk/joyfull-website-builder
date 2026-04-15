import { z } from "zod";
import { generateSlug } from "random-word-slugs";

import { supabase } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";
import { inngest } from "@/inngest/client";
import { consumeCredits } from "@/lib/usage";
import { logActivity } from "@/lib/activity";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";

export const projectsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(z.object({
      id: z.string().min(1, { message: "Id is required" }),
    }))
    .query(async ({ input, ctx }) => {
      const { data: existingProject, error } = await supabase
        .from('Project')
        .select('*')
        .eq('id', input.id)
        .eq('userId', ctx.auth.userId)
        .single();

      if (error || !existingProject) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      return existingProject;
    }),
  getMany: protectedProcedure
    .query(async ({ ctx }) => {
      const { data: projects, error } = await supabase
        .from('Project')
        .select('*')
        .eq('userId', ctx.auth.userId)
        .order('updatedAt', { ascending: false });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch projects" });
      }

      return projects;
    }),
  create: protectedProcedure
    .input(
      z.object({
        value: z.string()
          .min(1, { message: "Value is required" })
          .max(10000, { message: "Value is too long" })
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await consumeCredits();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Something went wrong";
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message,
        });
      }

      // 1. Create the project
      const { data: createdProject, error: projectError } = await supabase
        .from('Project')
        .insert({
          userId: ctx.auth.userId,
          name: generateSlug(2, {
            format: "kebab",
          }),
        })
        .select()
        .single();

      if (projectError || !createdProject) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create project" });
      }

      // Log activity
      await logActivity(ctx.auth.userId, 'PROJECT_CREATED');

      // 2. Create the initial message
      const { error: messageError } = await supabase
        .from('Message')
        .insert({
          projectId: createdProject.id,
          content: input.value,
          role: "USER",
          type: "RESULT",
        });

      if (messageError) {
        // Optional: delete the project if message creation fails
        await supabase.from('Project').delete().eq('id', createdProject.id);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create initial message" });
      }

      await inngest.send({
        name: "code-agent/run",
        data: {
          value: input.value,
          projectId: createdProject.id,
          userId: ctx.auth.userId,
        },
      });

      return createdProject;
    }),
});
