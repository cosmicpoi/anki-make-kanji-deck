
// Helper function for recursively finding variants
export function getVariantCandidates(str: string, charVariants: (c: string) => string[]): string[] {
    const chars: string[] = str.split('');
    const variants: string[][] = chars.map(c => charVariants(c));
    if (variants.some(v => v.length == 0)) return [];

    // initialize candidate map
    const traverse = (root: string, idx: number): string[] => {
        // base case: reached max length, terminate
        if (root.length == chars.length) return [root];
        // otherwise, try the current char + append other options
        return variants[idx]
            .map((v: string): string[] => traverse(root + v, idx + 1))
            .flat();
    }
    if (chars.length == 1) return variants[0];
    return traverse('', 0);
}