import { describe, expect, it } from 'vitest';
import { makeGroupFilter, resolveGroups } from '../tools/lib/groups.ts';

const groups = {
  include: [{ name: 'Classy', rank: 'class', id: 10 }],
  exclude: [{ name: 'Mildewy', rank: 'family', id: 20, why: 'powdery mildews' }],
};

describe('group filter', () => {
  const keep = makeGroupFilter(groups);
  it('keeps a species under an included group', () => {
    expect(keep({ id: 99, ancestor_ids: [1, 10, 25, 99] })).toBe(true);
  });
  it('drops a species under an excluded group, even inside an included one', () => {
    expect(keep({ id: 98, ancestor_ids: [1, 10, 20, 98] })).toBe(false);
  });
  it('drops a species under no included group', () => {
    expect(keep({ id: 97, ancestor_ids: [1, 11, 97] })).toBe(false);
  });
  it('counts the taxon itself as part of its lineage', () => {
    expect(keep({ id: 10, ancestor_ids: [1] })).toBe(true);
  });
});

describe('resolveGroups', () => {
  it('looks every group up by name and rank, in order', async () => {
    const asked: string[] = [];
    const resolved = await resolveGroups(
      { placeId: 6857, include: [{ name: 'A', rank: 'class' }], exclude: [{ name: 'B', rank: 'order', why: 'x' }] },
      async (name, rank) => {
        asked.push(`${rank}:${name}`);
        return { id: name === 'A' ? 1 : 2, name, rank, ancestor_ids: [] };
      },
    );
    expect(asked).toEqual(['class:A', 'order:B']);
    expect(resolved.include[0]).toMatchObject({ name: 'A', id: 1 });
    expect(resolved.exclude[0]).toMatchObject({ name: 'B', id: 2, why: 'x' });
  });
});
