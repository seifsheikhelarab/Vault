import {
    createRootRoute,
    Link,
    Outlet,
    useNavigate,
    useLocation
} from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useSession, signOut } from '../lib/auth-client';
import { useTheme } from '../lib/use-theme';
import { Button, IconButton } from '../components/shared';
import { bind } from 'cuelume';

export const Route = createRootRoute({
    component: RootLayout
});

function RootLayout() {
    const staggerRef = useRef<HTMLDivElement>(null);
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, toggle: toggleTheme } = useTheme();

    // Derive context from current route path
    const context = location.pathname.startsWith('/company')
        ? 'company'
        : 'personal';

    useEffect(() => {
        requestAnimationFrame(() => {
            staggerRef.current?.classList.add('is-shown');
        });
        bind();
    }, []);

    const user = session?.user;
    const initials = user?.name
        ? user.name
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
        : (user?.email?.[0]?.toUpperCase() ?? '?');

    return (
        <div className="min-h-screen bg-warm-white">
            <nav
                style={{ viewTransitionName: 'site-nav' }}
                className="sticky top-0 z-50 h-16 bg-warm-white/90 backdrop-blur-md border-b border-border-light"
            >
                <div className="max-w-[1200px] mx-auto w-full px-6 h-full flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link
                            to="/"
                            className="group flex items-center gap-2.5 shrink-0"
                        >
                            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center shadow-warm-sm">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                    <line x1="12" y1="22.08" x2="12" y2="12" />
                                </svg>
                            </div>
                            <span className="font-bold text-lg text-text-primary tracking-tight group-hover:text-coral transition-colors duration-200">
                                Vault
                            </span>
                        </Link>

                        {/* Context Switcher */}
                        {user && (
                            <div className="hidden sm:flex items-center gap-1.5 p-0.5 bg-cream/60 rounded-[8px]">
                                <button
                                    data-cuelume-press
                                    onClick={() => {
                                        if (context !== 'personal')
                                            navigate({ to: '/dashboard' });
                                    }}
                                    className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all duration-150 ${
                                        context === 'personal'
                                            ? 'bg-surface text-text-primary shadow-warm-sm'
                                            : 'text-text-tertiary hover:text-text-secondary'
                                    }`}
                                >
                                    Personal
                                </button>
                                <button
                                    data-cuelume-press
                                    onClick={() => {
                                        if (context !== 'company')
                                            navigate({ to: '/company' });
                                    }}
                                    className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all duration-150 ${
                                        context === 'company'
                                            ? 'bg-surface text-text-primary shadow-warm-sm'
                                            : 'text-text-tertiary hover:text-text-secondary'
                                    }`}
                                >
                                    Company
                                </button>
                            </div>
                        )}

                        {/* Nav links — context-aware */}
                        {user && context === 'personal' && (
                            <div className="hidden sm:flex items-center gap-1">
                                <NavLink to="/dashboard" label="Dashboard" />
                                <NavLink to="/expenses" label="Expenses" />
                                <NavLink to="/groups" label="Groups" />
                                <NavLink
                                    to="/settlements"
                                    label="Settlements"
                                />
                            </div>
                        )}
                        {user && context === 'company' && (
                            <div className="hidden sm:flex items-center gap-1">
                                <NavLink to="/company" label="Overview" />
                                <NavLink to="/company/claims" label="Claims" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {user ? (
                            <>
                                <IconButton
                                    onClick={toggleTheme}
                                    ariaLabel={
                                        theme === 'dark'
                                            ? 'Switch to light mode'
                                            : 'Switch to dark mode'
                                    }
                                >
                                    {theme === 'dark' ? (
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <circle cx="12" cy="12" r="5" />
                                            <line
                                                x1="12"
                                                y1="1"
                                                x2="12"
                                                y2="3"
                                            />
                                            <line
                                                x1="12"
                                                y1="21"
                                                x2="12"
                                                y2="23"
                                            />
                                            <line
                                                x1="4.22"
                                                y1="4.22"
                                                x2="5.64"
                                                y2="5.64"
                                            />
                                            <line
                                                x1="18.36"
                                                y1="18.36"
                                                x2="19.78"
                                                y2="19.78"
                                            />
                                            <line
                                                x1="1"
                                                y1="12"
                                                x2="3"
                                                y2="12"
                                            />
                                            <line
                                                x1="21"
                                                y1="12"
                                                x2="23"
                                                y2="12"
                                            />
                                            <line
                                                x1="4.22"
                                                y1="19.78"
                                                x2="5.64"
                                                y2="18.36"
                                            />
                                            <line
                                                x1="18.36"
                                                y1="5.64"
                                                x2="19.78"
                                                y2="4.22"
                                            />
                                        </svg>
                                    ) : (
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                        </svg>
                                    )}
                                </IconButton>
                                <Link
                                    to="/settings"
                                    data-cuelume-press
                                    className="px-3 py-1.5 text-sm font-medium text-text-tertiary hover:text-text-primary transition-colors duration-200 rounded-lg hover:bg-cream"
                                >
                                    Settings
                                </Link>
                                <div className="relative group">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center text-white font-semibold text-sm shadow-warm-sm cursor-pointer hover:shadow-warm-md transition-shadow duration-200">
                                        {initials}
                                    </div>
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-surface rounded-[10px] shadow-warm-lg border border-border-light py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                                        <div className="px-3.5 py-2 border-b border-border-light mb-1.5">
                                            <p className="text-sm font-medium text-text-primary truncate">
                                                {user.name}
                                            </p>
                                            <p className="text-xs text-text-tertiary truncate">
                                                {user.email}
                                            </p>
                                        </div>
                                        <button
                                            data-cuelume-press
                                            onClick={async () => {
                                                await signOut();
                                                navigate({ to: '/sign-in' });
                                            }}
                                            className="w-full text-left px-3.5 py-2 text-sm text-text-secondary hover:text-coral hover:bg-cream/50 transition-colors"
                                        >
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link
                                    to="/sign-in"
                                    data-cuelume-press
                                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-200 rounded-[10px] hover:bg-cream"
                                >
                                    Sign in
                                </Link>
                                <Button to="/sign-up">Sign up</Button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
            <main className={user ? 'max-w-[1200px] mx-auto px-6 py-8' : ''}>
                <div ref={staggerRef} className="t-stagger">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

function NavLink({ to, label }: { to: string; label: string }) {
    return (
        <Link
            to={to}
            data-cuelume-press
            className="px-3.5 py-2 rounded-[10px] text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-cream/80 transition-colors duration-150 [&.active]:bg-coral-light [&.active]:text-coral [&.active]:font-semibold"
        >
            {label}
        </Link>
    );
}
