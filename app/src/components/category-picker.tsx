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

    return (
        <>
            {categories.slice(0, max).map((cat) => (
                <button
                    key={cat.id}
                    type="button"
                    onClick={() => onSelect(cat.id)}
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
            {categories.length > max && (
                <div className="flex items-center justify-center py-2 px-1 rounded-[8px] border border-dashed border-border-light text-[10px] text-text-tertiary col-span-1">
                    +{categories.length - max} more
                </div>
            )}
        </>
    );
}
