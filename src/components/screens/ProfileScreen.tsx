import { useEffect, useMemo, useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { BadgeCheck, Plus, ShieldCheck, Trash2, Upload, User } from "lucide-react";
import { myProfileQuery } from "@/lib/queries";
import {
  saveAthleteProfile,
  saveCoachCredentials,
  savePrivacySettings,
  saveProfileDetails,
} from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ---------------------------- client-side validation ---------------------------- */

const profileDetailsSchema = z.object({
  displayName: z.string().trim().min(2, "At least 2 characters").max(80),
  country: z.string().trim().max(60).nullable(),
  city: z.string().trim().max(80).nullable(),
  headline: z.string().trim().max(140).nullable(),
  bio: z.string().trim().max(2000).nullable(),
});

const athleteProfileSchema = z.object({
  sports: z.array(z.string().trim().min(1).max(60)).max(20),
  primaryGoal: z.string().trim().max(200).nullable(),
});

const coachCredentialsSchema = z.object({
  specializations: z.array(z.string().trim().min(1).max(60)).max(20),
  sports: z.array(z.string().trim().min(1).max(60)).max(20),
  experienceYears: z.number().int().min(0).max(70),
  certifications: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        issuer: z.string().trim().max(120),
        year: z.number().int().min(1950).max(2100).nullable(),
      }),
    )
    .max(30),
  bio: z.string().trim().max(2000).nullable(),
  marketplaceEnabled: z.boolean(),
});

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/* ---------------------------------- tag input ---------------------------------- */

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const id = `tag-input-${label.replaceAll(/\s+/g, "-").toLowerCase()}`;

  function addTag() {
    const value = draft.trim();
    if (!value || values.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  }

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="gap-1 pr-1">
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              className="ml-1 rounded-full p-0.5 hover:bg-muted"
              onClick={() => onChange(values.filter((v) => v !== value))}
            >
              <Trash2 className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addTag}>
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- avatar card --------------------------------- */

function AvatarUploader({
  avatarUrl,
  displayName,
  onUploaded,
}: {
  avatarUrl: string | null;
  displayName: string;
  onUploaded: (path: string) => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!avatarUrl) {
      setSignedUrl(null);
      return;
    }
    void supabase.storage
      .from("avatars")
      .createSignedUrl(avatarUrl, 3600)
      .then(({ data }) => {
        if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const extension = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      onUploaded(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Avatar upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={signedUrl ?? undefined} alt="" />
        <AvatarFallback>
          <User className="size-6 text-warm-gray" aria-hidden="true" />
        </AvatarFallback>
      </Avatar>
      <div>
        <Label htmlFor="avatar-upload" className="sr-only">
          Upload avatar
        </Label>
        <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
          <label htmlFor="avatar-upload" className="cursor-pointer">
            <Upload className="size-4" aria-hidden="true" />
            {uploading ? "Uploading…" : "Change photo"}
          </label>
        </Button>
        <input
          id="avatar-upload"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void handleFile(event)}
          disabled={uploading}
        />
        <p className="mt-1 text-xs text-muted-foreground">JPG or PNG, up to 5MB.</p>
      </div>
      <span className="sr-only">{displayName}</span>
    </div>
  );
}

/* -------------------------------- main screen -------------------------------- */

export function ProfileScreen() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(myProfileQuery);

  const saveDetailsFn = useServerFn(saveProfileDetails);
  const savePrivacyFn = useServerFn(savePrivacySettings);
  const saveAthleteFn = useServerFn(saveAthleteProfile);
  const saveCoachFn = useServerFn(saveCoachCredentials);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["my-profile"] });

  const profile = data.profile;
  const athlete = data.athlete;
  const coach = data.coach;
  const roles = data.roles;

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [headline, setHeadline] = useState(profile?.headline ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [city, setCity] = useState(profile?.city ?? "");

  const [visibility, setVisibility] = useState<"public" | "private">(
    (profile?.profile_visibility as "public" | "private" | undefined) ?? "private",
  );
  const [showLocation, setShowLocation] = useState(profile?.show_location ?? false);

  const [athleteSports, setAthleteSports] = useState<string[]>(athlete?.sports ?? []);
  const [primaryGoal, setPrimaryGoal] = useState(athlete?.primary_goal ?? "");

  const [coachSpecializations, setCoachSpecializations] = useState<string[]>(
    coach?.specializations ?? [],
  );
  const [coachSports, setCoachSports] = useState<string[]>(coach?.sports ?? []);
  const [experienceYears, setExperienceYears] = useState(
    String(coach?.experience_years ?? 0),
  );
  const [certifications, setCertifications] = useState(
    coach?.certifications ?? [],
  );
  const [coachBio, setCoachBio] = useState(coach?.bio ?? "");
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(
    coach?.marketplace_enabled ?? false,
  );

  const detailsMutation = useMutation({
    mutationFn: async () => {
      const parsed = profileDetailsSchema.parse({
        displayName,
        country: country.trim() || null,
        city: city.trim() || null,
        headline: headline.trim() || null,
        bio: bio.trim() || null,
      });
      return saveDetailsFn({
        data: { ...parsed, avatarUrl: profile?.avatar_url ?? null },
      });
    },
    onSuccess: async () => {
      toast.success("Profile details saved.");
      await invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save profile.");
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (path: string) =>
      saveDetailsFn({
        data: {
          displayName: displayName.trim() || profile?.display_name || "",
          country: country.trim() || null,
          city: city.trim() || null,
          headline: headline.trim() || null,
          bio: bio.trim() || null,
          avatarUrl: path,
        },
      }),
    onSuccess: async () => {
      toast.success("Avatar updated.");
      await invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save avatar.");
    },
  });

  const privacyMutation = useMutation({
    mutationFn: async () =>
      savePrivacyFn({ data: { profileVisibility: visibility, showLocation } }),
    onSuccess: async () => {
      toast.success("Privacy settings saved.");
      await invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save privacy.");
    },
  });

  const athleteMutation = useMutation({
    mutationFn: async () => {
      const parsed = athleteProfileSchema.parse({
        sports: athleteSports,
        primaryGoal: primaryGoal.trim() || null,
      });
      return saveAthleteFn({ data: parsed });
    },
    onSuccess: async () => {
      toast.success("Athlete profile saved.");
      await invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save athlete profile.");
    },
  });

  const coachMutation = useMutation({
    mutationFn: async () => {
      const parsed = coachCredentialsSchema.parse({
        specializations: coachSpecializations,
        sports: coachSports,
        experienceYears: Number(experienceYears) || 0,
        certifications,
        bio: coachBio.trim() || null,
        marketplaceEnabled,
      });
      return saveCoachFn({ data: parsed });
    },
    onSuccess: async () => {
      toast.success("Coach credentials saved.");
      await invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save coach credentials.");
    },
  });

  const performanceScore = useMemo(
    () => (coach?.performance_score === null ? null : Number(coach?.performance_score)),
    [coach],
  );

  return (
    <section aria-labelledby="profile-title" className="mx-auto max-w-4xl">
      <h1 id="profile-title" className="font-display text-2xl font-light text-foreground">
        Profile
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your identity, credentials and privacy on ScienceFit.
      </p>

      {/* Header card */}
      <div className="glass mt-6 rounded-lg p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback>
                <User className="size-6 text-warm-gray" aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-medium text-foreground">
                {profile?.display_name || "Unnamed athlete"}
              </p>
              {profile?.headline && (
                <p className="text-sm text-muted-foreground">{profile.headline}</p>
              )}
              {(profile?.city || profile?.country) && (
                <p className="text-data mt-1 text-xs text-warm-gray">
                  {[profile?.city, profile?.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {roles.map((role) => (
              <Badge key={role} variant="secondary" className="capitalize">
                {role}
              </Badge>
            ))}
            {coach?.verified_at !== null && coach !== null && (
              <Badge className="gap-1">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                Verified coach
              </Badge>
            )}
            {coach !== null && performanceScore !== null && (
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Score {performanceScore.toFixed(1)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Avatar upload */}
      <div className="glass mt-6 rounded-lg p-6">
        <h2 className="text-sm font-medium text-foreground">Photo</h2>
        <div className="mt-4">
          <AvatarUploader
            avatarUrl={profile?.avatar_url ?? null}
            displayName={profile?.display_name ?? ""}
            onUploaded={(path) => avatarMutation.mutate(path)}
          />
        </div>
      </div>

      {/* Details form */}
      <form
        className="glass mt-6 rounded-lg p-6"
        onSubmit={(event) => {
          event.preventDefault();
          detailsMutation.mutate();
        }}
      >
        <h2 className="text-sm font-medium text-foreground">Details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              minLength={2}
              maxLength={80}
              className="mt-2"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={headline ?? ""}
              onChange={(event) => setHeadline(event.target.value)}
              maxLength={140}
              className="mt-2"
              placeholder="e.g. Marathon coach & strength specialist"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio ?? ""}
              onChange={(event) => setBio(event.target.value)}
              maxLength={2000}
              className="mt-2"
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={country ?? ""}
              onChange={(event) => setCountry(event.target.value)}
              maxLength={60}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city ?? ""}
              onChange={(event) => setCity(event.target.value)}
              maxLength={80}
              className="mt-2"
            />
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={detailsMutation.isPending}>
          {detailsMutation.isPending ? "Saving…" : "Save details"}
        </Button>
      </form>

      {/* Athlete section */}
      {athlete && (
        <form
          className="glass mt-6 rounded-lg p-6"
          onSubmit={(event) => {
            event.preventDefault();
            athleteMutation.mutate();
          }}
        >
          <h2 className="text-sm font-medium text-foreground">Athlete profile</h2>
          <div className="mt-4 space-y-4">
            <TagInput
              label="Sports"
              values={athleteSports}
              onChange={setAthleteSports}
              placeholder="Add a sport and press Enter"
            />
            <div>
              <Label htmlFor="primary-goal">Primary goal</Label>
              <Input
                id="primary-goal"
                value={primaryGoal ?? ""}
                onChange={(event) => setPrimaryGoal(event.target.value)}
                maxLength={200}
                className="mt-2"
              />
            </div>
          </div>
          <Button type="submit" className="mt-4" disabled={athleteMutation.isPending}>
            {athleteMutation.isPending ? "Saving…" : "Save athlete profile"}
          </Button>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Requests" value={data.athleteStats.requests} />
            <Stat label="Sessions logged" value={data.athleteStats.sessionsLogged} />
            <Stat label="Sessions completed" value={data.athleteStats.sessionsCompleted} />
            <Stat label="Minutes trained" value={data.athleteStats.minutesTrained} />
          </div>
        </form>
      )}

      {/* Coach section */}
      {coach && (
        <form
          className="glass mt-6 rounded-lg p-6"
          onSubmit={(event) => {
            event.preventDefault();
            coachMutation.mutate();
          }}
        >
          <h2 className="text-sm font-medium text-foreground">Coach credentials</h2>
          <div className="mt-4 space-y-4">
            <TagInput
              label="Specializations"
              values={coachSpecializations}
              onChange={setCoachSpecializations}
              placeholder="e.g. strength, endurance"
            />
            <TagInput
              label="Sports"
              values={coachSports}
              onChange={setCoachSports}
              placeholder="Add a sport and press Enter"
            />
            <div>
              <Label htmlFor="experience-years">Years of experience</Label>
              <Input
                id="experience-years"
                type="number"
                min={0}
                max={70}
                value={experienceYears}
                onChange={(event) => setExperienceYears(event.target.value)}
                className="mt-2 max-w-40"
              />
            </div>
            <div>
              <Label htmlFor="coach-bio">Coaching bio</Label>
              <Textarea
                id="coach-bio"
                value={coachBio ?? ""}
                onChange={(event) => setCoachBio(event.target.value)}
                maxLength={2000}
                className="mt-2"
                rows={4}
              />
            </div>

            <div>
              <Label>Certifications</Label>
              <div className="mt-2 space-y-3">
                {certifications.map((cert, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                    <Input
                      aria-label="Certification name"
                      placeholder="Name"
                      value={cert.name}
                      onChange={(event) => {
                        const next = [...certifications];
                        next[index] = { ...cert, name: event.target.value };
                        setCertifications(next);
                      }}
                    />
                    <Input
                      aria-label="Issuer"
                      placeholder="Issuer"
                      value={cert.issuer}
                      onChange={(event) => {
                        const next = [...certifications];
                        next[index] = { ...cert, issuer: event.target.value };
                        setCertifications(next);
                      }}
                    />
                    <Input
                      aria-label="Year"
                      type="number"
                      placeholder="Year"
                      className="w-28"
                      value={cert.year ?? ""}
                      onChange={(event) => {
                        const next = [...certifications];
                        const value = event.target.value;
                        next[index] = { ...cert, year: value ? Number(value) : null };
                        setCertifications(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove certification"
                      onClick={() =>
                        setCertifications(certifications.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCertifications([...certifications, { name: "", issuer: "", year: null }])
                  }
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add certification
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Marketplace listing</p>
                <p className="text-sm text-muted-foreground">
                  Allow athletes to discover you in the coach marketplace.
                </p>
              </div>
              <Switch
                checked={marketplaceEnabled}
                onCheckedChange={setMarketplaceEnabled}
                aria-label="Enable marketplace listing"
              />
            </div>
          </div>
          <Button type="submit" className="mt-4" disabled={coachMutation.isPending}>
            {coachMutation.isPending ? "Saving…" : "Save coach credentials"}
          </Button>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Submissions" value={data.coachStats.submissions} />
            <Stat label="Evaluated" value={data.coachStats.evaluated} />
            <Stat label="Wins" value={data.coachStats.wins} />
            <Stat
              label="Success rate"
              value={`${data.coachStats.successRate}%`}
            />
          </div>

          {data.performanceHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="text-data text-xs uppercase tracking-[0.2em] text-warm-gray">
                Performance score history
              </h3>
              <ul className="mt-2 space-y-1">
                {data.performanceHistory.slice(-5).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between text-sm text-muted-foreground"
                  >
                    <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                    <span className="text-data text-foreground">
                      {Number(entry.performance_score).toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )}

      {/* Privacy */}
      <form
        className="glass mt-6 rounded-lg p-6"
        onSubmit={(event) => {
          event.preventDefault();
          privacyMutation.mutate();
        }}
      >
        <h2 className="text-sm font-medium text-foreground">Privacy</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Public profiles can appear in the coach marketplace and be viewed by other members.
        </p>
        <div className="mt-4 space-y-4">
          <div className="max-w-xs">
            <Label htmlFor="profile-visibility">Profile visibility</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as "public" | "private")}
            >
              <SelectTrigger id="profile-visibility" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Show location</p>
              <p className="text-sm text-muted-foreground">
                Display your city and country on your public profile.
              </p>
            </div>
            <Switch
              checked={showLocation}
              onCheckedChange={setShowLocation}
              aria-label="Show location"
            />
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={privacyMutation.isPending}>
          {privacyMutation.isPending ? "Saving…" : "Save privacy settings"}
        </Button>
      </form>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-data text-2xl font-light text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ProfileScreenFallback() {
  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </section>
  );
}
