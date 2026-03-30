import { type LucideIcon } from "lucide-react";

import { StatCard } from "@/components/shared/StatCard";

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName?: string;
  className?: string;
}

export function SummaryCard({ title, value, subtitle, icon: Icon, iconClassName, className }: SummaryCardProps) {
  return <StatCard title={title} value={value} subtitle={subtitle} icon={Icon as LucideIcon} iconClassName={iconClassName} className={className} />;
}
