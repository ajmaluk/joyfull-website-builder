"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyIcon, Trash2Icon, PlusIcon, Loader2Icon, ShieldIcon, UsersIcon, ZapIcon, InfoIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SettingsPage = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");

  const { data: keys, isLoading: isLoadingKeys, error: keysError } = useQuery(trpc.api.getKeys.queryOptions());
  const { data: usage } = useQuery(trpc.usage.status.queryOptions());

  const createKey = useMutation(trpc.api.createKey.mutationOptions({
    onSuccess: () => {
      setNewKeyName("");
      queryClient.invalidateQueries(trpc.api.getKeys.queryOptions());
      toast.success("API key created successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  }));

  const deleteKey = useMutation(trpc.api.deleteKey.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.api.getKeys.queryOptions());
      toast.success("API key deleted");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  }));

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    createKey.mutate({ name: newKeyName });
  };

  const isPro = usage?.isPro;
  const isEnterprise = usage?.isEnterprise;
  const isProOrEnterprise = isPro || isEnterprise;

  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full gap-y-8 py-12">
      <div className="flex flex-col gap-y-2">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account, API keys, and plan features.</p>
      </div>

      <Tabs defaultValue="api" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="plan">Plan & Features</TabsTrigger>
          <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-x-2">
                <KeyIcon className="size-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Use API keys to interact with Vibe programmatically. These keys are only available on Pro and Enterprise plans.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {keysError && (
                <Alert variant="destructive">
                  <ShieldIcon className="h-4 w-4" />
                  <AlertTitle>Access Denied</AlertTitle>
                  <AlertDescription>
                    {keysError.message}
                  </AlertDescription>
                </Alert>
              )}

              {!keysError && (
                <>
                  <form onSubmit={handleCreateKey} className="flex gap-x-2">
                    <Input
                      placeholder="Key name (e.g., Development)"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      disabled={createKey.isPending}
                    />
                    <Button type="submit" disabled={createKey.isPending || !newKeyName.trim()}>
                      {createKey.isPending ? <Loader2Icon className="animate-spin size-4" /> : <PlusIcon className="size-4" />}
                      Create Key
                    </Button>
                  </form>

                  <div className="border rounded-md divide-y">
                    {isLoadingKeys ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">Loading keys...</div>
                    ) : keys?.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">No API keys found</div>
                    ) : (
                      keys?.map((key: { id: string; name: string; key: string; createdAt: string | Date }) => (
                        <div key={key.id} className="p-4 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="font-medium">{key.name}</span>
                            <span className="text-xs font-mono text-muted-foreground select-all">{key.key}</span>
                            <span className="text-[10px] text-muted-foreground mt-1">
                              Created {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteKey.mutate({ id: key.id })}
                            disabled={deleteKey.isPending}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-x-2">
                  <ZapIcon className="size-5 text-yellow-500" />
                  Plan Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Current Plan</span>
                  <Badge variant={isProOrEnterprise ? "default" : "secondary"}>
                    {isEnterprise ? "Enterprise" : isProOrEnterprise ? "Pro" : "Free"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Credits Remaining</span>
                  <span className="text-sm font-mono">{usage?.remainingPoints || 0}</span>
                </div>
                <Button className="w-full" variant="outline" asChild>
                  <a href="/pricing">Manage Subscription</a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-x-2">
                  <InfoIcon className="size-5" />
                  Features Included
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center justify-between">
                    <span>AI Assistance</span>
                    <Badge variant="outline">{isProOrEnterprise ? "Advanced (GPT-4o)" : "Basic (GPT-4o-mini)"}</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>API Access</span>
                    <Badge variant={isProOrEnterprise ? "default" : "secondary"}>{isProOrEnterprise ? "Enabled" : "Disabled"}</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Custom Templates</span>
                    <Badge variant={isProOrEnterprise ? "default" : "secondary"}>{isProOrEnterprise ? "Enabled" : "Disabled"}</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Team Collaboration</span>
                    <Badge variant={isProOrEnterprise ? "default" : "secondary"}>{isProOrEnterprise ? "Enabled" : "Disabled"}</Badge>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="collaboration" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-x-2">
                <UsersIcon className="size-5" />
                Team Collaboration
              </CardTitle>
              <CardDescription>
                Invite team members and collaborate on projects. Available on Pro and Enterprise plans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Beta Feature</AlertTitle>
                <AlertDescription>
                  Team collaboration is currently in beta and only available for Pro and Enterprise users. Use Clerk Organizations to manage your team.
                </AlertDescription>
              </Alert>
              <div className="mt-6 text-center py-8 border rounded-md border-dashed">
                <p className="text-sm text-muted-foreground mb-4">You are currently using Vibe as an individual.</p>
                <Button disabled={!isProOrEnterprise}>Create Team Organization</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
