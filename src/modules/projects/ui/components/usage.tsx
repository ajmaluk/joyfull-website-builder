import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { CrownIcon } from "lucide-react";
import { format, formatDuration, intervalToDuration } from "date-fns";

import { PRO_PLAN_ID, ENTERPRISE_PLAN_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface Props {
  points: number;
  msBeforeNext: number;
};

export const Usage = ({ points, msBeforeNext }: Props) => {
  const { has } = useAuth();
  const hasProAccess = has?.({ plan: PRO_PLAN_ID }) || has?.({ plan: ENTERPRISE_PLAN_ID }) || has?.({ plan: "pro" }) || has?.({ plan: "enterprise" });

  const resetTime = useMemo(() => {
    try {
      if (msBeforeNext <= 0) return "soon";

      return formatDuration(
        intervalToDuration({
          start: new Date(),
          end: new Date(Date.now() + msBeforeNext),
        }),
        { format: ["months", "days", "hours"] }
      )
    } catch (error) {
      console.error("Error formatting duration ", error);
      return "unknown";
    }
  }, [msBeforeNext]);

  const resetDate = useMemo(() => {
    if (msBeforeNext <= 0) return null;
    return format(new Date(Date.now() + msBeforeNext), "MMM d, yyyy");
  }, [msBeforeNext]);

  return (
    <div className="rounded-t-xl bg-background border border-b-0 p-2.5">
      <div className="flex items-center gap-x-2 w-full">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">
              {points} {hasProAccess ? "": "free"} credits remaining
            </p>
            {resetDate && (
              <p className="text-[10px] text-muted-foreground">
                Next reset: {resetDate}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Resets in{" "}{resetTime}
          </p>
        </div>
        {!hasProAccess && (
          <Button
            asChild
            size="sm"
            variant="tertiary"
            className="ml-auto"
          >
            <Link href="/pricing">
              <CrownIcon /> Upgrade
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};
