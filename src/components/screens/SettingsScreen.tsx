import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, LogOut } from "lucide-react";
import { accountQuery, notificationsQuery } from "@/lib/queries";
import { updateNotificationPreferences, updateUserPreferences } from "@/lib/app.functions";
import { NOTIFICATION_CATEGORIES } from "@/lib/business";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { TIER_CAPABILITIES, type DeviceTier } from "@/lib/device-tier";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString(undefined, {
    dateStyle: "long",
  });
}

function formatHour(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

export function SettingsScreen() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { override, detected, reducedMotion, setOverride } = useDeviceTier();

  const { data, isPending, isError, refetch } = useQuery(accountQuery);
  const { data: notificationsData } = useQuery(notificationsQuery);

  const saveUserPreferencesFn = useServerFn(updateUserPreferences);
  const saveNotificationPreferencesFn = useServerFn(updateNotificationPreferences);

  const preferences = data?.preferences ?? null;
  const notificationPreferences =
    data?.notificationPreferences ?? notificationsData?.preferences ?? null;

  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [locale, setLocale] = useState("en-US");
  const [timezone, setTimezone] = useState("UTC");
  const [motionOptIn, setMotionOptIn] = useState(false);

  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [mutedCategories, setMutedCategories] = useState<string[]>([]);
  const [quietHoursStart, setQuietHoursStart] = useState<string>("none");
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>("none");

  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  useEffect(() => {
    if (!preferences) return;
    setUnits(preferences.units === "imperial" ? "imperial" : "metric");
    setLocale(preferences.locale);
    setTimezone(preferences.timezone);
    setMotionOptIn(preferences.reduced_motion);
  }, [preferences]);

  useEffect(() => {
    if (!notificationPreferences) return;
    setInAppEnabled(notificationPreferences.in_app_enabled);
    setEmailEnabled(notificationPreferences.email_enabled);
    setPushEnabled(notificationPreferences.push_enabled);
    setMutedCategories(notificationPreferences.muted_categories ?? []);
    setQuietHoursStart(
      notificationPreferences.quiet_hours_start === null
        ? "none"
        : String(notificationPreferences.quiet_hours_start),
    );
    setQuietHoursEnd(
      notificationPreferences.quiet_hours_end === null
        ? "none"
        : String(notificationPreferences.quiet_hours_end),
    );
  }, [notificationPreferences]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: authData }) => {
      setAuthEmail(authData.user?.email ?? null);
    });
  }, []);

  const savePreferences = useMutation({
    mutationFn: (input: {
      locale: string;
      timezone: string;
      units: "metric" | "imperial";
      deviceTierPreference: DeviceTier | null;
      reducedMotion: boolean;
    }) => saveUserPreferencesFn({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      toast.success("Preferences saved.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save preferences.");
    },
  });

  const saveNotifications = useMutation({
    mutationFn: (input: {
      inAppEnabled: boolean;
      emailEnabled: boolean;
      pushEnabled: boolean;
      mutedCategories: string[];
      quietHoursStart: number | null;
      quietHoursEnd: number | null;
    }) => saveNotificationPreferencesFn({ data: input }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      toast.success("Notification preferences saved.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not save notification preferences.",
      );
    },
  });

  function persistPreferences(
    next: Partial<{
      units: "metric" | "imperial";
      locale: string;
      timezone: string;
      deviceTierPreference: DeviceTier | null;
      reducedMotion: boolean;
    }>,
  ) {
    savePreferences.mutate({
      units,
      locale,
      timezone,
      deviceTierPreference: override,
      reducedMotion: motionOptIn,
      ...next,
    });
  }

  function persistNotifications(
    next: Partial<{
      inAppEnabled: boolean;
      emailEnabled: boolean;
      pushEnabled: boolean;
      mutedCategories: string[];
      quietHoursStart: number | null;
      quietHoursEnd: number | null;
    }>,
  ) {
    saveNotifications.mutate({
      inAppEnabled,
      emailEnabled,
      pushEnabled,
      mutedCategories,
      quietHoursStart: quietHoursStart === "none" ? null : Number(quietHoursStart),
      quietHoursEnd: quietHoursEnd === "none" ? null : Number(quietHoursEnd),
      ...next,
    });
  }

  function toggleCategory(category: string, muted: boolean) {
    const next = muted
      ? Array.from(new Set([...mutedCategories, category]))
      : mutedCategories.filter((item) => item !== category);
    setMutedCategories(next);
    persistNotifications({ mutedCategories: next });
  }

  async function handlePasswordReset() {
    if (!authEmail) {
      toast.error("No email address on file for this account.");
      return;
    }
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail);
      if (error) throw error;
      toast.success("Password reset email sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reset email.");
    } finally {
      setResetBusy(false);
    }
  }

  async function handleSignOut() {
    setSignOutBusy(true);
    try {
      await supabase.auth.signOut();
      queryClient.clear();
      await navigate({ to: "/auth" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    } finally {
      setSignOutBusy(false);
    }
  }

  const tierOptions = useMemo(
    () => [
      { value: "auto", label: `Auto (detected: Tier ${detected ?? "C"})` },
      { value: "A", label: "Tier A" },
      { value: "B", label: "Tier B" },
      { value: "C", label: "Tier C" },
    ],
    [detected],
  );

  if (isPending) {
    return (
      <section className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="mx-auto max-w-4xl">
        <div className="glass rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">Settings could not be loaded.</p>
          <Button className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="settings-title" className="mx-auto max-w-4xl">
      <div>
        <h1 id="settings-title" className="font-display text-2xl font-light text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Appearance, notifications and account security.
        </p>
      </div>

      <Tabs defaultValue="appearance" className="mt-6">
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="account">Account &amp; security</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Rendering quality</CardTitle>
              <CardDescription>
                Controls how much cinematic detail ScienceFit renders on this device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="device-tier">Device tier</Label>
                <Select
                  value={override ?? "auto"}
                  onValueChange={(value) => {
                    const next = value === "auto" ? null : (value as DeviceTier);
                    setOverride(next);
                    persistPreferences({ deviceTierPreference: next });
                  }}
                >
                  <SelectTrigger id="device-tier" className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tierOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>Tier A — {TIER_CAPABILITIES.A}</li>
                  <li>Tier B — {TIER_CAPABILITIES.B}</li>
                  <li>Tier C — {TIER_CAPABILITIES.C}</li>
                </ul>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                  <Label htmlFor="os-reduced-motion">OS reduced motion</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reflects your operating system's "reduce motion" accessibility setting.
                  </p>
                </div>
                <Switch
                  id="os-reduced-motion"
                  checked={reducedMotion}
                  disabled
                  aria-readonly="true"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                  <Label htmlFor="reduced-motion-preference">Prefer reduced motion</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Minimises animation across ScienceFit regardless of device tier.
                  </p>
                </div>
                <Switch
                  id="reduced-motion-preference"
                  checked={motionOptIn}
                  onCheckedChange={(checked) => {
                    setMotionOptIn(checked);
                    persistPreferences({ reducedMotion: checked });
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="units">Units</Label>
                  <Select
                    value={units}
                    onValueChange={(value) => {
                      const next = value as "metric" | "imperial";
                      setUnits(next);
                      persistPreferences({ units: next });
                    }}
                  >
                    <SelectTrigger id="units">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metric">Metric (kg, km)</SelectItem>
                      <SelectItem value="imperial">Imperial (lb, mi)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locale">Locale</Label>
                  <input
                    id="locale"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={locale}
                    onChange={(event) => setLocale(event.target.value)}
                    onBlur={() => persistPreferences({ locale })}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <input
                    id="timezone"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    onBlur={() => persistPreferences({ timezone })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Delivery channels</CardTitle>
              <CardDescription>Choose where ScienceFit notifications reach you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <Label htmlFor="in-app-enabled">In-app notifications</Label>
                <Switch
                  id="in-app-enabled"
                  checked={inAppEnabled}
                  onCheckedChange={(checked) => {
                    setInAppEnabled(checked);
                    persistNotifications({ inAppEnabled: checked });
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <Label htmlFor="email-enabled">Email notifications</Label>
                <Switch
                  id="email-enabled"
                  checked={emailEnabled}
                  onCheckedChange={(checked) => {
                    setEmailEnabled(checked);
                    persistNotifications({ emailEnabled: checked });
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <Label htmlFor="push-enabled">Push notifications</Label>
                <Switch
                  id="push-enabled"
                  checked={pushEnabled}
                  onCheckedChange={(checked) => {
                    setPushEnabled(checked);
                    persistNotifications({ pushEnabled: checked });
                  }}
                />
              </div>

              <div className="grid gap-4 pt-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quiet-hours-start">Quiet hours start</Label>
                  <Select
                    value={quietHoursStart}
                    onValueChange={(value) => {
                      setQuietHoursStart(value);
                      persistNotifications({
                        quietHoursStart: value === "none" ? null : Number(value),
                      });
                    }}
                  >
                    <SelectTrigger id="quiet-hours-start">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Off</SelectItem>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour} value={String(hour)}>
                          {formatHour(hour)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiet-hours-end">Quiet hours end</Label>
                  <Select
                    value={quietHoursEnd}
                    onValueChange={(value) => {
                      setQuietHoursEnd(value);
                      persistNotifications({
                        quietHoursEnd: value === "none" ? null : Number(value),
                      });
                    }}
                  >
                    <SelectTrigger id="quiet-hours-end">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Off</SelectItem>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour} value={String(hour)}>
                          {formatHour(hour)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Categories</CardTitle>
              <CardDescription>Mute notification categories you don't need.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {NOTIFICATION_CATEGORIES.map((category) => {
                const muted = mutedCategories.includes(category);
                return (
                  <div
                    key={category}
                    className="flex items-center justify-between gap-4 rounded-lg border p-4"
                  >
                    <Label htmlFor={`category-${category}`} className="capitalize">
                      {category.replaceAll("_", " ").toLowerCase()}
                    </Label>
                    <Switch
                      id={`category-${category}`}
                      checked={!muted}
                      aria-label={`${muted ? "Unmute" : "Mute"} ${category.replaceAll("_", " ").toLowerCase()}`}
                      onCheckedChange={(checked) => toggleCategory(category, !checked)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your account details and security actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                  <p className="mt-1 text-sm text-foreground">{authEmail ?? "Not available"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Account created
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatDate(data?.profile?.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => void handlePasswordReset()}
                  disabled={resetBusy || !authEmail}
                >
                  <KeyRound className="size-4" aria-hidden="true" />
                  Send password reset email
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleSignOut()}
                  disabled={signOutBusy}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
