import type React from 'react';

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface NavItem {
  key: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
  children?: NavItem[];
}

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
