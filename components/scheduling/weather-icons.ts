import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  Sun,
  SunMedium,
  Wind,
  type LucideIcon,
} from "lucide-react";

/**
 * V0.30 — Weather icon registry.
 *
 * Server-safe helpers, importable from both server components (Call
 * Sheet view) and client components (WeatherIconPicker).
 */

export const WEATHER_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "sun", label: "Sunny", icon: Sun },
  { key: "partly_cloudy", label: "Partly cloudy", icon: SunMedium },
  { key: "cloudy", label: "Cloudy", icon: Cloud },
  { key: "rain", label: "Rain", icon: CloudRain },
  { key: "storm", label: "Storm", icon: CloudLightning },
  { key: "snow", label: "Snow", icon: CloudSnow },
  { key: "fog", label: "Fog", icon: CloudFog },
  { key: "wind", label: "Wind", icon: Wind },
  { key: "night", label: "Night", icon: CloudMoon },
];

export function weatherIconFor(key: string | null | undefined): LucideIcon {
  if (!key) return Sun;
  return WEATHER_ICONS.find((w) => w.key === key)?.icon ?? Sun;
}
