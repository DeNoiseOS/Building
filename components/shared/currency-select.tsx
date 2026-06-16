"use client";

/**
 * V0.11 — Currency dropdown.
 *
 * Used wherever a user picks a project currency. The list of supported
 * codes lives in `lib/currencies.ts` so adding a new currency is a
 * single-file change.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";

interface CurrencySelectProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}

export function CurrencySelect({
  value,
  onChange,
  id,
  disabled,
}: CurrencySelectProps) {
  return (
    <Select
      value={value ?? DEFAULT_CURRENCY}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
