import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface UserProfile {
  _id: string;
  username: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  about_me?: string;
  location?: string;
  city?: string;
  country?: string;
  company?: string;
  college?: string;
  branch?: string;
  year?: string;
  website?: string;
  github?: string;
  linkedin?: string;
  twitter?: string;
  codeforces?: string;
  leetcode?: string;
  codechef?: string;
  hackerrank?: string;
  avatar_url?: string;
  banner_url?: string;
  skills?: string[];
  profile_visibility?: "public" | "private";
}

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
  userId: string;
  onSuccess: () => void;
}

export function EditProfileModal({
  open,
  onOpenChange,
  profile,
  userId,
  onSuccess,
}: EditProfileModalProps) {
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [skillsInput, setSkillsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        bio: profile.bio || "",
        about_me: profile.about_me || "",
        location: profile.location || "",
        city: profile.city || "",
        country: profile.country || "",
        company: profile.company || "",
        college: profile.college || "",
        branch: profile.branch || "",
        year: profile.year || "",
        website: profile.website || "",
        github: profile.github || "",
        linkedin: profile.linkedin || "",
        twitter: profile.twitter || "",
        codeforces: profile.codeforces || "",
        leetcode: profile.leetcode || "",
        codechef: profile.codechef || "",
        hackerrank: profile.hackerrank || "",
        avatar_url: profile.avatar_url || "",
        banner_url: profile.banner_url || "",
        profile_visibility: profile.profile_visibility || "public",
      });
      setSkillsInput(profile.skills ? profile.skills.join(", ") : "");
    }
  }, [profile, open]);

  const handleChange = (field: keyof UserProfile, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const skillsArray = skillsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        ...formData,
        skills: skillsArray,
      };

      await api.patch(`/accounts/profile/${userId}`, payload);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update profile. Please check inputs.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your public profile details, social links, and educational background.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="education">Education</TabsTrigger>
              <TabsTrigger value="social">Social Profiles</TabsTrigger>
              <TabsTrigger value="media">Media & Bio</TabsTrigger>
            </TabsList>

            {/* TAB 1: BASIC INFO */}
            <TabsContent value="basic" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name || ""}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    placeholder="Jane"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name || ""}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name || ""}
                  onChange={(e) => handleChange("display_name", e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city || ""}
                    onChange={(e) => handleChange("city", e.target.value)}
                    placeholder="San Francisco"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country || ""}
                    onChange={(e) => handleChange("country", e.target.value)}
                    placeholder="United States"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="company">Company / Organization</Label>
                <Input
                  id="company"
                  value={formData.company || ""}
                  onChange={(e) => handleChange("company", e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
            </TabsContent>

            {/* TAB 2: EDUCATION */}
            <TabsContent value="education" className="space-y-3 pt-3">
              <div className="space-y-1">
                <Label htmlFor="college">College / University</Label>
                <Input
                  id="college"
                  value={formData.college || ""}
                  onChange={(e) => handleChange("college", e.target.value)}
                  placeholder="Stanford University"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="branch">Branch / Field of Study</Label>
                  <Input
                    id="branch"
                    value={formData.branch || ""}
                    onChange={(e) => handleChange("branch", e.target.value)}
                    placeholder="Computer Science"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="year">Graduation Year</Label>
                  <Input
                    id="year"
                    value={formData.year || ""}
                    onChange={(e) => handleChange("year", e.target.value)}
                    placeholder="2026"
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: SOCIAL PROFILES */}
            <TabsContent value="social" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="github">GitHub Handle</Label>
                  <Input
                    id="github"
                    value={formData.github || ""}
                    onChange={(e) => handleChange("github", e.target.value)}
                    placeholder="janedoe"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="linkedin">LinkedIn Profile URL</Label>
                  <Input
                    id="linkedin"
                    value={formData.linkedin || ""}
                    onChange={(e) => handleChange("linkedin", e.target.value)}
                    placeholder="https://linkedin.com/in/janedoe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="leetcode">LeetCode Handle</Label>
                  <Input
                    id="leetcode"
                    value={formData.leetcode || ""}
                    onChange={(e) => handleChange("leetcode", e.target.value)}
                    placeholder="janedoe_lc"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="codeforces">Codeforces Handle</Label>
                  <Input
                    id="codeforces"
                    value={formData.codeforces || ""}
                    onChange={(e) => handleChange("codeforces", e.target.value)}
                    placeholder="janedoe_cf"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="codechef">CodeChef Handle</Label>
                  <Input
                    id="codechef"
                    value={formData.codechef || ""}
                    onChange={(e) => handleChange("codechef", e.target.value)}
                    placeholder="janedoe_cc"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hackerrank">HackerRank Handle</Label>
                  <Input
                    id="hackerrank"
                    value={formData.hackerrank || ""}
                    onChange={(e) => handleChange("hackerrank", e.target.value)}
                    placeholder="janedoe_hr"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="website">Personal Portfolio / Website</Label>
                <Input
                  id="website"
                  value={formData.website || ""}
                  onChange={(e) => handleChange("website", e.target.value)}
                  placeholder="https://janedoe.dev"
                />
              </div>
            </TabsContent>

            {/* TAB 4: MEDIA & BIO */}
            <TabsContent value="media" className="space-y-3 pt-3">
              <div className="space-y-1">
                <Label htmlFor="avatar_url">Avatar Image URL</Label>
                <Input
                  id="avatar_url"
                  value={formData.avatar_url || ""}
                  onChange={(e) => handleChange("avatar_url", e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="banner_url">Banner Image URL</Label>
                <Input
                  id="banner_url"
                  value={formData.banner_url || ""}
                  onChange={(e) => handleChange("banner_url", e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="bio">Short Bio (Headline)</Label>
                <Input
                  id="bio"
                  value={formData.bio || ""}
                  onChange={(e) => handleChange("bio", e.target.value)}
                  placeholder="Competitive programmer & full-stack architect"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="about_me">About Me (Full Story)</Label>
                <Textarea
                  id="about_me"
                  rows={3}
                  value={formData.about_me || ""}
                  onChange={(e) => handleChange("about_me", e.target.value)}
                  placeholder="Tell the community about your journey, favorite algorithms, and project focus..."
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="skills">Skills (comma-separated)</Label>
                <Input
                  id="skills"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="C++, Python, React, Dynamic Programming, Graphs"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="ember-gradient text-primary-foreground border-0"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
