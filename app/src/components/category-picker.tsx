import { useState } from 'react';
import { useCategories } from '../lib/hooks';

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
                        {cat.icon || (
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
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                        )}
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
                    title={expanded ? 'Show fewer categories' : `Show all ${categories.length} categories`}
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
