import { expect, it } from 'vitest';
import { inputAlignmentClasses } from '../../../../components/ui/primitives/inputs/InputField';

it('keeps default left alignment and existing trailing padding', () => {
  expect(inputAlignmentClasses()).toBe('px-[20px]');
  expect(inputAlignmentClasses('left', true)).toBe('pl-[20px] pr-[60px]');
});
it('centres values/placeholders with balanced trailing padding', () => {
  expect(inputAlignmentClasses('center')).toBe('px-[20px] text-center');
  expect(inputAlignmentClasses('center', true)).toBe('px-[60px] text-center');
});
