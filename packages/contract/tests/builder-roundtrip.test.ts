import { describe, it, expect } from 'vitest';
import { contract, parseContract, ContractValidationError } from '../src/index.js';

describe('builder round-trip', () => {
    it('builds a complete contract that parses back identically', () => {
        const built = contract('home')
            .viewport({ widths: [320, 768, 1280] })
            .select('sidebar', '.app-sidebar')
            .at('*')
            .assert('noOverflow', undefined, { id: 'no-overflow' })
            .below(768)
            .assert('hidden', { selector: '$sidebar' }, { id: 'sidebar-hidden-mobile', description: 'sidebar collapses on mobile' })
            .from(768)
            .assert('visible', { selector: '$sidebar' }, { id: 'sidebar-visible-desktop' })
            .at('*')
            .score({ min: 0.6 })
            .baseline('$sidebar', 'width', { px: 4 })
            .build();

        const reparsed = parseContract(JSON.parse(JSON.stringify(built)) as object);
        expect(reparsed).toEqual(built);
        expect(built.rules[1].when).toEqual({ max: 767 });
        expect(built.rules[2].when).toEqual({ min: 768 });
    });

    it('derives stable ids for rules without one', () => {
        const built = contract().assert('noOverflow').assert('touchTarget', { selector: 'button' }).build();
        expect(built.rules[0].id).toBe('rule-1-noOverflow');
        expect(built.rules[1].id).toBe('rule-2-touchTarget');
    });

    it('toJSON produces parseable JSON', () => {
        const json = contract('x').assert('noOverflow').toJSON();
        expect(parseContract(json).name).toBe('x');
    });

    it('range sugar maps to inclusive bounds', () => {
        const built = contract()
            .upTo(1024)
            .assert('noOverflow', undefined, { id: 'a' })
            .between(768, 1024)
            .assert('noOverflow', undefined, { id: 'b' })
            .build();
        expect(built.rules[0].when).toEqual({ max: 1024 });
        expect(built.rules[1].when).toEqual({ min: 768, max: 1024 });
    });

    it('build() validates: bad args throw ContractValidationError', () => {
        expect(() => contract().assert('contains', { parent: '.a' }).build()).toThrow(ContractValidationError);
    });

    it('use() embeds a design-system profile', () => {
        const built = contract().use('material-design-3', { interactive: ['button'] }).assert('noOverflow').build();
        expect(built.designSystem).toEqual({ profile: 'material-design-3', selectors: { interactive: ['button'] } });
    });
});
