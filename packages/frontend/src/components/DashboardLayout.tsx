'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import {
    Film,
    PlusCircle,
    LogOut,
    User,
    Loader2,
} from 'lucide-react';

// ==========================================
// Dashboard Layout Component
// ==========================================

interface NavItem {
    label: string;
    href: string;
    icon: React.ElementType;
}

const navItems: NavItem[] = [
    { label: 'My Videos', href: '/videos', icon: Film },
    { label: 'Create Video', href: '/create', icon: PlusCircle },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isAuthenticated, isLoading, logout } = useAuth();

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isLoading, isAuthenticated, router]);

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent-primary)]" />
            </div>
        );
    }

    // Don't render if not authenticated
    if (!isAuthenticated) {
        return null;
    }

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <div className="min-h-screen flex bg-[var(--color-bg-primary)]">
            {/* Sidebar */}
            <aside className="w-64 bg-[var(--color-bg-elevated)] border-r border-[var(--color-border)] flex flex-col">
                {/* Logo */}
                <div className="p-6 border-b border-[var(--color-border)]">
                    <Link href="/videos" className="flex items-center gap-3">
                        <Image
                            src="/logo.svg"
                            alt="Rebound Logo"
                            width={40}
                            height={40}
                            className="w-10 h-10"
                        />
                        <span className="text-xl font-semibold text-[var(--color-text-primary)]">
                            Rebound
                        </span>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                                    backgroundColor: isActive ? 'var(--color-accent-primary)' : 'transparent',
                                }}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-[var(--color-bg-tertiary)]"
                            >
                                <Icon className="w-5 h-5" style={{ color: 'inherit' }} />
                                <span className="font-medium" style={{ color: 'inherit' }}>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-[var(--color-border)]">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg-tertiary)]">
                        <div className="w-9 h-9 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                {user?.name || 'User'}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] truncate">
                                {user?.email}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-error)] transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
