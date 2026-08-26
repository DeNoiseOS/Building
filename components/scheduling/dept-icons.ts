import {
  Building2,
  Camera,
  Clapperboard,
  DollarSign,
  Film,
  Hammer,
  Lightbulb,
  MapPin,
  Music4,
  Palette,
  Scissors,
  Shirt,
  Sparkles,
  Truck,
  Users,
  Utensils,
  Video,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * V0.30 — Department kind → icon mapping.
 *
 * Used by the Call Sheet's scene breakdown boxes and crew-list
 * boxes to give each department an immediate visual identity.
 * Falls back to Building2 for unknown kinds.
 */
const KIND_ICONS: Record<string, LucideIcon> = {
  director: Clapperboard,
  assistant_director: Clapperboard,
  producer: Film,
  executive_producer: Film,
  line_producer: Film,
  production_manager: Building2,
  art_director: Palette,
  set_decorator: Palette,
  props_master: Palette,
  wardrobe: Shirt,
  costume_designer: Shirt,
  makeup_artist: Wand2,
  hair_stylist: Wand2,
  director_of_photography: Camera,
  camera_department: Camera,
  camera_operator: Camera,
  focus_puller: Camera,
  steadicam: Video,
  dit: Video,
  gaffer: Lightbulb,
  best_boy: Lightbulb,
  electrician: Lightbulb,
  lighting: Lightbulb,
  key_grip: Wrench,
  grip: Wrench,
  sound_department: Music4,
  sound_mixer: Music4,
  boom_operator: Music4,
  editor: Scissors,
  colorist: Sparkles,
  vfx: Sparkles,
  location_manager: MapPin,
  transport: Truck,
  catering: Utensils,
  casting_manager: Users,
  cast: Users,
  agency_creative_director: Users,
};

export function deptIconFor(kind: string): LucideIcon {
  return KIND_ICONS[kind] ?? Building2;
}

/** Rough grouping used by the Call Sheet crew page. */
export function deptBucketFor(kind: string): string {
  if (/director|producer|manager/.test(kind)) return "Direction";
  if (/camera|dop|dit|steadicam|focus/.test(kind)) return "Camera";
  if (/sound|boom|mixer/.test(kind)) return "Sound";
  if (/gaffer|best_boy|electrician|light|grip/.test(kind)) return "Lighting & Grip";
  if (/art|set|prop|wardrobe|costume/.test(kind)) return "Art";
  if (/makeup|hair/.test(kind)) return "Hair & Makeup";
  if (/location/.test(kind)) return "Location";
  if (/cast|casting|talent/.test(kind)) return "Cast";
  if (/agency|client/.test(kind)) return "Agency";
  if (/editor|colorist|vfx|post/.test(kind)) return "Post";
  return "Other";
}
