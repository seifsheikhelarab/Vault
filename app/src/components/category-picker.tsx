import { type ReactNode, useState } from 'react';
import { useCategories } from '../lib/hooks';

/** Returns an SVG icon for a category based on its name. */
export function getCategoryIcon(name: string, size = 24): ReactNode {
    const n = name.toLowerCase();
    if (
        n.includes('food') ||
        n.includes('dining') ||
        n.includes('restaurant') ||
        n.includes('grocer')
    ) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
        );
    }
    if (
        n.includes('transport') ||
        n.includes('travel') ||
        n.includes('commute') ||
        n.includes('car') ||
        n.includes('bus') ||
        n.includes('uber') ||
        n.includes('lyft')
    ) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
                <circle cx="6.5" cy="16.5" r="2.5" />
                <circle cx="16.5" cy="16.5" r="2.5" />
            </svg>
        );
    }
    if (
        n.includes('entertain') ||
        n.includes('fun') ||
        n.includes('game') ||
        n.includes('movie') ||
        n.includes('music') ||
        n.includes('concert')
    ) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="2" y1="7" x2="7" y2="7" />
                <line x1="2" y1="17" x2="7" y2="17" />
                <line x1="17" y1="17" x2="22" y2="17" />
                <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
        );
    }
    if (
        n.includes('utilit') ||
        n.includes('electric') ||
        n.includes('water') ||
        n.includes('gas') ||
        n.includes('internet') ||
        n.includes('phone') ||
        n.includes('bill')
    ) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
        );
    }
    if (
        n.includes('health') ||
        n.includes('medical') ||
        n.includes('doctor') ||
        n.includes('pharmacy') ||
        n.includes('gym') ||
        n.includes('fitness')
    ) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
        );
    }
    if (
        n.includes('shop') ||
        n.includes('cloth') ||
        n.includes('apparel') ||
        n.includes('retail')
    ) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
        );
    }
    if (
        n.includes('rent') ||
        n.includes('housing') ||
        n.includes('mortgage') ||
        n.includes('home')
    ) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        );
    }
    if (
        n.includes('educat') ||
        n.includes('book') ||
        n.includes('tuition') ||
        n.includes('course') ||
        n.includes('learn')
    ) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
        );
    }
    if (
        n.includes('subscription') ||
        n.includes('software') ||
        n.includes('saas')
    ) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
        );
    }
    // Default folder icon
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
    );
}

interface CategoryPickerProps {
    selectedId: string;
    onSelect: (id: string) => void;
    max?: number;
}

export function CategoryPicker({
    selectedId,
    onSelect,
    max = 6
}: CategoryPickerProps) {
    const { data: categories = [], isPending: catLoading } = useCategories();
    const [expanded, setExpanded] = useState(false);

    if (catLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-3 col-span-full">
                <div className="w-4 h-4 border-2 border-coral/30 border-t-coral rounded-full animate-spin" />
                <span className="text-xs text-text-tertiary">Loading...</span>
            </div>
        );
    }

    if (categories.length === 0) {
        return (
            <div className="col-span-full text-xs text-text-tertiary py-2 text-center">
                No categories yet
            </div>
        );
    }

    const visible = expanded ? categories : categories.slice(0, max);
    const hiddenCount = categories.length - max;

    const handleSelect = (id: string) => {
        onSelect(id);
        // Collapse back after selection so the picker stays compact
        if (expanded) setExpanded(false);
    };

    return (
        <>
            {visible.map((cat) => (
                <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat.id)}
                    data-cuelume-press
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-[8px] border transition-colors duration-150 ${
                        selectedId === cat.id
                            ? 'border-coral bg-coral-light/50 text-coral'
                            : 'border-border-light hover:border-coral-light hover:bg-cream/50 text-text-secondary'
                    }`}
                >
                    <span className="text-lg leading-none">
                        {getCategoryIcon(cat.name, 20)}
                    </span>
                    <span className="text-[10px] font-semibold leading-tight text-center">
                        {cat.name}
                    </span>
                </button>
            ))}
            {hiddenCount > 0 && (
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    aria-expanded={expanded}
                    className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-[8px] border transition-all duration-200 ${
                        expanded
                            ? 'border-coral-light bg-coral-light/30 text-coral'
                            : 'border-dashed border-border-light hover:border-coral-light hover:bg-cream/50 text-text-tertiary hover:text-text-secondary'
                    }`}
                    title={
                        expanded
                            ? 'Show fewer categories'
                            : `Show all ${categories.length} categories`
                    }
                >
                    <span className="text-xs leading-none">
                        {expanded ? '−' : '+'}
                    </span>
                    <span className="text-[10px] font-semibold leading-tight text-center">
                        {expanded ? 'Less' : `${hiddenCount} more`}
                    </span>
                </button>
            )}
        </>
    );
}
