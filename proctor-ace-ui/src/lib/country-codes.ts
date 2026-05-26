export type CountryDial = { code: string; label: string; dial: string };

export const COUNTRY_DIAL_CODES: CountryDial[] = [
  { code: "MY", label: "Malaysia", dial: "+60" },
  { code: "SG", label: "Singapore", dial: "+65" },
  { code: "IN", label: "India", dial: "+91" },
  { code: "ID", label: "Indonesia", dial: "+62" },
  { code: "TH", label: "Thailand", dial: "+66" },
  { code: "PH", label: "Philippines", dial: "+63" },
  { code: "VN", label: "Vietnam", dial: "+84" },
  { code: "AU", label: "Australia", dial: "+61" },
  { code: "NZ", label: "New Zealand", dial: "+64" },
  { code: "GB", label: "United Kingdom", dial: "+44" },
  { code: "US", label: "United States", dial: "+1" },
  { code: "CA", label: "Canada", dial: "+1" },
  { code: "AE", label: "UAE", dial: "+971" },
  { code: "SA", label: "Saudi Arabia", dial: "+966" },
  { code: "PK", label: "Pakistan", dial: "+92" },
  { code: "BD", label: "Bangladesh", dial: "+880" },
  { code: "CN", label: "China", dial: "+86" },
  { code: "JP", label: "Japan", dial: "+81" },
  { code: "KR", label: "South Korea", dial: "+82" },
];

export function formatPhoneWithDial(dial: string, local: string): string {
  const digits = local.replace(/\D/g, "");
  const d = dial.replace(/\s/g, "");
  if (!digits) return d;
  if (digits.startsWith(d.replace("+", ""))) return `+${digits}`;
  return `${d}${digits}`;
}
