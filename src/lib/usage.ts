import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { 
  PRO_PLAN_ID, 
  ENTERPRISE_PLAN_ID, 
  PLAN_POINTS, 
  DURATION_DAYS, 
  GENERATION_COST 
} from "./constants";

export async function getUsageTracker() {
  const { userId, has } = await auth();
  if (!userId) throw new Error("User not authenticated");

  // Check by Plan ID (Production-ready)
  if (has({ plan: ENTERPRISE_PLAN_ID })) {
    return { userId, maxPoints: PLAN_POINTS[ENTERPRISE_PLAN_ID] };
  }
  
  if (has({ plan: PRO_PLAN_ID })) {
    return { userId, maxPoints: PLAN_POINTS[PRO_PLAN_ID] };
  }

  return { userId, maxPoints: PLAN_POINTS.free };
}

export async function getFeatures() {
  const { userId, has } = await auth();
  if (!userId) return {
    hasAdvancedAI: false,
    hasApiAccess: false,
    hasTeamCollaboration: false,
    hasCustomTemplates: false,
  };

  const isEnterprise = has({ plan: ENTERPRISE_PLAN_ID });
  const isPro = has({ plan: PRO_PLAN_ID });

  return {
    hasAdvancedAI: isPro || isEnterprise,
    hasApiAccess: isPro || isEnterprise,
    hasTeamCollaboration: isPro || isEnterprise,
    hasCustomTemplates: isPro || isEnterprise,
    isEnterprise,
    isPro,
  };
}

export async function consumeCredits() {
  const { userId, maxPoints } = await getUsageTracker();

  // Call the atomic RPC function
  const { data, error } = await supabase.rpc('consume_credits', {
    user_id: userId,
    cost: GENERATION_COST,
    max_points: maxPoints,
    expire_days: DURATION_DAYS,
  });

  if (error) {
    console.error('Supabase RPC error:', error);
    if (error.message.includes("OUT_OF_CREDITS")) {
      throw new Error("You have run out of credits");
    }
    if (error.message.includes("function") && error.message.includes("does not exist")) {
      throw new Error("Database not initialized. Please run the SQL initialization script in Supabase SQL Editor.");
    }
    throw new Error(`Failed to consume credits: ${error.message}`);
  }

  return data;
}

export async function getUsageStatus() {
  const { userId, maxPoints } = await getUsageTracker();
  const features = await getFeatures();

  const { data: usage, error } = await supabase
    .from('Usage')
    .select('*')
    .eq('key', userId)
    .single();

  const common = {
    remainingPoints: maxPoints,
    msBeforeNext: 0,
    consumedPoints: 0,
    isPro: features.isPro,
    isEnterprise: features.isEnterprise,
  };

  if (error || !usage) {
    return common;
  }

  const now = new Date();
  const expireDate = new Date(usage.expire);

  if (expireDate < now) {
    return common;
  }

  return {
    ...common,
    remainingPoints: maxPoints - usage.points,
    msBeforeNext: expireDate.getTime() - now.getTime(),
    consumedPoints: usage.points,
  };
}
