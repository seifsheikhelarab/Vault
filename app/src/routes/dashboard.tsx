import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useExpenses, useCategories, useBudgets } from '../lib/hooks';
import { DEFAULT_EXPENSE_SEARCH } from './expenses';
import { authClient } from '../lib/auth-client';
import { AddExpenseDialog } from '../components/add-expense-dialog';

export const Route = createFileRoute('/dashboard')({
    beforeLoad: async () => {
        const { data } = await authClient.getSession();
        if (!data?.user) throw redirect({ to: '/sign-in' });
        return { session: data };
    },
    component: Dashboard
});

const CHART_COLORS = [
    '#FF6B6B',
    '#FFAB91',
    '#FFD54F',
    '#A8D5BA',
    '#81D4FA',
    '#CE93D8',
    '#F48FB1'
];

function Dashboard() {
    const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);
    const [hoveredBar, setHoveredBar] = useState<number | null>(null);
    const [revealed, setRevealed] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);

    const tiltRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        requestAnimationFrame(() => setRevealed(true));
    }, []);

    const { data: expenseData, isLoading } = useExpenses({ pageSize: 50 });
    const { data: categories = [] } = useCategories();
    const { data: budgets = [] } = useBudgets();

    const expenses = expenseData?.items ?? [];

    const totalSpent = expenses.reduce(
        (sum, e) => sum + e.amountCents / 100,
        0
    );
    const budget = budgets.find((b) => !b.groupId);
    const totalBudget = budget ? budget.amountCents / 100 : null;
    const remaining = totalBudget !== null ? totalBudget - totalSpent : null;
    const budgetPercent =
        totalBudget !== null
            ? Math.round((totalSpent / totalBudget) * 100)
            : null;

    const categoryMap = new Map<string, number>();
    expenses.forEach((e) => {
        const cat = categories.find((c) => c.id === e.categoryId);
        const name = cat?.name ?? 'Other';
        categoryMap.set(
            name,
            (categoryMap.get(name) ?? 0) + e.amountCents / 100
        );
    });
    const chartCategories = Array.from(categoryMap.entries())
        .map(([name, value], i) => ({
            name,
            value,
            color: CHART_COLORS[i % CHART_COLORS.length]
        }))
        .sort((a, b) => b.value - a.value);

    const totalCategories = chartCategories.reduce((s, c) => s + c.value, 0);

    const now = new Date();
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const spendingByDay = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        const dayExpenses = expenses.filter((e) => {
            const ed = new Date(e.date);
            return ed >= d && ed < next;
        });
        return {
            day: daysOfWeek[d.getDay()],
            amount: dayExpenses.reduce((s, e) => s + e.amountCents / 100, 0)
        };
    });
    const maxBar = Math.max(...spendingByDay.map((d) => d.amount), 1);

    const topCategory = chartCategories[0]?.name ?? '—';
    const avgPerDay = expenses.length > 0 ? totalSpent / 7 : 0;
    const recentExpenses = expenses.slice(0, 6);

    const handleTiltMove = useCallback((e: React.MouseEvent) => {
        const card = cardRef.current;
        const glare = glareRef.current;
        if (!card || !glare) return;
        const rect = tiltRef.current!.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rotX = (0.5 - y) * 12;
        const rotY = (x - 0.5) * 12;
        card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.02,1.02,1.02)`;
        glare.style.setProperty('--glare-x', `${x * 100}%`);
        glare.style.setProperty('--glare-y', `${y * 100}%`);
    }, []);

    const handleTiltLeave = useCallback(() => {
        const card = cardRef.current;
        if (!card) return;
        card.style.transform = 'rotateX(0) rotateY(0) scale3d(1,1,1)';
    }, []);

    const SIDE_CARDS = [
        {
            label: 'Remaining',
            value: remaining !== null ? `$${remaining.toFixed(2)}` : '—'
        },
        { label: 'Categories', value: String(chartCategories.length) },
        { label: 'Avg / day', value: `$${avgPerDay.toFixed(2)}` },
        { label: 'Top category', value: topCategory }
    ];

    if (isLoading) {
        return (
            <div className="space-y-8">
                <div className="space-y-2">
                    <div className="h-7 w-32 bg-cream rounded-lg animate-pulse" />
                    <div className="h-4 w-48 bg-cream/60 rounded-lg animate-pulse" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 h-56 bg-surface rounded-[16px] animate-pulse shadow-warm-sm border border-border-light" />
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="h-28 bg-surface rounded-[16px] animate-pulse shadow-warm-sm border border-border-light"
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="space-y-8"
            style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? 'none' : 'translateY(12px)',
                transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
            }}
        >
            {/* Header */}
            <div
                className="t-stagger"
                ref={(el) => {
                    if (el)
                        requestAnimationFrame(() =>
                            el.classList.add('is-shown')
                        );
                }}
            >
                <h1 className="text-xl font-semibold text-text-primary t-stagger-line">
                    Dashboard
                </h1>
                <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">
                    Your spending at a glance
                </p>
            </div>

            {/* Hero metric — elevated focal point */}
            <div
                ref={tiltRef}
                className="t-tilt max-w-[800px]"
                onMouseMove={handleTiltMove}
                onMouseLeave={handleTiltLeave}
                style={{
                    viewTransitionName: 'hero-card',
                    opacity: revealed ? 1 : 0,
                    transform: revealed ? 'none' : 'translateY(12px)',
                    transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s'
                }}
            >
                <div
                    ref={cardRef}
                    className="t-tilt-card bg-surface rounded-[16px] p-6 shadow-warm-sm border border-border-light relative overflow-hidden"
                >
                    <div
                        ref={glareRef}
                        className="t-tilt-glare rounded-[16px]"
                    />
                    <div className="flex items-start justify-between mb-4 relative z-[1]">
                        <span className="text-sm font-medium text-text-secondary">
                            Total Spent
                        </span>
                        <span className="text-coral">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                        </span>
                    </div>
                    <div className="font-mono text-4xl font-bold text-text-primary tracking-tight mb-2 relative z-[1]">
                        ${totalSpent.toFixed(2)}
                    </div>
                    <span className="text-xs text-text-tertiary block mb-5 relative z-[1]">
                        This month
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 relative z-[1] border-t border-border-light pt-5 mt-2">
                        {SIDE_CARDS.map((card) => (
                            <div key={card.label}>
                                <span className="text-xs font-medium text-text-tertiary block mb-1">
                                    {card.label}
                                </span>
                                <div className="font-mono text-base font-bold text-text-primary tracking-tight">
                                    {card.value}
                                </div>
                            </div>
                        ))}
                    </div>
                    {budgetPercent !== null ? (
                        <div className="mt-5 relative z-[1]">
                            <div className="flex items-center justify-between text-xs text-text-tertiary mb-1.5">
                                <span>{budgetPercent}% of budget</span>
                                <span className="font-mono">
                                    ${totalBudget!.toLocaleString()}
                                </span>
                            </div>
                            <div className="h-2.5 bg-cream rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                                    style={{
                                        width: `${Math.min(budgetPercent, 100)}%`,
                                        background:
                                            'linear-gradient(90deg, var(--color-coral), var(--color-chart-2))'
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="mt-5 relative z-[1]">
                            <p className="text-xs text-text-tertiary">
                                No personal budget set —{' '}
                                <Link
                                    to="/settings"
                                    className="text-coral hover:text-coral-dark underline underline-offset-2 transition-colors"
                                >
                                    set one up
                                </Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Donut */}
                <div
                    className="lg:col-span-2 vt-scroll-reveal-scale"
                    style={{
                        opacity: revealed ? 1 : 0,
                        transition:
                            'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.25s'
                    }}
                >
                    <h2 className="text-base font-semibold text-text-primary mb-6">
                        By Category
                    </h2>
                    {chartCategories.length === 0 ? (
                        <div className="flex items-center justify-center h-48 text-sm text-text-tertiary">
                            No expenses yet
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-center">
                                <div className="relative">
                                    <svg
                                        width="200"
                                        height="200"
                                        viewBox="0 0 200 200"
                                        role="img"
                                        aria-label="Category breakdown chart"
                                    >
                                        {(() => {
                                            let cumAngle = -90;
                                            return chartCategories.map(
                                                (cat, i) => {
                                                    const angle =
                                                        (cat.value /
                                                            totalCategories) *
                                                        360;
                                                    const startAngle = cumAngle;
                                                    cumAngle += angle;
                                                    const endAngle = cumAngle;
                                                    const startRad =
                                                        (startAngle * Math.PI) /
                                                        180;
                                                    const endRad =
                                                        (endAngle * Math.PI) /
                                                        180;
                                                    const x1 =
                                                        100 +
                                                        80 * Math.cos(startRad);
                                                    const y1 =
                                                        100 +
                                                        80 * Math.sin(startRad);
                                                    const x2 =
                                                        100 +
                                                        80 * Math.cos(endRad);
                                                    const y2 =
                                                        100 +
                                                        80 * Math.sin(endRad);
                                                    const largeArc =
                                                        angle > 180 ? 1 : 0;
                                                    const innerX1 =
                                                        100 +
                                                        50 * Math.cos(startRad);
                                                    const innerY1 =
                                                        100 +
                                                        50 * Math.sin(startRad);
                                                    const innerX2 =
                                                        100 +
                                                        50 * Math.cos(endRad);
                                                    const innerY2 =
                                                        100 +
                                                        50 * Math.sin(endRad);
                                                    const isHovered =
                                                        hoveredCategory === i;
                                                    const midAngle =
                                                        (((startAngle +
                                                            endAngle) /
                                                            2) *
                                                            Math.PI) /
                                                        180;
                                                    const tx = isHovered
                                                        ? 4 * Math.cos(midAngle)
                                                        : 0;
                                                    const ty = isHovered
                                                        ? 4 * Math.sin(midAngle)
                                                        : 0;
                                                    return (
                                                        <path
                                                            key={cat.name}
                                                            d={`M ${x1 + tx} ${y1 + ty} A 80 80 0 ${largeArc} 1 ${x2 + tx} ${y2 + ty} L ${innerX2 + tx} ${innerY2 + ty} A 50 50 0 ${largeArc} 0 ${innerX1 + tx} ${innerY1 + ty} Z`}
                                                            fill={cat.color}
                                                            opacity={
                                                                hoveredCategory !==
                                                                    null &&
                                                                hoveredCategory !==
                                                                    i
                                                                    ? 0.35
                                                                    : 1
                                                            }
                                                            style={{
                                                                transition:
                                                                    'opacity 0.2s, transform 0.2s',
                                                                cursor: 'pointer'
                                                            }}
                                                            onMouseEnter={() =>
                                                                setHoveredCategory(
                                                                    i
                                                                )
                                                            }
                                                            onMouseLeave={() =>
                                                                setHoveredCategory(
                                                                    null
                                                                )
                                                            }
                                                        />
                                                    );
                                                }
                                            );
                                        })()}
                                        <text
                                            x="100"
                                            y="95"
                                            textAnchor="middle"
                                            className="font-mono"
                                            fontSize="24"
                                            fontWeight="700"
                                            fill="#1A1A1A"
                                        >
                                            ${totalCategories.toLocaleString()}
                                        </text>
                                        <text
                                            x="100"
                                            y="115"
                                            textAnchor="middle"
                                            fontSize="12"
                                            fill="#6B7280"
                                        >
                                            Total
                                        </text>
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-2">
                                {chartCategories.map((cat, i) => (
                                    <div
                                        key={cat.name}
                                        className="flex items-center gap-2 text-sm cursor-pointer rounded-lg px-2 py-1 hover:bg-cream/50 transition-colors"
                                        onMouseEnter={() =>
                                            setHoveredCategory(i)
                                        }
                                        onMouseLeave={() =>
                                            setHoveredCategory(null)
                                        }
                                    >
                                        <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{
                                                backgroundColor: cat.color
                                            }}
                                        />
                                        <span className="text-text-secondary truncate">
                                            {cat.name}
                                        </span>
                                        <span className="font-mono text-text-primary ml-auto text-xs">
                                            ${cat.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Bar Chart */}
                <div
                    className="lg:col-span-3 vt-scroll-reveal-scale"
                    style={{
                        opacity: revealed ? 1 : 0,
                        transition:
                            'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s'
                    }}
                >
                    <h2 className="text-base font-semibold text-text-primary mb-6">
                        This Week
                    </h2>
                    <div className="flex gap-3 h-48">
                        {spendingByDay.map((day, i) => {
                            const height =
                                maxBar > 0 ? (day.amount / maxBar) * 100 : 0;
                            const isHovered = hoveredBar === i;
                            return (
                                <div
                                    key={day.day}
                                    className="flex-1 flex flex-col justify-end items-center gap-2 relative"
                                >
                                    {/* Label first (bottom-most via justify-end) */}
                                    <span className="text-xs text-text-tertiary shrink-0">
                                        {day.day}
                                    </span>
                                    {/* Bar second (sits above label via justify-end) */}
                                    <div
                                        className="w-full rounded-t-[6px] cursor-pointer relative transition-opacity duration-200"
                                        style={{
                                            height: revealed
                                                ? `${Math.max(height, 2)}%`
                                                : '0%',
                                            background: isHovered
                                                ? 'linear-gradient(180deg, #E85555 0%, #FF6B6B 100%)'
                                                : 'linear-gradient(180deg, #FF6B6B 0%, #FFAB91 100%)',
                                            opacity:
                                                hoveredBar !== null &&
                                                !isHovered
                                                    ? 0.4
                                                    : 1,
                                            minHeight: '4px',
                                            transition: `height 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${0.5 + i * 0.06}s, opacity 0.2s`
                                        }}
                                        onMouseEnter={() => setHoveredBar(i)}
                                        onMouseLeave={() => setHoveredBar(null)}
                                    >
                                        {isHovered && (
                                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs text-text-primary bg-surface shadow-warm-md rounded-full px-2.5 py-1 border border-border-light whitespace-nowrap">
                                                ${day.amount.toFixed(0)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Spending Over Time — Line Chart */}
            <div
                style={{
                    opacity: revealed ? 1 : 0,
                    transform: revealed ? 'none' : 'translateY(12px)',
                    transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.35s'
                }}
            >
                <h2 className="text-base font-semibold text-text-primary mb-6">
                    Spending Over Time
                </h2>
                {expenses.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-sm text-text-tertiary">
                        No expenses yet
                    </div>
                ) : (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={spendingByDay}
                                margin={{
                                    top: 10,
                                    right: 10,
                                    left: 0,
                                    bottom: 0
                                }}
                            >
                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                        fontSize: 12,
                                        fill: 'var(--color-text-tertiary)'
                                    }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                        fontSize: 12,
                                        fill: 'var(--color-text-tertiary)'
                                    }}
                                    tickFormatter={(v: number | string) =>
                                        `$${v}`
                                    }
                                    width={40}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--color-surface)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '10px',
                                        boxShadow:
                                            '0 4px 12px rgba(0,0,0,0.08)',
                                        fontSize: '13px',
                                        color: 'var(--color-text-primary)'
                                    }}
                                    formatter={(value) => [
                                        `$${Number(value ?? 0).toFixed(2)}`,
                                        'Spent'
                                    ]}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#FF6B6B"
                                    strokeWidth={2.5}
                                    dot={{
                                        r: 4,
                                        fill: '#FF6B6B',
                                        strokeWidth: 2,
                                        stroke: '#fff'
                                    }}
                                    activeDot={{
                                        r: 6,
                                        fill: '#FF6B6B',
                                        strokeWidth: 2,
                                        stroke: '#fff'
                                    }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Recent Expenses */}
            <div
                style={{
                    viewTransitionName: 'expenses-table',
                    opacity: revealed ? 1 : 0,
                    transform: revealed ? 'none' : 'translateY(8px)',
                    transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.4s'
                }}
            >
                <div className="px-6 py-4 flex items-center justify-between border-b border-border-light">
                    <h2 className="text-base font-semibold text-text-primary">
                        Recent Expenses
                    </h2>
                    <Link
                        to="/expenses"
                        search={DEFAULT_EXPENSE_SEARCH}
                        data-cuelume-press
                        className="text-sm font-medium text-coral hover:text-coral-dark transition-colors"
                    >
                        View all
                    </Link>
                </div>
                {recentExpenses.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <p className="text-sm text-text-secondary font-medium">
                            No expenses yet
                        </p>
                        <p className="text-xs text-text-tertiary mt-1">
                            Add your first expense to get started
                        </p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-cream/60">
                                <th className="px-6 py-3.5 text-left text-xs font-semibold text-text-secondary">
                                    Description
                                </th>
                                <th className="px-6 py-3.5 text-left text-xs font-semibold text-text-secondary">
                                    Category
                                </th>
                                <th className="px-6 py-3.5 text-left text-xs font-semibold text-text-secondary">
                                    Date
                                </th>
                                <th className="px-6 py-3.5 text-right text-xs font-semibold text-text-secondary">
                                    Amount
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentExpenses.map((expense) => {
                                const cat = categories.find(
                                    (c) => c.id === expense.categoryId
                                );
                                return (
                                    <tr
                                        key={expense.id}
                                        className="border-b border-border-light last:border-0 hover:bg-cream/40 transition-colors duration-150 group"
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-text-primary group-hover:text-coral transition-colors duration-150">
                                            {expense.description}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-coral-light/60 text-coral">
                                                {cat?.name ?? 'Other'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-secondary">
                                            {new Date(
                                                expense.date
                                            ).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-mono font-semibold text-text-primary text-right">
                                            $
                                            {(
                                                expense.amountCents / 100
                                            ).toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* FAB — opens dialog instead of navigating */}
            <button
                onClick={() => setShowAddDialog(true)}
                data-cuelume-press
                style={{ viewTransitionName: 'fab-morph' }}
                className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-coral to-coral-dark text-white rounded-full shadow-warm-lg flex items-center justify-center hover:shadow-warm-xl active:scale-95 transition-colors transition-shadow transition-transform duration-150 z-40 group cursor-pointer"
                title="Add expense"
            >
                <svg
                    className="transition-transform duration-300 group-hover:rotate-90"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>

            {/* Add Expense Dialog */}
            <AddExpenseDialog
                open={showAddDialog}
                onClose={() => setShowAddDialog(false)}
            />
        </div>
    );
}
