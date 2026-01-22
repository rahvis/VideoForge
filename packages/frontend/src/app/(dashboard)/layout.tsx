import { AuthProvider } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';

// ==========================================
// Dashboard Route Group Layout
// ==========================================

export default function DashboardRouteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <DashboardLayout>{children}</DashboardLayout>
        </AuthProvider>
    );
}
