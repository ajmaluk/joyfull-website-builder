"use client";

import { useMemo } from "react";
import { 
  format, 
  startOfYear, 
  endOfYear, 
  eachDayOfInterval, 
  isSameDay, 
  subYears,
  getDay,
  startOfWeek,
  addDays
} from "date-fns";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";

export const ActivityHeatmap = () => {
  const trpc = useTRPC();
  const { data: activityDates, isLoading } = useQuery(trpc.usage.activity.queryOptions());

  const days = useMemo(() => {
    const end = new Date();
    const start = subYears(end, 1);
    const allDays = eachDayOfInterval({ start, end });
    
    // Group activities by date
    const activityCountByDate: Record<string, number> = {};
    activityDates?.forEach((dateStr: any) => {
      const date = format(new Date(dateStr), "yyyy-MM-dd");
      activityCountByDate[date] = (activityCountByDate[date] || 0) + 1;
    });

    return allDays.map((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const count = activityCountByDate[dateKey] || 0;
      let level = 0;
      if (count > 0 && count <= 2) level = 1;
      else if (count > 2 && count <= 5) level = 2;
      else if (count > 5 && count <= 10) level = 3;
      else if (count > 10) level = 4;

      return {
        day,
        count,
        level,
        dateKey,
      };
    });
  }, [activityDates]);

  if (isLoading) {
    return <div className="h-[150px] w-full bg-muted animate-pulse rounded-xl" />;
  }

  // Group days into weeks for the grid
  const weeks: any[][] = [];
  let currentWeek: any[] = [];

  // Pad the first week if necessary
  const firstDay = days[0].day;
  const paddingDays = getDay(firstDay);
  for (let i = 0; i < paddingDays; i++) {
    currentWeek.push(null);
  }

  days.forEach((dayData) => {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(dayData);
  });

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  return (
    <div className="p-4 border rounded-xl bg-card">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-sm font-medium">
          {activityDates?.length || 0} contributions in the last year
        </h3>
        <div className="overflow-x-auto pb-2">
          <div className="flex flex-col min-w-max">
            {/* Months labels */}
            <div className="flex text-[10px] text-muted-foreground mb-1 ml-6">
              {weeks.map((week, i) => {
                const firstDayOfWeek = week.find(d => d !== null)?.day;
                if (firstDayOfWeek && (i === 0 || firstDayOfWeek.getDate() <= 7)) {
                  return (
                    <div key={i} className="flex-1 min-w-[14px]">
                      {format(firstDayOfWeek, "MMM")}
                    </div>
                  );
                }
                return <div key={i} className="flex-1 min-w-[14px]" />;
              })}
            </div>

            <div className="flex gap-x-1">
              {/* Day labels */}
              <div className="flex flex-col justify-between text-[10px] text-muted-foreground pr-2 h-[90px]">
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
              </div>

              {/* Grid */}
              <div className="flex gap-x-[3px]">
                <TooltipProvider delayDuration={0}>
                  {weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-y-[3px]">
                      {week.map((dayData, dayIdx) => (
                        <Tooltip key={dayIdx}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "w-3 h-3 rounded-[2px]",
                                !dayData ? "bg-transparent" : 
                                dayData.level === 0 ? "bg-muted/50" :
                                dayData.level === 1 ? "bg-emerald-900" :
                                dayData.level === 2 ? "bg-emerald-700" :
                                dayData.level === 3 ? "bg-emerald-500" :
                                "bg-emerald-300"
                              )}
                            />
                          </TooltipTrigger>
                          {dayData && (
                            <TooltipContent side="top" className="text-[10px]">
                              {dayData.count} contributions on {format(dayData.day, "MMM d, yyyy")}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      ))}
                    </div>
                  ))}
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-x-2 text-[10px] text-muted-foreground self-end mt-2">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-muted/50" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-900" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-700" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-300" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
